-- A class that did not happen: a festival, a holiday, the teacher away. It is not attendance, so nobody is
-- marked present or absent; the day is recorded as cancelled with an optional reason, and reports skip it.

ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS cancel_reason text
  CONSTRAINT class_sessions_reason_len CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 80);

-- Mark one class off, or put it back. Any marks already made for that day are removed, because a class that
-- did not happen cannot have attendance.
CREATE OR REPLACE FUNCTION public.set_class_holiday(p_batch uuid, p_on date, p_off boolean, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_session uuid;
BEGIN
  SELECT studio_id INTO v_studio FROM public.batches WHERE id = p_batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF p_on < v_today - 366 OR p_on > v_today + 366 THEN
    RAISE EXCEPTION 'the date must be within a year of today';
  END IF;

  INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES (v_studio, p_batch, p_on)
  ON CONFLICT (batch_id, session_on) DO UPDATE SET session_on = EXCLUDED.session_on
  RETURNING id INTO v_session;

  IF p_off THEN
    DELETE FROM public.attendance_records WHERE session_id = v_session;
    UPDATE public.class_sessions
      SET cancelled_at = now(), cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
      WHERE id = v_session;
  ELSE
    UPDATE public.class_sessions SET cancelled_at = NULL, cancel_reason = NULL WHERE id = v_session;
  END IF;
  RETURN p_off;
END $$;

-- The classes called off in a date range, for the signed-in studio.
CREATE OR REPLACE FUNCTION public.class_holidays(p_from date, p_to date)
RETURNS TABLE (batch_id uuid, batch_name text, session_on date, reason text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT cs.batch_id, b.name, cs.session_on, cs.cancel_reason
  FROM public.class_sessions cs
  JOIN public.batches b ON b.id = cs.batch_id AND b.studio_id = cs.studio_id
  WHERE cs.cancelled_at IS NOT NULL AND cs.session_on BETWEEN p_from AND p_to
  ORDER BY cs.session_on DESC, b.name
$$;

-- Marking attendance for a day puts the class back on: it clearly did happen.
CREATE OR REPLACE FUNCTION public.mark_attendance(p_batch uuid, p_session_on date, p_marks jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_session uuid;
  v_missing text;
  v_count integer;
BEGIN
  SELECT studio_id INTO v_studio FROM public.batches WHERE id = p_batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF p_session_on < v_today - 366 OR p_session_on > v_today + 7 THEN
    RAISE EXCEPTION 'the date must be within the last year or the coming week';
  END IF;
  IF jsonb_typeof(p_marks) <> 'array' OR jsonb_array_length(p_marks) = 0 THEN
    RAISE EXCEPTION 'at least one attendance mark is required';
  END IF;

  SELECT string_agg(coalesce(s.name, m.student_id::text), ', ') INTO v_missing
  FROM jsonb_to_recordset(p_marks) AS m(student_id uuid, present boolean)
  LEFT JOIN public.students s ON s.id = m.student_id AND s.studio_id = v_studio
  WHERE NOT EXISTS (
    SELECT 1 FROM public.batch_members bm
    WHERE bm.batch_id = p_batch AND bm.student_id = m.student_id AND bm.studio_id = v_studio
      AND bm.joined_on <= p_session_on AND (bm.left_on IS NULL OR bm.left_on >= p_session_on)
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'not on the roster for that date: %', v_missing;
  END IF;

  INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES (v_studio, p_batch, p_session_on)
  ON CONFLICT (batch_id, session_on) DO UPDATE SET cancelled_at = NULL, cancel_reason = NULL
  RETURNING id INTO v_session;

  INSERT INTO public.attendance_records (studio_id, session_id, student_id, present)
  SELECT v_studio, v_session, m.student_id, m.present
  FROM jsonb_to_recordset(p_marks) AS m(student_id uuid, present boolean)
  ON CONFLICT (session_id, student_id) DO UPDATE SET present = EXCLUDED.present, marked_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.set_class_holiday(uuid, date, boolean, text), public.class_holidays(date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_class_holiday(uuid, date, boolean, text), public.class_holidays(date, date)
  TO authenticated, service_role;
