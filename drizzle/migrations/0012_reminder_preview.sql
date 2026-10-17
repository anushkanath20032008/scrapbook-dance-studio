-- Reminders chosen by the owner's click. One function decides who would be messaged and why anyone is skipped;
-- both the preview the owner reviews and the queueing read it, so the list on screen is exactly what is sent.
--
-- Targets: for one dancer (p_student) their due or overdue charge for the month; for everyone, only the
-- overdue charges when p_only_overdue is true, otherwise due and overdue. Skipped, with the reason shown:
-- no contact record, opted out, no phone number, or already queued today. Runs with definer rights but is
-- scoped to the caller's own studio through auth.uid(), never to anyone else's dancers.

CREATE FUNCTION public.reminder_targets(
  p_period date, p_today date DEFAULT NULL, p_student uuid DEFAULT NULL, p_only_overdue boolean DEFAULT false
)
RETURNS TABLE (
  charge_id uuid,
  student_id uuid,
  student_name text,
  guardian_id uuid,
  contact_name text,
  phone text,
  outstanding_paise bigint,
  due_on date,
  period date,
  status text,
  kind text,
  dedupe_key text,
  skip_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS studio, coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) AS today
  ),
  scope AS (
    SELECT coalesce(array_agg(s.id), ARRAY[]::uuid[]) AS ids
    FROM public.students s, me
    WHERE s.studio_id = me.studio AND s.archived_at IS NULL AND (p_student IS NULL OR s.id = p_student)
  ),
  due AS (
    SELECT l.*, me.studio, me.today,
      CASE WHEN l.status = 'overdue' THEN 'fee_overdue' ELSE 'fee_due' END AS kind
    FROM me, scope, public.student_ledger_status(p_period, me.today, scope.ids) l
    WHERE l.status IN ('due', 'overdue') AND (NOT p_only_overdue OR l.status = 'overdue')
  )
  SELECT d.charge_id, d.student_id, d.student_name, g.id, g.name, g.phone, d.outstanding_paise, d.due_on, d.period,
    d.status, d.kind,
    format('fee:%s:%s:%s', d.charge_id, d.kind, d.today),
    CASE
      WHEN g.id IS NULL OR g.archived_at IS NOT NULL THEN 'no contact'
      WHEN g.reminders_opted_out THEN 'opted out'
      WHEN g.phone IS NULL THEN 'no phone'
      WHEN EXISTS (
        SELECT 1 FROM public.reminders r WHERE r.dedupe_key = format('fee:%s:%s:%s', d.charge_id, d.kind, d.today)
      ) THEN 'already queued today'
    END
  FROM due d
  JOIN public.students st ON st.id = d.student_id AND st.studio_id = d.studio
  LEFT JOIN public.guardians g ON g.id = st.guardian_id AND g.studio_id = d.studio
$$;

-- What the owner reviews before anything is queued: recipient, phone, amount and whether they would be skipped.
CREATE FUNCTION public.preview_fee_reminders(
  p_period date, p_today date DEFAULT NULL, p_student uuid DEFAULT NULL, p_only_overdue boolean DEFAULT false
)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  phone text,
  outstanding_paise bigint,
  due_on date,
  status text,
  skip_reason text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT t.student_id, t.student_name, t.phone, t.outstanding_paise, t.due_on, t.status, t.skip_reason
  FROM public.reminder_targets(p_period, p_today, p_student, p_only_overdue) t
  ORDER BY t.due_on, t.student_name
$$;

-- The same arguments as before plus the optional student and overdue-only choice, so existing two-argument
-- callers still queue every due or overdue charge. Dancers with no phone number are now skipped.
DROP FUNCTION public.queue_fee_reminders(date, date);
CREATE FUNCTION public.queue_fee_reminders(
  p_period date, p_today date DEFAULT NULL, p_student uuid DEFAULT NULL, p_only_overdue boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_count integer;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  INSERT INTO public.reminders (studio_id, guardian_id, student_id, charge_id, kind, template_name, payload, dedupe_key)
  SELECT v_studio, t.guardian_id, t.student_id, t.charge_id, t.kind,
    CASE WHEN t.kind = 'fee_overdue' THEN 'fee_overdue_reminder' ELSE 'fee_due_reminder' END,
    jsonb_build_object(
      'studio_name', sp.studio_name,
      'guardian_name', t.contact_name,
      'student_name', t.student_name,
      'amount_paise', t.outstanding_paise,
      'due_on', t.due_on,
      'period', t.period
    ),
    t.dedupe_key
  FROM public.reminder_targets(p_period, v_today, p_student, p_only_overdue) t
  JOIN public.studio_profiles sp ON sp.user_id = v_studio
  WHERE t.skip_reason IS NULL
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.reminder_targets(date, date, uuid, boolean), public.preview_fee_reminders(date, date, uuid, boolean), public.queue_fee_reminders(date, date, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reminder_targets(date, date, uuid, boolean), public.preview_fee_reminders(date, date, uuid, boolean), public.queue_fee_reminders(date, date, uuid, boolean) TO authenticated, service_role;
