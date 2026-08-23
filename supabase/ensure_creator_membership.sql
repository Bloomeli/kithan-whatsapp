-- Wer ein Ticket angelegt hat, gehört immer in den Chat.
insert into public.ticket_members (ticket_id, user_id)
select t.id, t.created_by
from public.tickets t
where not exists (
  select 1
  from public.ticket_members m
  where m.ticket_id = t.id and m.user_id = t.created_by
);

-- Nextelin Sol in alle bestehenden Problemräume (zum Testen).
insert into public.ticket_members (ticket_id, user_id)
select t.id, u.id
from public.tickets t
join public.users u on lower(trim(u.name)) = 'nextelin sol'
where not exists (
  select 1
  from public.ticket_members m
  where m.ticket_id = t.id and m.user_id = u.id
);
