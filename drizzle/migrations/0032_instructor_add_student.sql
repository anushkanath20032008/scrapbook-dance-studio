-- A dance teacher can add a dancer to a batch they teach: a name and, if they have it, a phone number. The dancer
-- belongs to the studio and the owner sees them at once; fees stay the owner's to set. Purely additive. The
-- teacher still has no table access: this one function starts from auth.uid(), only works on a batch of the
-- studio they teach at, and the studio's dancer limit still applies through the existing trigger.

CREATE FUNCTION public.instructor_add_student(p_batch uuid, p_name text, p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := public.caller_instructor_studio();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_guardian uuid;
  v_student uuid;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'you do not have access to a studio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batches b WHERE b.id = p_batch AND b.studio_id = v_studio AND b.archived_at IS NULL) THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'give the dancer a name';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^\+?[0-9[:space:]-]{10,18}$' THEN
    RAISE EXCEPTION 'that phone number does not look right';
  END IF;

  -- A dancer already on the studio's list (same name and phone) is reused, so nobody is added twice.
  SELECT s.id INTO v_student
  FROM public.students s
  LEFT JOIN public.guardians g ON g.id = s.guardian_id AND g.studio_id = s.studio_id
  WHERE s.studio_id = v_studio AND s.archived_at IS NULL
    AND lower(s.name) = lower(v_name)
    AND regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(v_phone, ''), '\D', '', 'g')
  LIMIT 1;

  IF v_student IS NULL THEN
    INSERT INTO public.guardians (studio_id, name, phone) VALUES (v_studio, v_name, v_phone) RETURNING id INTO v_guardian;
    INSERT INTO public.students (studio_id, name, guardian_id) VALUES (v_studio, v_name, v_guardian) RETURNING id INTO v_student;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.batch_members bm WHERE bm.batch_id = p_batch AND bm.student_id = v_student AND bm.left_on IS NULL
  ) THEN
    INSERT INTO public.batch_members (studio_id, batch_id, student_id) VALUES (v_studio, p_batch, v_student);
  END IF;
  RETURN v_student;
END $$;

REVOKE ALL ON FUNCTION public.instructor_add_student(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instructor_add_student(uuid, text, text) TO authenticated, service_role;
