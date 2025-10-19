-- ============================================================================
-- 1️⃣ TRIGGER FÜR SCANS: on_scan_insert
-- ============================================================================
-- Wird ausgelöst bei jedem neuen Scan (INSERT in scans)
-- Erstellt/aktualisiert Eintrag in children_today

CREATE OR REPLACE FUNCTION on_scan_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id BIGINT;
BEGIN
  -- Hole group_id des Kindes
  SELECT group_id INTO v_group_id 
  FROM children 
  WHERE id = NEW.child_id;

  -- Falls Kind nicht existiert, Fehler werfen
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Child with id % does not exist', NEW.child_id;
  END IF;

  -- Upsert in children_today
  INSERT INTO children_today (
    user_id, 
    child_id, 
    group_id, 
    presence_today, 
    presence_now, 
    bus_today, 
    bus_now
  )
  VALUES (
    NEW.user_id,
    NEW.child_id,
    v_group_id,
    1, 
    1,
    NEW.bus_id, 
    NEW.bus_id
  )
  ON CONFLICT (child_id) DO UPDATE
    SET 
      presence_now = 1,
      bus_now = EXCLUDED.bus_now,
      user_id = EXCLUDED.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen
DROP TRIGGER IF EXISTS trg_on_scan_insert ON scans;
CREATE TRIGGER trg_on_scan_insert
  AFTER INSERT ON scans
  FOR EACH ROW
  EXECUTE FUNCTION on_scan_insert();


-- ============================================================================
-- 2️⃣ TRIGGER FÜR CHILDREN_TODAY: on_children_today_change
-- ============================================================================
-- Wird ausgelöst bei INSERT/UPDATE in children_today
-- Aktualisiert die Gruppenzähler in groups_today

CREATE OR REPLACE FUNCTION on_children_today_change()
RETURNS TRIGGER AS $$
DECLARE
  cnt_today INT;
  cnt_now INT;
BEGIN
  -- Zähle Kinder dieser Gruppe
  SELECT 
    COUNT(*) FILTER (WHERE presence_today = 1),
    COUNT(*) FILTER (WHERE presence_now = 1)
  INTO cnt_today, cnt_now
  FROM children_today 
  WHERE group_id = NEW.group_id;

  -- Upsert in groups_today
  INSERT INTO groups_today (
    user_id, 
    group_id, 
    children_today, 
    children_now
  )
  VALUES (
    NEW.user_id, 
    NEW.group_id, 
    cnt_today, 
    cnt_now
  )
  ON CONFLICT (group_id) DO UPDATE
    SET 
      children_today = EXCLUDED.children_today,
      children_now = EXCLUDED.children_now,
      user_id = EXCLUDED.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen
DROP TRIGGER IF EXISTS trg_on_children_today_change ON children_today;
CREATE TRIGGER trg_on_children_today_change
  AFTER INSERT OR UPDATE ON children_today
  FOR EACH ROW
  EXECUTE FUNCTION on_children_today_change();


-- ============================================================================
-- 3️⃣ TRIGGER FÜR RESET_EVENTS: on_reset_event_insert
-- ============================================================================
-- Wird ausgelöst bei INSERT in reset_events
-- Führt verschiedene Reset-Operationen durch

CREATE OR REPLACE FUNCTION on_reset_event_insert()
RETURNS TRIGGER AS $$
DECLARE
  resets_today INT;
BEGIN
  -- Zähle bisherige Resets am gleichen Tag
  SELECT COUNT(*) INTO resets_today
  FROM reset_events
  WHERE day = NEW.day 
    AND id < NEW.id
    AND event_type = 1;  -- Nur "normale" Resets zählen

  CASE NEW.event_type
    -- ========================================
    -- event_type = 0: TOTAL RESET (Tag schließen)
    -- ========================================
    WHEN 0 THEN
      -- Tabellen komplett leeren
      DELETE FROM children_today;
      DELETE FROM groups_today;
      
      RAISE NOTICE 'Total reset executed: all data cleared';

    -- ========================================
    -- event_type = 1: NORMAL RESET (Tag öffnen/zwischenzählen)
    -- ========================================
    WHEN 1 THEN
      -- Erster Reset des Tages: _now → _today speichern
      UPDATE groups_today 
      SET 
          children_today = children_now, 
          children_now = 0;
        
      RAISE NOTICE 'First reset of day: saved current counts to today';
      -- In beiden Fällen: presence_now für alle Kinder auf 0
      UPDATE children_today 
      SET presence_now = 0;

    -- ========================================
    -- event_type = 2: SOFT RESET (nur _now)
    -- ========================================
    WHEN 2 THEN
      -- Nur aktuelle Anwesenheit zurücksetzen
      UPDATE children_today 
      SET presence_now = 0;
      
      UPDATE groups_today 
      SET children_now = 0;
      
      RAISE NOTICE 'Soft reset: only current presence cleared';

    -- ========================================
    -- Unbekannter event_type
    -- ========================================
    ELSE
      RAISE EXCEPTION 'Unknown event_type: %', NEW.event_type;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen
DROP TRIGGER IF EXISTS trg_on_reset_event_insert ON reset_events;
CREATE TRIGGER trg_on_reset_event_insert
  AFTER INSERT ON reset_events
  FOR EACH ROW
  EXECUTE FUNCTION on_reset_event_insert();


-- ============================================================================
-- 4️⃣ OPTIONAL: TRIGGER FÜR DELETE IN CHILDREN_TODAY
-- ============================================================================
-- Falls ein Kind aus children_today gelöscht wird, groups_today aktualisieren

CREATE OR REPLACE FUNCTION on_children_today_delete()
RETURNS TRIGGER AS $$
DECLARE
  cnt_today INT;
  cnt_now INT;
BEGIN
  -- Neu zählen für die betroffene Gruppe
  SELECT 
    COUNT(*) FILTER (WHERE presence_today = 1),
    COUNT(*) FILTER (WHERE presence_now = 1)
  INTO cnt_today, cnt_now
  FROM children_today 
  WHERE group_id = OLD.group_id;

  -- groups_today aktualisieren (oder löschen falls keine Kinder mehr)
  IF cnt_today = 0 AND cnt_now = 0 THEN
    DELETE FROM groups_today WHERE group_id = OLD.group_id;
  ELSE
    UPDATE groups_today
    SET 
      children_today = cnt_today,
      children_now = cnt_now
    WHERE group_id = OLD.group_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen
DROP TRIGGER IF EXISTS trg_on_children_today_delete ON children_today;
CREATE TRIGGER trg_on_children_today_delete
  AFTER DELETE ON children_today
  FOR EACH ROW
  EXECUTE FUNCTION on_children_today_delete();


-- ============================================================================
-- 5️⃣ HILFSFUNKTION: Manuelle Neuberechnung (falls nötig)
-- ============================================================================
-- Kann verwendet werden, um groups_today bei Inkonsistenzen neu zu berechnen

CREATE OR REPLACE FUNCTION recalculate_groups_today()
RETURNS void AS $$
BEGIN
  -- Alle Gruppen neu berechnen
  INSERT INTO groups_today (user_id, group_id, children_today, children_now)
  SELECT 
    MAX(user_id) as user_id,
    group_id,
    COUNT(*) FILTER (WHERE presence_today = 1) as children_today,
    COUNT(*) FILTER (WHERE presence_now = 1) as children_now
  FROM children_today
  GROUP BY group_id
  ON CONFLICT (group_id) DO UPDATE
    SET 
      children_today = EXCLUDED.children_today,
      children_now = EXCLUDED.children_now,
      user_id = EXCLUDED.user_id;
      
  RAISE NOTICE 'groups_today recalculated successfully';
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 6️⃣ INDEX-EMPFEHLUNGEN für Performance
-- ============================================================================

-- Für schnellere Gruppenzählungen
CREATE INDEX IF NOT EXISTS idx_children_today_group_presence 
  ON children_today(group_id, presence_today, presence_now);

-- Für Reset-Event-Zählungen
CREATE INDEX IF NOT EXISTS idx_reset_events_day_type 
  ON reset_events(day, event_type);

-- Für Scan-Lookups
CREATE INDEX IF NOT EXISTS idx_scans_child_date 
  ON scans(child_id, date);

CREATE INDEX IF NOT EXISTS idx_scans_band_date 
  ON scans(band_id, date);