-- tickets/137/137.txt, п.6: Entfernt den Reset-Mechanismus des alten
-- Bus/Group-Zaehlmodells (Hard/Soft Reset), das mit AdminBusView.vue in
-- diesem Ticket entfernt wurde. Definiert in doc/db_triggers.sql:118-199.
--
-- reset_events bleibt als Tabelle bestehen (Historie, kein Cleanup-Bedarf,
-- siehe 137.txt п.7). trg_on_children_today_delete/on_children_today_delete()
-- wird bewusst NICHT entfernt - wird technisch "haengend" (einzige bisherige
-- Quelle von DELETE FROM children_today faellt weg), stoert aber nicht und
-- ist nicht Teil dieses Tickets.

DROP TRIGGER IF EXISTS trg_on_reset_event_insert ON reset_events;
DROP FUNCTION IF EXISTS on_reset_event_insert();
