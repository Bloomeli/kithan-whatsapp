-- Neue Felder für Problemräume: Gebäude, Wohnung, Mieter, Vorfallzeit, Meldung.
-- Im Supabase-Dashboard unter SQL Editor ausführen.

alter table public.tickets
  add column if not exists building_id text,
  add column if not exists building_label text,
  add column if not exists unit_location text,
  add column if not exists tenant_name text,
  add column if not exists occurred_at timestamptz,
  add column if not exists reported_by text;

comment on column public.tickets.building_id is 'Objekt-ID aus der Vermietungs-App (Wohnung/Einheit).';
comment on column public.tickets.building_label is 'Adress-Label zum Zeitpunkt der Erstellung.';
comment on column public.tickets.unit_location is 'Wohnungsnummer / Lage innerhalb des Gebäudes.';
comment on column public.tickets.tenant_name is 'Name der/des Mieter(s).';
comment on column public.tickets.occurred_at is 'Datum und Uhrzeit, wann das Problem passiert ist.';
comment on column public.tickets.reported_by is 'Wer das Problem gemeldet hat.';
