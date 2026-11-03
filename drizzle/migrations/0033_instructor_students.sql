-- A dance teacher can see every dancer in the studio they teach at: contact and class details, never fees,
-- charges or payment status. Read-only and additive. The function starts from auth.uid() through
-- caller_instructor_studio(), so it returns nothing to anyone who is not a teacher at a studio.

CREATE FUNCTION public.instructor_students()
RETURNS TABLE (
  id uuid, name text, phone text, email text, joined_on date,
  emergency_name text, emergency_phone text, note text, batches text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, g.phone, s.email, s.joined_on, s.emergency_name, s.emergency_phone, s.note,
    COALESCE((
      SELECT array_agg(b.name ORDER BY b.name)
      FROM public.batch_members bm
      JOIN public.batches b ON b.id = bm.batch_id AND b.studio_id = bm.studio_id AND b.archived_at IS NULL
      WHERE bm.student_id = s.id AND bm.studio_id = s.studio_id AND bm.left_on IS NULL
    ), ARRAY[]::text[])
  FROM public.students s
  LEFT JOIN public.guardians g ON g.id = s.guardian_id AND g.studio_id = s.studio_id
  WHERE s.studio_id = public.caller_instructor_studio() AND s.archived_at IS NULL
  ORDER BY s.name
  LIMIT 1000
$$;

REVOKE ALL ON FUNCTION public.instructor_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.instructor_students() TO authenticated, service_role;
