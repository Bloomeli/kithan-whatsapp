-- Team-Vornamen für den Login (SQL Editor → Run)
-- Keine Telefonnummern: die App nutzt nur den Namen.

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
  select 1
  from public.users u
  where lower(trim(u.name)) = lower(t.name)
);
