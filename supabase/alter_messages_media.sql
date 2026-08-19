-- messages um Medien erweitern (bestehende Datenbank)
alter table public.messages
  add column if not exists media_url text,
  add column if not exists media_type text;

alter table public.messages drop constraint if exists messages_content_not_empty;

alter table public.messages drop constraint if exists messages_has_body;
alter table public.messages
  add constraint messages_has_body
  check (char_length(trim(content)) > 0 or media_url is not null);

alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages
  add constraint messages_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

comment on column public.messages.media_url is 'Öffentliche URL im Storage-Bucket chat-media.';
comment on column public.messages.media_type is 'image oder video; null = reine Textnachricht.';

-- Storage-Bucket für Fotos und Videos
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = true;

drop policy if exists chat_media_select on storage.objects;
drop policy if exists chat_media_insert on storage.objects;

create policy chat_media_select
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-media');

create policy chat_media_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'chat-media');
