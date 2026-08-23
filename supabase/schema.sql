-- Kithan WhatsApp — Schema für das Supabase-Dashboard (SQL Editor)
-- Alle Primärschlüssel sind UUIDs. Relationen sind als Foreign Keys modelliert,
-- damit ein späterer SQL-Dump auf den Firmen-Server ohne ID-Mapping funktioniert.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.ticket_priority as enum ('emergency', 'urgent', 'standard');

create type public.ticket_status as enum (
  'open',
  'under_review',
  'in_progress',
  'needs_consultation',
  'waiting',
  'waiting_for_tenant',
  'waiting_for_parts',
  'done'
);

-- ---------------------------------------------------------------------------
-- users — Mitarbeiterstamm (Namen im Dashboard pflegen, kein Code-Change)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint users_name_not_empty check (char_length(trim(name)) > 0)
);

create unique index users_name_unique on public.users (lower(trim(name)));

comment on table public.users is 'Mitarbeitende des Immobilien-Teams. Login erfolgt über Namensauswahl.';

-- ---------------------------------------------------------------------------
-- tickets — Problemräume
-- ---------------------------------------------------------------------------

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  remarks text,
  priority public.ticket_priority not null default 'standard',
  status public.ticket_status[] not null default array['open']::public.ticket_status[],
  archived boolean not null default false,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  building_id text,
  building_label text,
  unit_location text,
  tenant_name text,
  occurred_at timestamptz,
  reported_by text,
  insurance_damage boolean not null default false,
  situation text,
  constraint tickets_title_not_empty check (char_length(trim(title)) > 0)
);

create index tickets_archived_idx on public.tickets (archived);
create index tickets_created_by_idx on public.tickets (created_by);
create index tickets_created_at_idx on public.tickets (created_at desc);

comment on table public.tickets is 'Problemräume. archived = true verschiebt das Ticket in den Archiv-Bereich.';
comment on column public.tickets.status is 'Arbeits-Status als Array. Die UI speichert in der Regel einen Wert. Archiv läuft über archived, nicht über diesen Enum.';
comment on column public.tickets.archived is 'true = Archiv (Neongrün-Markierung in der UI), false = aktive Liste.';
comment on column public.tickets.archived_at is 'Zeitpunkt der Archivierung. Nach 14 Tagen erinnert die UI zum manuellen Löschen.';
comment on column public.tickets.building_id is 'Objekt-ID aus der Vermietungs-App (Wohnung/Einheit).';
comment on column public.tickets.building_label is 'Adress-Label zum Zeitpunkt der Erstellung.';
comment on column public.tickets.unit_location is 'Wohnungsnummer / Lage innerhalb des Gebäudes.';
comment on column public.tickets.tenant_name is 'Name der/des Mieter(s).';
comment on column public.tickets.occurred_at is 'Datum und Uhrzeit, wann das Problem passiert ist.';
comment on column public.tickets.reported_by is 'Wer das Problem gemeldet hat.';
comment on column public.tickets.insurance_damage is 'Versicherungsschaden ja/nein.';
comment on column public.tickets.situation is 'Kurzbeschreibung, wenn insurance_damage = true.';

-- ---------------------------------------------------------------------------
-- ticket_members — Zuordnung Mitarbeiter ↔ Ticket (n:m)
-- ---------------------------------------------------------------------------

create table public.ticket_members (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  constraint ticket_members_unique unique (ticket_id, user_id)
);

create index ticket_members_ticket_id_idx on public.ticket_members (ticket_id);
create index ticket_members_user_id_idx on public.ticket_members (user_id);

comment on table public.ticket_members is 'Wer an welchem Problemraum beteiligt ist. Weitere Kollegen werden über + hinzugefügt.';
comment on column public.ticket_members.last_read_at is 'Nachrichten danach gelten als ungelesen. Wird beim Öffnen des Problemraums aktualisiert.';

-- ---------------------------------------------------------------------------
-- push_subscriptions — Web-Push für Mitteilungen bei geschlossener App
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is 'Web-Push-Abos der Mitarbeiter-Geräte (PWA).';

-- ---------------------------------------------------------------------------
-- messages — Chatnachrichten in einem Problemraum
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  content text not null default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint messages_has_body check (
    char_length(trim(content)) > 0 or media_url is not null or media_type is not null
  ),
  constraint messages_media_type_check check (
    media_type is null or media_type in ('image', 'video')
  )
);

create index messages_ticket_id_idx on public.messages (ticket_id);
create index messages_user_id_idx on public.messages (user_id);
create index messages_ticket_created_at_idx on public.messages (ticket_id, created_at);

comment on table public.messages is 'Nachrichten gehören immer zu genau einer ticket_id.';
comment on column public.messages.media_url is 'Öffentliche URL im Storage-Bucket chat-media.';
comment on column public.messages.media_type is 'image oder video; null = reine Textnachricht. Bleibt nach Ablauf der 36-Stunden-Löschung erhalten.';

-- ---------------------------------------------------------------------------
-- updated_at automatisch setzen
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_set_updated_at
before update on public.tickets
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Auth ist ein Namens-Dropdown (kein Supabase-Auth / kein JWT).
-- Die App spricht mit dem anon-Key; Policies erlauben daher den Team-Zugriff.
-- Bei der späteren Server-Migration durch echte Rollen ersetzen.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_members enable row level security;
alter table public.messages enable row level security;
alter table public.push_subscriptions enable row level security;

create policy users_select_anon
  on public.users for select
  to anon, authenticated
  using (true);

create policy tickets_all_anon
  on public.tickets for all
  to anon, authenticated
  using (true)
  with check (true);

create policy ticket_members_all_anon
  on public.ticket_members for all
  to anon, authenticated
  using (true)
  with check (true);

create policy messages_all_anon
  on public.messages for all
  to anon, authenticated
  using (true)
  with check (true);

create policy push_subscriptions_all_anon
  on public.push_subscriptions for all
  to anon, authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select on table public.users to anon, authenticated;
grant select, insert, update, delete on table public.tickets to anon, authenticated;
grant select, insert, update, delete on table public.ticket_members to anon, authenticated;
grant select, insert, update, delete on table public.messages to anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: Fotos und Videos (Beweissicherung)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = true;

create policy chat_media_select
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-media');

create policy chat_media_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'chat-media');

create policy chat_media_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'chat-media');

-- Vorläufig: Fotos/Videos nach 36 Stunden löschen (Speicherlimit).
create or replace function public.purge_expired_chat_media()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  updated_count integer;
begin
  delete from storage.objects
  where bucket_id = 'chat-media'
    and created_at < now() - interval '36 hours';

  update public.messages
  set media_url = null
  where media_url is not null
    and created_at < now() - interval '36 hours';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.purge_expired_chat_media() from public;
grant execute on function public.purge_expired_chat_media() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mitarbeiter anlegen (Namen im Dashboard jederzeit anpassbar)
-- ---------------------------------------------------------------------------

insert into public.users (name) values
  ('Arsim'),
  ('Besatim'),
  ('Blerim'),
  ('Fatmir'),
  ('Halim'),
  ('Jonas'),
  ('Lubig'),
  ('Nives'),
  ('Philip'),
  ('Sascha'),
  ('Nextel'),
  ('Rita'),
  ('Bercem');
