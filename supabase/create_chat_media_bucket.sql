-- Fotos/Videos im Chat. SQL Editor → Run.
-- Ohne diesen Bucket kommt „Bucket not found“.

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = true;

drop policy if exists chat_media_select on storage.objects;
drop policy if exists chat_media_insert on storage.objects;
drop policy if exists chat_media_delete on storage.objects;

create policy chat_media_select
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-media');

create policy chat_media_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'chat-media');

create policy chat_media_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'chat-media');
