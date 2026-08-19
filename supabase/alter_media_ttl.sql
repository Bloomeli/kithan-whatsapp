-- Vorläufig: Fotos/Videos nach 36 Stunden aus dem Speicher löschen (1 GB Limit).
-- Im Supabase-Dashboard unter SQL Editor ausführen.

alter table public.messages drop constraint if exists messages_has_body;
alter table public.messages add constraint messages_has_body check (
  char_length(trim(content)) > 0
  or media_url is not null
  or media_type is not null
);

create or replace function public.purge_expired_chat_media()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  updated_count integer;
begin
  delete from storage.objects
  where bucket_id = 'chat-media'
    and created_at < now() - interval '36 hours';

  update public.messages
  set media_url = null
  where media_url is not null
    and created_at < now() - interval '36 hours';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.purge_expired_chat_media() from public;
grant execute on function public.purge_expired_chat_media() to anon, authenticated;

drop policy if exists chat_media_delete on storage.objects;
create policy chat_media_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'chat-media');
