-- Dancer limit by plan. A studio gets everything for its first 30 days; after that Regular (and any studio
-- with no paid plan) is capped at 50 active dancers, the older Growth plan at 150, and Studio+ is not capped.
-- A past-due Studio+ keeps its limit so a late payment does not lock a studio out. The cap is enforced by the
-- database, so no route or client can skip it. Existing dancers are never removed: the cap only stops adding
-- or restoring one past the limit.

-- The studio's dancer limit, or NULL for no limit.
CREATE FUNCTION public.student_limit(p_studio uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN sp.created_at + interval '30 days' > now() THEN NULL
    WHEN sp.plan = 'studio' AND sp.billing_status IN ('active', 'past_due') THEN NULL
    WHEN sp.plan = 'growth' AND sp.billing_status IN ('active', 'past_due') THEN 150
    ELSE 50
  END
  FROM public.studio_profiles sp
  WHERE sp.user_id = p_studio
$$;

CREATE FUNCTION public.check_student_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit integer;
BEGIN
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Only adding a dancer, or restoring an archived one, can go over the limit.
  IF TG_OP = 'UPDATE' AND OLD.archived_at IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('student_limit:' || NEW.studio_id::text));
  v_limit := public.student_limit(NEW.studio_id);
  IF v_limit IS NOT NULL
     AND (SELECT count(*) FROM public.students s WHERE s.studio_id = NEW.studio_id AND s.archived_at IS NULL) >= v_limit THEN
    RAISE EXCEPTION 'You have reached the % dancer limit on your plan. Upgrade to Studio+ to add more.', v_limit;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER students_limit_guard BEFORE INSERT OR UPDATE OF archived_at ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.check_student_limit();

-- What the console shows: the caller's own limit, how many dancers they have, and when the free month ends.
CREATE FUNCTION public.studio_capacity()
RETURNS TABLE (student_limit integer, student_count integer, trial_ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.student_limit(sp.user_id),
    (SELECT count(*)::integer FROM public.students s WHERE s.studio_id = sp.user_id AND s.archived_at IS NULL),
    sp.created_at + interval '30 days'
  FROM public.studio_profiles sp
  WHERE sp.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.student_limit(uuid), public.check_student_limit(), public.studio_capacity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_capacity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_limit(uuid) TO service_role;
