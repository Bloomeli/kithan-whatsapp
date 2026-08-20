-- Push-Abos für Mitteilungen bei geschlossener App.
-- Im Supabase SQL Editor ausführen.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_all_anon on public.push_subscriptions;
create policy push_subscriptions_all_anon
  on public.push_subscriptions for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.push_subscriptions to anon, authenticated;

comment on table public.push_subscriptions is 'Web-Push-Abos der Mitarbeiter-Geräte (PWA).';
