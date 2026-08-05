-- =========================================
-- CHECKPOINTS: BASELINE CONFIRMATION (Ticket 147)
-- =========================================
-- Makes fixing the day's presentRoster ("Tagesreferenz") an explicit,
-- confirmable administrator action instead of a silent side effect of
-- closing the first checkpoint of the day. See tickets/147/147.txt and
-- tickets/147/IMPLEMENTATION_PLAN.md ("Изменение поведения Baseline").
--
--   1. finish_checkpoint(p_id) gets an optional p_set_baseline parameter
--      (default true - backward compatible with any already-deployed
--      caller that only passes p_id). When false, the checkpoint is
--      closed as usual but the baseline step is skipped entirely, leaving
--      the day without a baseline until set_checkpoint_baseline() is
--      called on some later closed checkpoint of the same day.
--   2. New RPC set_checkpoint_baseline(p_id) - explicit, deferred baseline
--      fixation on an already-FINISHED checkpoint, for when the admin
--      declined at Schliessen-time (or no checkpoint of the day has
--      become baseline yet). Same admin check and computation as step 2
--      of finish_checkpoint().
--
-- Apply manually via the Supabase SQL editor (this repo has no migrations
-- folder, see doc/db/checkpoints.sql for the same convention). Safe to
-- re-run: CREATE OR REPLACE FUNCTION throughout.

-- =========================================
-- 1) finish_checkpoint(): optional p_set_baseline (default true)
-- =========================================
CREATE OR REPLACE FUNCTION public.finish_checkpoint(
  p_id bigint,
  p_set_baseline boolean DEFAULT true
)
RETURNS public.checkpoints AS $$
DECLARE
  v_admin_id bigint;
  v_row public.checkpoints;
  v_is_first_of_day boolean;
  v_baseline smallint;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
  WHERE user_id = auth.uid() AND role = 'admin' AND active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  -- Step 1: close the checkpoint.
  UPDATE public.checkpoints
  SET status = 2, finished_at = now(), finished_by = v_admin_id
  WHERE id = p_id AND status = 1
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_OPEN';
  END IF;

  -- Step 2: baseline, only if requested and only for the first FINISHED
  -- checkpoint of the day (independent of type).
  IF p_set_baseline THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.checkpoints
      WHERE day = v_row.day AND baseline_children_count IS NOT NULL
    ) INTO v_is_first_of_day;

    IF v_is_first_of_day THEN
      SELECT COUNT(DISTINCT s.child_id) INTO v_baseline
      FROM public.scans s
      JOIN public.scan_packets sp ON sp.id = s.packet_id
      WHERE sp.checkpoint_id = p_id;

      UPDATE public.checkpoints
      SET baseline_children_count = v_baseline
      WHERE id = p_id
      RETURNING * INTO v_row;
    END IF;
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =========================================
-- 2) New RPC: set_checkpoint_baseline
-- =========================================
-- Explicit, deferred baseline fixation on an already-closed checkpoint -
-- for when the admin declined the confirmation at Schliessen-time, or
-- simply no checkpoint of the day has become baseline yet. Rejects with
-- BASELINE_ALREADY_SET if the day already has one (e.g. two admins racing
-- to fix it on two different checkpoints).
CREATE OR REPLACE FUNCTION public.set_checkpoint_baseline(p_id bigint)
RETURNS public.checkpoints AS $$
DECLARE
  v_admin_id bigint;
  v_row public.checkpoints;
  v_is_first_of_day boolean;
  v_baseline smallint;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
  WHERE user_id = auth.uid() AND role = 'admin' AND active = true;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  SELECT * INTO v_row FROM public.checkpoints WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_row.status <> 2 THEN
    RAISE EXCEPTION 'NOT_FINISHED';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.checkpoints
    WHERE day = v_row.day AND baseline_children_count IS NOT NULL
  ) INTO v_is_first_of_day;

  IF NOT v_is_first_of_day THEN
    RAISE EXCEPTION 'BASELINE_ALREADY_SET';
  END IF;

  SELECT COUNT(DISTINCT s.child_id) INTO v_baseline
  FROM public.scans s
  JOIN public.scan_packets sp ON sp.id = s.packet_id
  WHERE sp.checkpoint_id = p_id;

  UPDATE public.checkpoints
  SET baseline_children_count = v_baseline
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- RLS unchanged: both functions are SECURITY DEFINER with the same
-- role='admin' AND active=true check as the rest of doc/db/checkpoints.sql
-- ("writes only through the SECURITY DEFINER functions").

-- =========================================
-- End of migration
-- =========================================
