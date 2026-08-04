-- =========================================
-- REALTIME PUBLICATION FOR checkpoints/scan_packets (Ticket 143)
-- =========================================
-- Client Realtime-Subscriptions existieren bereits (CheckpointListView.vue,
-- CheckpointBusView.vue, CheckpointGroupView.vue, CheckpointLazyView.vue -
-- postgres_changes auf checkpoints/scan_packets), liefern aber nie ein
-- Event: laut backup/database/schema.sql (Stand nach Ticket 138) sind
-- checkpoints und scan_packets nicht Teil der Publikation
-- supabase_realtime - nur children/children_today/groups_today/
-- reset_events/user_group_day/users sind dort gelistet (vermutlich
-- manuell im Supabase Dashboard aktiviert, fuer diese beiden Tabellen aber
-- nie nachgeholt, als sie in Ticket 122/132 entstanden). Ohne Mitgliedschaft
-- in der Publikation sendet Postgres keine WAL-Aenderungen dieser Tabellen
-- in die logische Replikation - der Client-Code kann korrekt sein und
-- bekommt trotzdem nie ein Event.
-- Apply manually via the Supabase SQL editor (this repo has no migrations
-- folder, see doc/db/checkpoints.sql for the same convention). ADD TABLE ist
-- nicht idempotent (Fehler bei bereits vorhandener Mitgliedschaft) - vor dem
-- Anwenden pruefen:
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

ALTER PUBLICATION supabase_realtime ADD TABLE public.checkpoints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_packets;
