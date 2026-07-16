-- =========================================
-- RLS FOR public.days (Ticket 102)
-- =========================================
-- Root cause: RLS was enabled on public.days (confirmed indirectly by the
-- pre-existing RLS-aware error handling in useDays.js -> saveDay()), but no
-- DELETE policy existed for it. PostgREST does not treat "0 rows matched by
-- the RLS predicate" as an error, so deleteDay() always returned success
-- even though nothing was removed. This migration documents and fixes the
-- policy set for `days`, matching the admin-only pattern already used for
-- `c_bands`/`groups` in doc/database_migration.sql.
-- Safe to re-run: policies are dropped and recreated.

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user may read the days list (needed for
-- /days-edit and other authenticated screens that display the schedule).
DROP POLICY IF EXISTS "Allow authenticated users to read days" ON public.days;
CREATE POLICY "Allow authenticated users to read days"
  ON public.days FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: admin only. /days-edit is already gated by the
-- router (meta: { requiresAuth: true, requiresAdmin: true }); this makes
-- the same restriction authoritative at the database level.
DROP POLICY IF EXISTS "Allow admins to manage days" ON public.days;
CREATE POLICY "Allow admins to manage days"
  ON public.days FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.role = 'admin'
      AND users.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.role = 'admin'
      AND users.active = true
    )
  );

-- =========================================
-- End of migration
-- =========================================
