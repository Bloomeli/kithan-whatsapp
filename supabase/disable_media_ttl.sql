-- Automatisches Löschen von Chat-Medien abschalten.
-- Löscht keine bestehenden Dateien. Im SQL-Editor einmal ausführen.

create or replace function public.purge_expired_chat_media()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  return 0;
end;
$$;
