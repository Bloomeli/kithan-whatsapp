-- Nur echte Teamnamen behalten. Keine Handynummer nötig — Login ist nur der Name.
-- SQL Editor → Run. Testnamen ohne Tickets werden gelöscht.

delete from public.users
where lower(trim(name)) not in ('nextelin sol', 'sascha w.')
  and not exists (
    select 1 from public.tickets t where t.created_by = users.id
  )
  and not exists (
    select 1 from public.ticket_members m where m.user_id = users.id
  )
  and not exists (
    select 1 from public.messages msg where msg.user_id = users.id
  );

-- Weitere echte Namen so anlegen (Beispiel, Namen anpassen):
-- insert into public.users (name)
-- select name
-- from (values ('Vorname Nachname')) as t(name)
-- where not exists (
--   select 1 from public.users u
--   where lower(trim(u.name)) = lower(trim(t.name))
-- );
