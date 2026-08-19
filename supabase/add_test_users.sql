-- Testpersonen für den Login (SQL Editor → Run)
-- Keine Telefonnummern: die App nutzt nur den Namen.

insert into public.users (name)
select name
from (values ('Nextelin Sol'), ('Sascha W.')) as t(name)
where not exists (
  select 1
  from public.users u
  where lower(trim(u.name)) = lower(trim(t.name))
);
