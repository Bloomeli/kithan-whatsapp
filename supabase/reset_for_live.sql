-- Testdaten von Nextel und Sascha löschen, echte Vornamen anlegen.
-- SQL Editor → Run. Danach in der App abmelden und neu anmelden.

alter table public.tickets
  add column if not exists insurance_damage boolean not null default false;

alter table public.tickets
  add column if not exists situation text;

alter table public.tickets
  add column if not exists contact text;

comment on column public.tickets.insurance_damage is 'Versicherungsschaden ja/nein.';
comment on column public.tickets.situation is 'Kurzbeschreibung, wenn insurance_damage = true.';
comment on column public.tickets.contact is 'Kontakt zum betroffenen Mieter.';

delete from public.messages;
delete from public.ticket_members;
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'push_subscriptions'
  ) then
    delete from public.push_subscriptions;
  end if;
end $$;
delete from public.tickets;
delete from public.users;

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
