-- Archiv-Zeitpunkt für die 14-Tage-Lösch-Erinnerung.
-- Im Supabase-Dashboard unter SQL Editor ausführen.

alter table public.tickets
  add column if not exists archived_at timestamptz;

update public.tickets
set archived_at = updated_at
where archived = true
  and archived_at is null;

comment on column public.tickets.archived_at is 'Zeitpunkt der Archivierung. Nach 14 Tagen erinnert die UI zum manuellen Löschen.';
