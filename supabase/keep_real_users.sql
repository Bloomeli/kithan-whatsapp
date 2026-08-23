-- Nur echte Team-Vornamen behalten. SQL Editor → Run.

delete from public.users
where lower(trim(name)) not in (
  'arsim',
  'besatim',
  'blerim',
  'fatmir',
  'halim',
  'jonas',
  'lubig',
  'nives',
  'philip',
  'sascha',
  'nextel',
  'rita',
  'bercem'
)
  and not exists (
    select 1 from public.tickets t where t.created_by = users.id
  )
  and not exists (
    select 1 from public.ticket_members m where m.user_id = users.id
  )
  and not exists (
    select 1 from public.messages msg where msg.user_id = users.id
  );
