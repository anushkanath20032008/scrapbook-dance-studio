-- An archived dancer no longer appears on the attendance roster for new classes. A dancer who already has a mark
-- for that class day still shows, so past days are not rewritten.
CREATE OR REPLACE FUNCTION public.batch_day(p_batch uuid, p_on date)
RETURNS TABLE(student_id uuid, student_name text, present boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT s.id, s.name, ar.present
  FROM public.batch_members bm
  JOIN public.students s ON s.id = bm.student_id AND s.studio_id = bm.studio_id
  LEFT JOIN public.class_sessions cs ON cs.batch_id = bm.batch_id AND cs.session_on = p_on
  LEFT JOIN public.attendance_records ar ON ar.session_id = cs.id AND ar.student_id = s.id
  WHERE bm.batch_id = p_batch AND bm.joined_on <= p_on AND (bm.left_on IS NULL OR bm.left_on >= p_on)
    AND (s.archived_at IS NULL OR ar.present IS NOT NULL)
  ORDER BY s.name
$$;
