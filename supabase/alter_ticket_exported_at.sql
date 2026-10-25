-- Zeitpunkt des erfolgreichen Uploads auf den Firmenserver.
-- Löscht keine bestehenden Tickets. Im SQL-Editor einmal ausführen.

alter table public.tickets
  add column if not exists exported_at timestamptz;

comment on column public.tickets.exported_at is
  'Zeitpunkt des erfolgreichen Uploads auf den Firmenserver. 14 Tage danach wird der Problemraum in Supabase gelöscht.';
