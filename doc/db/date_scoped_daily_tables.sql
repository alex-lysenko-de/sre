-- =========================================
-- DATE-SCOPED DAILY TABLES (Ticket 138)
-- =========================================
-- Replaces the old Hard/Soft/Total Reset day-boundary mechanism (removed in
-- ticket 137 together with on_reset_event_insert/AdminBusView.vue) with a
-- schema-level day boundary: children_today/groups_today move from "one row
-- per entity, reused/reset on demand" to "one row per entity AND day", the
-- same model scans/checkpoints already use. See tickets/130/IMPLEMENTATION_PLAN.md,
-- "Автоматическая граница дня", for the full rationale.
--
-- children_today/groups_today are NOT dead code: on_scan_insert_batch() /
-- on_children_today_change_batch() (doc/db/scan_packets.sql) write them on
-- every real scan via the live packet pipeline (tickets 120/122), independent
-- of any UI. The unique-constraint swap (step 1) and the ON CONFLICT target
-- update in both functions (step 2) are applied together in this single file
-- - splitting them across separate applications would make the first scan
-- after step 1 (and before step 2) fail with a Postgres "no unique or
-- exclusion constraint matching the ON CONFLICT specification" error,
-- breaking the live scanning pipeline, not just an old screen.
--
-- Apply manually via the Supabase SQL editor (this repo has no migrations
-- folder, same convention as doc/db_triggers.sql / doc/db/scan_packets.sql).
-- Idempotent: ADD COLUMN IF NOT EXISTS, constraint swaps guarded by
-- pg_constraint checks, CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS.

-- =========================================
-- 1) Schema: add `date`, swap unique constraints
-- =========================================
-- `date` uses the same text format ('YYYY-MM-DD') already used by
-- scans.date/checkpoints.day - continuing the existing schema convention,
-- not introducing a new one.

ALTER TABLE public.children_today
  ADD COLUMN IF NOT EXISTS date character varying NOT NULL
    DEFAULT to_char(now(), 'YYYY-MM-DD');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'children_today_child_id_date_key'
  ) THEN
    ALTER TABLE public.children_today DROP CONSTRAINT IF EXISTS children_today_child_id_key;
    ALTER TABLE public.children_today
      ADD CONSTRAINT children_today_child_id_date_key UNIQUE (child_id, date);
  END IF;
END $$;

ALTER TABLE public.groups_today
  ADD COLUMN IF NOT EXISTS date character varying NOT NULL
    DEFAULT to_char(now(), 'YYYY-MM-DD');

-- groups_today_user_id_key does not exist on the live schema (only
-- groups_today_group_id_key does, confirmed tickets/131/MIGRATION_PLAN.md
-- §1.3 п.4 / backup/database/schema.sql:4984-4988) - no corresponding
-- DROP/ADD for a (user_id, date) constraint here, per tickets/138/138.txt.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_today_group_id_date_key'
  ) THEN
    ALTER TABLE public.groups_today DROP CONSTRAINT IF EXISTS groups_today_group_id_key;
    ALTER TABLE public.groups_today
      ADD CONSTRAINT groups_today_group_id_date_key UNIQUE (group_id, date);
  END IF;
END $$;

-- =========================================
-- 2) Batch triggers: ON CONFLICT target -> (child_id, date) / (group_id, date)
-- =========================================
-- Same functions as doc/db/scan_packets.sql, only the ON CONFLICT target and
-- the addition of `date` to the written/grouped columns change - the rest of
-- the logic (groupless-child guard, DISTINCT ON dedup, full-recount semantics)
-- is unchanged.

CREATE OR REPLACE FUNCTION on_scan_insert_batch()
RETURNS TRIGGER AS $$
DECLARE
  v_groupless_child_id bigint;
BEGIN
  SELECT s.child_id INTO v_groupless_child_id
  FROM new_table s
  JOIN children c ON c.id = s.child_id
  WHERE c.group_id IS NULL
  LIMIT 1;

  IF v_groupless_child_id IS NOT NULL THEN
    RAISE EXCEPTION 'Child % has no group_id assigned - scan batch rejected', v_groupless_child_id;
  END IF;

  -- `date` comes from the scan itself (s.date), not the DB server's now() -
  -- keeps children_today's day bucket aligned with the same date the scan
  -- was recorded under (scans.date/scan_packets.date), instead of relying on
  -- the column DEFAULT, which would use the trigger's own execution time.
  INSERT INTO children_today (
    user_id, child_id, group_id, date,
    presence_today, presence_now, bus_today, bus_now, presence_morning
  )
  SELECT DISTINCT ON (s.child_id)
    s.user_id, s.child_id, c.group_id, s.date,
    1, 1, s.bus_id, s.bus_id,
    CASE WHEN s.bus_id IS NOT NULL THEN 1 ELSE 0 END
  FROM new_table s
  JOIN children c ON c.id = s.child_id
  ORDER BY s.child_id, s.created_at DESC
  ON CONFLICT (child_id, date) DO UPDATE
    SET presence_now = 1,
        bus_now = EXCLUDED.bus_now,
        user_id = EXCLUDED.user_id;
    -- presence_morning intentionally not in the SET list, same invariant as
    -- before (ticket 106, doc/db/headcount_presence_morning.sql)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION on_children_today_change_batch()
RETURNS TRIGGER AS $$
BEGIN
  -- Grouped by (group_id, date) now, not just group_id - a group's row for
  -- today must only aggregate today's children_today rows, not every
  -- historical date that group has ever had rows for. Scoping the WHERE by
  -- the same (group_id, date) pairs touched in new_table (rather than just
  -- group_id) keeps this a full recount of only the affected day, not every
  -- day on record for that group.
  INSERT INTO groups_today (user_id, group_id, date, children_today, children_now)
  SELECT
    MAX(ct.user_id),
    ct.group_id,
    ct.date,
    COUNT(*) FILTER (WHERE ct.presence_today = 1),
    COUNT(*) FILTER (WHERE ct.presence_now = 1)
  FROM children_today ct
  WHERE (ct.group_id, ct.date) IN (
    SELECT DISTINCT group_id, date FROM new_table WHERE group_id IS NOT NULL
  )
  GROUP BY ct.group_id, ct.date
  ON CONFLICT (group_id, date) DO UPDATE
    SET children_today = EXCLUDED.children_today,
        children_now = EXCLUDED.children_now,
        user_id = EXCLUDED.user_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Not touched by this file:
-- - on_children_today_delete()/trg_on_children_today_delete - already inert
--   since ticket 137 removed on_reset_event_insert, its only DELETE FROM
--   children_today source (tickets/138/138.txt, "Что прочитать").
-- - on_scan_insert()/on_children_today_change() (non-batch) - dead leftover
--   functions, no live trigger calls them (superseded by the _batch versions
--   in ticket 122); out of scope for this ticket.

-- =========================================
-- 3) recalculate_groups_today() - manual troubleshooting utility
-- =========================================
-- Confirmed via grep: not called by any trigger and not referenced anywhere
-- in src/ (tickets/138/138.txt asked to re-verify this at implementation
-- time). It is a documented manual recovery tool ("Kann verwendet werden, um
-- groups_today bei Inkonsistenzen neu zu berechnen", doc/db_triggers.sql:247)
-- meant to be run by hand from the Supabase SQL editor - updated for
-- consistency with the new date-scoped schema rather than deleted, so it
-- keeps working as a recovery tool instead of silently becoming broken the
-- next time someone runs it.
CREATE OR REPLACE FUNCTION recalculate_groups_today()
RETURNS void AS $$
BEGIN
  INSERT INTO groups_today (user_id, group_id, date, children_today, children_now)
  SELECT
    MAX(user_id) as user_id,
    group_id,
    date,
    COUNT(*) FILTER (WHERE presence_today = 1) as children_today,
    COUNT(*) FILTER (WHERE presence_now = 1) as children_now
  FROM children_today
  GROUP BY group_id, date
  ON CONFLICT (group_id, date) DO UPDATE
    SET
      children_today = EXCLUDED.children_today,
      children_now = EXCLUDED.children_now,
      user_id = EXCLUDED.user_id;

  RAISE NOTICE 'groups_today recalculated successfully';
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 4) RLS: revoke unrevoked legacy wide policies
-- =========================================
-- vault/03-База-данных/RLS-политики.md, "Неотозванные широкие legacy-политики":
-- these permissive USING/WITH CHECK (true) policies coexist with the narrower
-- own_group_insert_presence_now/own_group_update_presence_now policies on
-- children_today; Postgres OR-combines permissive policies of the same
-- action, so the wide ones made the narrow ones meaningless in practice.
--
-- Re-verified for this ticket: after ticket 137 removed HeadcountView.vue/
-- useChildPresence.js (the only code that ever wrote to children_today under
-- an authenticated user session, via own_group_insert/update_presence_now),
-- grep across src/ finds zero remaining references to children_today or
-- groups_today anywhere in the frontend. The only writer left for either
-- table is the SECURITY DEFINER path via the scans trigger (service_role,
-- RLS does not apply). So own_group_insert_presence_now/
-- own_group_update_presence_now are also dropped, not just the wide legacy
-- ones - same end state as checkpoints (ticket 132): SELECT for
-- authenticated, no INSERT/UPDATE/DELETE policy for authenticated at all.

DROP POLICY IF EXISTS "Allow authenticated users to insert children_today" ON public.children_today;
DROP POLICY IF EXISTS "Allow authenticated users to update children_today" ON public.children_today;
DROP POLICY IF EXISTS "Allow authenticated users to delete children_today" ON public.children_today;
DROP POLICY IF EXISTS own_group_insert_presence_now ON public.children_today;
DROP POLICY IF EXISTS own_group_update_presence_now ON public.children_today;
-- "Allow authenticated users to read children_today" (SELECT, USING true) is
-- intentionally kept - same as checkpoints, any authenticated user may read.

DROP POLICY IF EXISTS "Allow authenticated users to insert groups_today" ON public.groups_today;
DROP POLICY IF EXISTS "Allow authenticated users to update groups_today" ON public.groups_today;
DROP POLICY IF EXISTS "Allow authenticated users to delete groups_today" ON public.groups_today;
-- "Allow authenticated users to read reset_events" (misnamed in the original
-- schema, actually FOR SELECT ON groups_today, USING true) is intentionally
-- kept - the SELECT policy for groups_today, not renamed here (out of scope,
-- purely cosmetic, would need dropping+recreating a working policy for no
-- functional gain).

-- =========================================
-- End of migration
-- =========================================
