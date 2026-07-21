-- =========================================
-- HEADCOUNT (Kopfzählung) FOR public.children_today (Ticket 106)
-- =========================================
-- Ticket 106 needs an "Anwesend am Morgen" indicator that is fixed once per
-- day (does not flip back and forth as the child gets scanned again later),
-- plus a "Jetzt anwesend" toggle that Betreuer can write directly, limited to
-- their own group. children_today previously had no dedicated morning-only
-- column and no write access for regular users (SELECT-only, see
-- doc/db/adminBusView.md:444-449). This script:
--   1. adds children_today.presence_morning (written once, by on_scan_insert)
--   2. updates on_scan_insert to set it only in the INSERT branch
--   3. adds UPDATE/INSERT RLS policies scoped to the caller's own group today
-- Apply manually via the Supabase SQL editor (this repo has no migrations
-- folder). Safe to re-run: the column add is guarded, the function/policies
-- are replaced/recreated.

-- 1) New column: written once at the first scan of the day, never rewritten.
ALTER TABLE public.children_today
  ADD COLUMN IF NOT EXISTS presence_morning smallint NULL DEFAULT NULL;
-- semantics: 1 = child arrived by bus (first scan of the day had bus_id set),
-- 0 = first scan of the day had no bus_id, NULL = no scan yet today.

-- 2) on_scan_insert: same as doc/db_triggers.sql, INSERT branch now also
-- writes presence_morning; the ON CONFLICT DO UPDATE branch is unchanged, so
-- presence_morning is never overwritten by later scans on the same day.
CREATE OR REPLACE FUNCTION on_scan_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id BIGINT;
BEGIN
  SELECT group_id INTO v_group_id FROM children WHERE id = NEW.child_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Child with id % does not exist', NEW.child_id;
  END IF;

  INSERT INTO children_today (
    user_id, child_id, group_id, presence_today, presence_now, bus_today, bus_now, presence_morning
  )
  VALUES (
    NEW.user_id, NEW.child_id, v_group_id, 1, 1, NEW.bus_id, NEW.bus_id,
    CASE WHEN NEW.bus_id IS NOT NULL THEN 1 ELSE 0 END
  )
  ON CONFLICT (child_id) DO UPDATE
    SET presence_now = 1,
        bus_now = EXCLUDED.bus_now,
        user_id = EXCLUDED.user_id;
        -- presence_morning intentionally not in the SET list

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) RLS: allow a Betreuer to update presence_now only for children in the
-- group assigned to them today (user_group_day), plus unrestricted access
-- for admins. Needed because Headcount is the first feature giving regular
-- staff write access to children_today (previously scan-trigger-only).
DROP POLICY IF EXISTS "own_group_update_presence_now" ON public.children_today;
CREATE POLICY "own_group_update_presence_now"
  ON public.children_today FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_group_day ugd
      JOIN public.users u ON u.id = ugd.user_id
      WHERE u.user_id = auth.uid()
        AND ugd.group_id = children_today.group_id
        AND ugd.day = CURRENT_DATE
        AND ugd."isPresentToday" = 1
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_group_day ugd
      JOIN public.users u ON u.id = ugd.user_id
      WHERE u.user_id = auth.uid()
        AND ugd.group_id = children_today.group_id
        AND ugd.day = CURRENT_DATE
        AND ugd."isPresentToday" = 1
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'admin')
  );

-- INSERT is needed for setPresentNow() when a child has not been scanned yet
-- today and a Betreuer marks them present manually from the Headcount screen.
DROP POLICY IF EXISTS "own_group_insert_presence_now" ON public.children_today;
CREATE POLICY "own_group_insert_presence_now"
  ON public.children_today FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_group_day ugd
      JOIN public.users u ON u.id = ugd.user_id
      WHERE u.user_id = auth.uid()
        AND ugd.group_id = children_today.group_id
        AND ugd.day = CURRENT_DATE
        AND ugd."isPresentToday" = 1
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'admin')
  );

-- =========================================
-- End of migration
-- =========================================
