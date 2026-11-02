-- Status „Erledigt“ ergänzen. Löscht keine Daten.
-- Im Supabase-Dashboard unter SQL Editor einmal ausführen.

alter type public.ticket_status add value if not exists 'completed';
