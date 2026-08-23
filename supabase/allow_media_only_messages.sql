-- Foto/Video ohne Tipptext erlauben. SQL Editor → Run.
alter table public.messages drop constraint if exists messages_content_not_empty;
alter table public.messages drop constraint if exists messages_has_body;
alter table public.messages
  add constraint messages_has_body
  check (char_length(trim(content)) > 0 or media_url is not null);
