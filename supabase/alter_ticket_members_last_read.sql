-- Ungelesene Nachrichten: letzter Lesezeitpunkt pro Mitarbeiter und Problemraum.
-- Im Supabase-Dashboard unter SQL Editor ausführen.

alter table public.ticket_members
  add column if not exists last_read_at timestamptz not null default now();

comment on column public.ticket_members.last_read_at is 'Nachrichten danach gelten als ungelesen. Wird beim Öffnen des Problemraums aktualisiert.';
