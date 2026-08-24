-- Realtime (Free Plan): postgres_changes für offene PWA.
-- Im Supabase-Dashboard → SQL Editor ausführen, falls die Tabellen
-- noch nicht in der Publication supabase_realtime stehen.

alter table public.messages replica identity full;
alter table public.ticket_members replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_members'
  ) then
    alter publication supabase_realtime add table public.ticket_members;
  end if;
end $$;
