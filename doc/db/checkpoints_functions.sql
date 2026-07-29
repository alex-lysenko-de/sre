-- =========================================
-- CHECKPOINTS - ADMIN RPC FUNCTIONS (Ticket 131)
-- =========================================
-- create_checkpoint / finish_checkpoint / remove_checkpoint - the explicit,
-- admin-driven side of the hybrid model (tickets/130/decision.md). Unlike
-- submit_scan_packet() (untrusted caller - a counselor's phone, via the
-- service_role Edge Function), these are called directly by an
-- authenticated admin session through supabase.rpc() - this is the first
-- use of Postgres RPC anywhere in this project (grep confirms zero prior
-- `supabase.rpc(` calls in src/), so SECURITY DEFINER + an explicit
-- in-function admin check is the whole enforcement boundary; RLS on
-- checkpoints (doc/db/checkpoints.sql) grants SELECT only and no writes at
-- all for `authenticated`.
--
-- Deliberately NOT reusing the existing has_role()/is_admin() helper
-- functions in this schema - both are missing the `active = true` check
-- that every other admin-only policy in this project enforces (days_rls.sql,
-- database_migration_config_rls.sql), which would let a deactivated admin
-- account still mutate/delete attendance data. Inlined instead, matching
-- the project's own documented standard.
--
-- SET search_path is set explicitly on every function below - standard
-- defense against SECURITY DEFINER search-path hijacking. submit_scan_packet()
-- (doc/db/scan_packets.sql) predates this and does not have it; not
-- retrofitting that here (out of scope for 131), but new admin-mutation
-- code should not repeat the gap.
--
-- Apply manually via the Supabase SQL editor, AFTER doc/db/checkpoints.sql.
-- Safe to re-run: CREATE OR REPLACE FUNCTION.

-- =========================================
-- 1) create_checkpoint(p_type, p_day)
-- =========================================
-- Explicit creation, used when an admin starts a round before the first
-- packet arrives. Unlike submit_scan_packet()'s auto-create (which silently
-- reuses an existing open checkpoint via ON CONFLICT DO NOTHING), this
-- REJECTS if one of the same (day, type) is already open - the admin must
-- Finish it first (tickets/130/decision.md, п.4). Returns the new row, or
-- raises 'ALREADY_OPEN' (the client composable maps this to the same
-- { error: 'ALREADY_OPEN', existingId } shape useCheckpointsMock.js already
-- uses, so the UI does not change).
CREATE OR REPLACE FUNCTION public.create_checkpoint(p_type smallint, p_day character varying)
RETURNS public.checkpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id bigint;
  v_row public.checkpoints;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin' AND active = true;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only active admins may create a checkpoint';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.checkpoints
    WHERE day = p_day AND type = p_type AND status = 1
  ) THEN
    RAISE EXCEPTION 'ALREADY_OPEN';
  END IF;

  INSERT INTO public.checkpoints (type, day, status, created_by)
  VALUES (p_type, p_day, 1, v_admin_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =========================================
-- 2) finish_checkpoint(p_id)
-- =========================================
-- The only way to close a round (tickets/130/decision.md, п.2 - no
-- auto-finish for any type, including Lazy). Two distinct steps kept
-- explicit, not folded into one opaque transaction (tickets/130/
-- IMPLEMENTATION_PLAN.md, "Риски" - "Смешение ответственности
-- finish_checkpoint()"): (a) close this round; (b) if this is the first
-- FINISHED checkpoint of the day (any type), capture the day's baseline
-- present-count.
--
-- Present-count is computed generically for any type from
-- scans -> scan_packets.checkpoint_id (thanks to the checkpoint_id column
-- added in checkpoints.sql / the submit_scan_packet() extension) - counts
-- distinct children with at least one scan recorded against THIS specific
-- checkpoint's packets. This works uniformly for BUS/GROUP/LAZY and does
-- NOT depend on the (not-yet-migrated, Phase 2) date-scoped children_today/
-- groups_today - it reads scans directly, scoped by checkpoint_id, which is
-- already precise per-round.
CREATE OR REPLACE FUNCTION public.finish_checkpoint(p_id bigint)
RETURNS public.checkpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id bigint;
  v_day character varying;
  v_present integer;
  v_row public.checkpoints;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin' AND active = true;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only active admins may finish a checkpoint';
  END IF;

  UPDATE public.checkpoints
    SET status = 2, finished_at = now(), finished_by = v_admin_id
    WHERE id = p_id AND status = 1
    RETURNING day INTO v_day;

  IF v_day IS NULL THEN
    RAISE EXCEPTION 'NOT_OPEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkpoints
    WHERE day = v_day AND baseline_children_count IS NOT NULL
  ) THEN
    SELECT count(DISTINCT s.child_id) INTO v_present
    FROM public.scans s
    JOIN public.scan_packets sp ON sp.id = s.packet_id
    WHERE sp.checkpoint_id = p_id;

    UPDATE public.checkpoints
      SET baseline_children_count = COALESCE(v_present, 0)
      WHERE id = p_id;
  END IF;

  SELECT * INTO v_row FROM public.checkpoints WHERE id = p_id;
  RETURN v_row;
END;
$$;

-- =========================================
-- 3) reopen_checkpoint(p_id)
-- =========================================
-- Undo an accidental Finish (130_2 prototype, Round 1 UX feedback - "Cancel"
-- was replaced by two clear actions, Reopen being the other one). Same
-- conflict semantics as create_checkpoint(): rejected if another checkpoint
-- of the same type/day is already open in the meantime (only one OPEN per
-- type per day is ever allowed, tickets/130/decision.md, п.4).
CREATE OR REPLACE FUNCTION public.reopen_checkpoint(p_id bigint)
RETURNS public.checkpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id bigint;
  v_type smallint;
  v_day character varying;
  v_row public.checkpoints;
BEGIN
  SELECT id INTO v_admin_id FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin' AND active = true;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only active admins may reopen a checkpoint';
  END IF;

  SELECT type, day INTO v_type, v_day FROM public.checkpoints WHERE id = p_id AND status = 2;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'NOT_FINISHED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.checkpoints
    WHERE day = v_day AND type = v_type AND status = 1
  ) THEN
    RAISE EXCEPTION 'ALREADY_OPEN';
  END IF;

  UPDATE public.checkpoints
    SET status = 1, finished_at = NULL, finished_by = NULL
    WHERE id = p_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =========================================
-- 4) remove_checkpoint(p_id)
-- =========================================
-- Hard delete, cascading procedurally to scan_packets and their scans - by
-- explicit user instruction (see doc/db/checkpoints.sql header and
-- tickets/131/IMPLEMENTATION_PLAN.md). Not an FK-level ON DELETE CASCADE on
-- scans.packet_id - that would silently affect every future scan_packets
-- delete anywhere, not just this one admin action.
--
-- Intentional, documented consequence: once this deletes a scan_packets
-- row, its client_packet_id no longer exists, so a counselor device's
-- offline-queue retry of that same packet is no longer deduped by
-- submit_scan_packet()'s ON CONFLICT (client_packet_id) DO NOTHING - it is
-- accepted as a new packet (and may auto-create a new checkpoint). This
-- matches the accepted risk (resend is possible), not a bug.
--
-- No audit trail is written before the delete (see IMPLEMENTATION_PLAN.md,
-- "Open, non-blocking follow-up" - ticket 124's client_logs table is not
-- confirmed live, not hard-coupled here).
CREATE OR REPLACE FUNCTION public.remove_checkpoint(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin' AND active = true
  ) THEN
    RAISE EXCEPTION 'Only active admins may remove a checkpoint';
  END IF;

  DELETE FROM public.scans
    WHERE packet_id IN (SELECT id FROM public.scan_packets WHERE checkpoint_id = p_id);
  DELETE FROM public.scan_packets WHERE checkpoint_id = p_id;
  DELETE FROM public.checkpoints WHERE id = p_id;
END;
$$;

-- =========================================
-- 5) Grants
-- =========================================
REVOKE ALL ON FUNCTION public.create_checkpoint(smallint, character varying) FROM public;
REVOKE ALL ON FUNCTION public.finish_checkpoint(bigint) FROM public;
REVOKE ALL ON FUNCTION public.reopen_checkpoint(bigint) FROM public;
REVOKE ALL ON FUNCTION public.remove_checkpoint(bigint) FROM public;

GRANT EXECUTE ON FUNCTION public.create_checkpoint(smallint, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_checkpoint(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_checkpoint(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_checkpoint(bigint) TO authenticated;

-- =========================================
-- End of migration
-- =========================================
