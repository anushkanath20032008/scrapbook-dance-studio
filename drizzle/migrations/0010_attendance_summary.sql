-- Attendance summaries for the console. Both run with the caller's rights, so row-level security limits them
-- to the caller's own studio. A dancer with no marks in the range shows zero marks, which the screen
-- renders as "no percentage" rather than 0%.

-- Each active dancer's marks in a date range: how many sessions were marked and how many were present.
CREATE FUNCTION public.attendance_by_student(p_from date, p_to date)
RETURNS TABLE (student_id uuid, student_name text, marked integer, present integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.name, count(x.id)::integer, (count(x.id) FILTER (WHERE x.present))::integer
  FROM public.students s
  LEFT JOIN (
    SELECT ar.id, ar.student_id, ar.present
    FROM public.attendance_records ar
    JOIN public.class_sessions cs ON cs.id = ar.session_id AND cs.studio_id = ar.studio_id
    WHERE cs.session_on BETWEEN p_from AND p_to
  ) x ON x.student_id = s.id
  WHERE s.archived_at IS NULL
  GROUP BY s.id, s.name
  ORDER BY s.name
$$;

-- Each running batch with its weekdays and how many classes were actually held (a class counts once any
-- attendance has been marked for that date) in a date range.
CREATE FUNCTION public.attendance_by_batch(p_from date, p_to date)
RETURNS TABLE (batch_id uuid, batch_name text, weekdays smallint[], held integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT b.id, b.name, b.weekdays, count(cs.id)::integer
  FROM public.batches b
  LEFT JOIN public.class_sessions cs
    ON cs.batch_id = b.id AND cs.studio_id = b.studio_id AND cs.session_on BETWEEN p_from AND p_to
  WHERE b.archived_at IS NULL
  GROUP BY b.id, b.name, b.weekdays
  ORDER BY b.name
$$;

REVOKE ALL ON FUNCTION public.attendance_by_student(date, date), public.attendance_by_batch(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_by_student(date, date), public.attendance_by_batch(date, date) TO authenticated, service_role;
