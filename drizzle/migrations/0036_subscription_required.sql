-- After the free month, a studio needs a paid subscription to change anything. Reading stays open so the owner
-- can still see their dancers and records, and nothing is ever deleted. Enforced by the database, so no route,
-- client or SECURITY DEFINER helper can skip it.
--
-- A studio keeps write access while any of these is true:
--   * it is inside its first 30 days
--   * its subscription is active, or past_due (a grace window while the card is retried)
--   * access_until is in the future (a manual extension: pilots, support, the platform owner's own studio)
--   * the signed-in person holds the platform owner role
-- Background jobs (no signed-in user) are not affected.

ALTER TABLE public.studio_profiles ADD COLUMN IF NOT EXISTS access_until timestamptz;
COMMENT ON COLUMN public.studio_profiles.access_until IS
  'Manual write-access extension. Set by the platform owner only; NULL means the normal trial and subscription rules apply.';

CREATE OR REPLACE FUNCTION public.studio_has_access(p_studio uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT sp.created_at + interval '30 days' > now()
        OR sp.billing_status IN ('active', 'past_due')
        OR (sp.access_until IS NOT NULL AND sp.access_until > now())
    FROM public.studio_profiles sp
    WHERE sp.user_id = p_studio
  ), true)
$$;

CREATE OR REPLACE FUNCTION public.guard_studio_access() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
BEGIN
  -- Only a signed-in person is held to this. Background jobs run without auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(auth.uid(), 'owner') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_studio := COALESCE((to_jsonb(NEW) ->> 'studio_id')::uuid, (to_jsonb(OLD) ->> 'studio_id')::uuid);
  IF v_studio IS NOT NULL AND NOT public.studio_has_access(v_studio) THEN
    RAISE EXCEPTION 'Your free month has ended. Subscribe for Rs 249 a month on the Account page to keep using ChoreoStudio. Everything you have added is safe.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students', 'guardians', 'batches', 'batch_members', 'fee_plans', 'fee_plan_assignments',
    'charges', 'payments', 'attendance_records', 'class_sessions', 'makeup_classes',
    'reminders', 'studio_instructors', 'batch_requests'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS studio_access_guard ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER studio_access_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.guard_studio_access()', t);
  END LOOP;
END $$;

-- The console asks this to decide whether to show the subscribe wall.
CREATE OR REPLACE FUNCTION public.studio_access()
RETURNS TABLE (has_access boolean, access_until timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.studio_has_access(auth.uid()) OR public.has_role(auth.uid(), 'owner'), sp.access_until
  FROM public.studio_profiles sp WHERE sp.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.studio_has_access(uuid), public.guard_studio_access(), public.studio_access()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.studio_has_access(uuid) TO service_role;
