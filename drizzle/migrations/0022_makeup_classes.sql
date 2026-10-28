-- Make-up classes: after marking absences, the owner or a Dance teacher plans a make-up class for the absent
-- dancers by choosing a batch and a date. The list stays open until marked done. It sends no message and
-- touches no fee, charge or reminder.
--
-- The table is reached only through the three SECURITY DEFINER functions below, which start from the caller:
-- a live teacher's studio (studio_instructors) or the owner's own studio. Nobody has table privileges and there
-- are no row policies, the same stricter-than-policies shape as migration 0021, so nothing can widen access
-- by union. Purely additive: no existing table, policy or function is changed.

CREATE TABLE public.makeup_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  missed_batch_id uuid NOT NULL,
  missed_on date NOT NULL,
  makeup_batch_id uuid NOT NULL,
  makeup_on date NOT NULL,
  done_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (makeup_on >= missed_on),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id),
  FOREIGN KEY (studio_id, missed_batch_id) REFERENCES public.batches (studio_id, id),
  FOREIGN KEY (studio_id, makeup_batch_id) REFERENCES public.batches (studio_id, id),
  -- One row per dancer per missed class.
  UNIQUE (studio_id, student_id, missed_batch_id, missed_on)
);
CREATE INDEX makeup_classes_open_idx ON public.makeup_classes (studio_id, makeup_on) WHERE done_at IS NULL;

ALTER TABLE public.makeup_classes ENABLE ROW LEVEL SECURITY;
-- Supabase's default grants would otherwise leave this table open to signed-in and anonymous users.
REVOKE ALL ON public.makeup_classes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.makeup_classes TO service_role;

-- The studio the caller works for: the live teacher's studio, or the caller's own studio, or NULL.
CREATE FUNCTION public.caller_studio() RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    public.caller_instructor_studio(),
    (SELECT sp.user_id FROM public.studio_profiles sp WHERE sp.user_id = auth.uid())
  )
$$;

-- Plan (or move) a make-up for dancers who were recorded absent from one batch on one date. Returns how many
-- dancers were planned. Every dancer must be recorded absent for that class, or nothing is written.
CREATE FUNCTION public.plan_makeup(p_batch uuid, p_missed_on date, p_students uuid[], p_makeup_batch uuid, p_makeup_on date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := public.caller_studio();
  v_bad text;
  v_count integer;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'you do not have access to a studio';
  END IF;
  IF p_students IS NULL OR cardinality(p_students) = 0 THEN
    RAISE EXCEPTION 'choose at least one dancer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batches b WHERE b.id = p_batch AND b.studio_id = v_studio) THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batches b WHERE b.id = p_makeup_batch AND b.studio_id = v_studio AND b.archived_at IS NULL) THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF p_makeup_on < p_missed_on THEN
    RAISE EXCEPTION 'the make-up date cannot be before the missed class';
  END IF;

  SELECT string_agg(coalesce(s.name, d.id::text), ', ') INTO v_bad
  FROM (SELECT DISTINCT unnest(p_students) AS id) d
  LEFT JOIN public.students s ON s.id = d.id AND s.studio_id = v_studio
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.class_sessions cs
    JOIN public.attendance_records ar ON ar.session_id = cs.id AND ar.studio_id = cs.studio_id
    WHERE cs.studio_id = v_studio AND cs.batch_id = p_batch AND cs.session_on = p_missed_on
      AND ar.student_id = d.id AND ar.present = false
  );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'not marked absent for that class: %', v_bad;
  END IF;

  INSERT INTO public.makeup_classes (studio_id, student_id, missed_batch_id, missed_on, makeup_batch_id, makeup_on, created_by)
  SELECT v_studio, d.id, p_batch, p_missed_on, p_makeup_batch, p_makeup_on, auth.uid()
  FROM (SELECT DISTINCT unnest(p_students) AS id) d
  ON CONFLICT (studio_id, student_id, missed_batch_id, missed_on)
  DO UPDATE SET makeup_batch_id = EXCLUDED.makeup_batch_id, makeup_on = EXCLUDED.makeup_on,
                done_at = NULL, created_by = EXCLUDED.created_by;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Open make-ups, plus those finished in the last 14 days. Names and dates only: no phone, fee or payment.
CREATE FUNCTION public.list_makeups()
RETURNS TABLE (
  id uuid, student_id uuid, student_name text,
  missed_batch_id uuid, missed_batch_name text, missed_on date,
  makeup_batch_id uuid, makeup_batch_name text, makeup_on date,
  done_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.student_id, s.name, m.missed_batch_id, mb.name, m.missed_on,
         m.makeup_batch_id, kb.name, m.makeup_on, m.done_at
  FROM public.makeup_classes m
  JOIN public.students s ON s.id = m.student_id AND s.studio_id = m.studio_id
  JOIN public.batches mb ON mb.id = m.missed_batch_id AND mb.studio_id = m.studio_id
  JOIN public.batches kb ON kb.id = m.makeup_batch_id AND kb.studio_id = m.studio_id
  WHERE m.studio_id = public.caller_studio()
    AND (m.done_at IS NULL OR m.done_at > now() - interval '14 days')
  ORDER BY (m.done_at IS NOT NULL), m.makeup_on, s.name
  LIMIT 300
$$;

-- Mark a make-up done. Calling it again keeps the first time.
CREATE FUNCTION public.finish_makeup(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := public.caller_studio();
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'you do not have access to a studio';
  END IF;
  UPDATE public.makeup_classes SET done_at = coalesce(done_at, now())
  WHERE id = p_id AND studio_id = v_studio;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'make-up not found';
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.caller_studio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.plan_makeup(uuid, date, uuid[], uuid, date),
  public.list_makeups(),
  public.finish_makeup(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.plan_makeup(uuid, date, uuid[], uuid, date),
  public.list_makeups(),
  public.finish_makeup(uuid)
TO authenticated, service_role;
