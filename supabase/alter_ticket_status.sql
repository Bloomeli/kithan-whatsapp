-- Bestehende Datenbank: 7 Arbeits-Status (Archiv bleibt tickets.archived)
-- Im Supabase SQL Editor ausführen.

alter type public.ticket_status add value if not exists 'under_review';
alter type public.ticket_status add value if not exists 'needs_consultation';
alter type public.ticket_status add value if not exists 'waiting_for_tenant';
alter type public.ticket_status add value if not exists 'waiting_for_parts';
