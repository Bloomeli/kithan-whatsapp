-- Mitarbeiter + Versicherungsschaden. SQL Editor → Run, bevor die neue App geladen wird.

alter table public.tickets
  add column if not exists insurance_damage boolean not null default false;

alter table public.tickets
  add column if not exists situation text;

comment on column public.tickets.insurance_damage is 'Versicherungsschaden ja/nein.';
comment on column public.tickets.situation is 'Kurzbeschreibung, wenn insurance_damage = true.';

update public.users set name = 'Nextel'
where lower(trim(name)) = 'nextelin sol'
  and not exists (select 1 from public.users u where lower(trim(u.name)) = 'nextel');

update public.users set name = 'Sascha'
where lower(trim(name)) in ('sascha w.', 'sascha w')
  and not exists (select 1 from public.users u where lower(trim(u.name)) = 'sascha');

update public.users set name = 'Jonas'
where lower(trim(name)) = 'jonas keller'
  and not exists (select 1 from public.users u where lower(trim(u.name)) = 'jonas');

insert into public.users (name)
select name
from (
  values
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
    ('Bercem')
) as t(name)
where not exists (
  select 1 from public.users u where lower(trim(u.name)) = lower(t.name)
);

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
  and not exists (select 1 from public.tickets t where t.created_by = users.id)
  and not exists (select 1 from public.ticket_members m where m.user_id = users.id)
  and not exists (select 1 from public.messages msg where msg.user_id = users.id)
  and not exists (select 1 from public.push_subscriptions p where p.user_id = users.id);
