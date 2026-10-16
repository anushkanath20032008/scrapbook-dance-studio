-- Attendance, and the fee ledger. The ledger is ledger-only: it records what the studio charged and what
-- the studio says it received outside ChoreoStudio. Amounts are whole paise. Charges and payments are
-- immutable for owners except for voiding, and nothing is deleted.

CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  session_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, id),
  UNIQUE (batch_id, session_on),
  FOREIGN KEY (studio_id, batch_id) REFERENCES public.batches (studio_id, id)
);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  present boolean NOT NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id),
  FOREIGN KEY (studio_id, session_id) REFERENCES public.class_sessions (studio_id, id),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id)
);
CREATE INDEX attendance_records_student_idx ON public.attendance_records (studio_id, student_id);

CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  due_on date NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  fee_plan_id uuid,
  fee_plan_name text NOT NULL,
  voided_at timestamptz,
  void_reason text CHECK (void_reason IS NULL OR length(void_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_on >= period),
  CHECK (void_reason IS NULL OR voided_at IS NOT NULL),
  UNIQUE (studio_id, id),
  UNIQUE (student_id, period),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id),
  FOREIGN KEY (studio_id, fee_plan_id) REFERENCES public.fee_plans (studio_id, id)
);
CREATE INDEX charges_period_idx ON public.charges (studio_id, period);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  method text NOT NULL CHECK (method IN ('cash', 'upi', 'bank', 'other')),
  paid_on date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 100),
  voided_at timestamptz,
  void_reason text CHECK (void_reason IS NULL OR length(void_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (void_reason IS NULL OR voided_at IS NOT NULL),
  UNIQUE (studio_id, id),
  UNIQUE (studio_id, idempotency_key),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id)
);
CREATE INDEX payments_student_idx ON public.payments (studio_id, student_id, paid_on);

-- Voiding is the only change an owner may make to the ledger, and it can happen once, with a reason.
CREATE FUNCTION public.guard_ledger_void() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'this entry is already voided';
  END IF;
  IF NEW.voided_at IS NOT NULL AND (NEW.void_reason IS NULL OR length(btrim(NEW.void_reason)) = 0) THEN
    RAISE EXCEPTION 'a reason is required to void an entry';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER charges_void_guard BEFORE UPDATE ON public.charges FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_void();
CREATE TRIGGER payments_void_guard BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_void();

-- Row-level security and grants (Supabase grants everything by default, so revoke first).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['class_sessions', 'attendance_records', 'charges', 'payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (studio_id = auth.uid())', 'Studio reads own ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (studio_id = auth.uid())', 'Studio creates own ' || t, t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE ON public.class_sessions, public.attendance_records TO authenticated;
GRANT SELECT, INSERT ON public.charges, public.payments TO authenticated;
GRANT UPDATE (voided_at, void_reason) ON public.charges, public.payments TO authenticated;
CREATE POLICY "Studio edits own class_sessions" ON public.class_sessions FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio edits own attendance_records" ON public.attendance_records FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio voids own charges" ON public.charges FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio voids own payments" ON public.payments FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());

-- Create one charge per student with a fee plan covering the month. Running it again creates nothing, and
-- a voided charge is not recreated. The plan in effect on the first of the month is used; a plan that
-- starts later in the month (a new joiner) is used when there is none earlier. Runs with the caller's rights.
CREATE FUNCTION public.generate_monthly_charges(p_period date, p_due_on date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_period date := p_period - (extract(day FROM p_period)::int - 1);
  v_due date;
  v_count integer;
BEGIN
  v_due := coalesce(p_due_on, v_period + 4);
  IF v_due < v_period THEN
    RAISE EXCEPTION 'the due date cannot be before the month it bills';
  END IF;
  INSERT INTO public.charges (studio_id, student_id, period, due_on, amount_paise, fee_plan_id, fee_plan_name)
  SELECT DISTINCT ON (a.student_id) a.studio_id, a.student_id, v_period, v_due, a.amount_paise, a.fee_plan_id, fp.name
  FROM public.fee_plan_assignments a
  JOIN public.fee_plans fp ON fp.id = a.fee_plan_id AND fp.studio_id = a.studio_id
  JOIN public.students s ON s.id = a.student_id AND s.studio_id = a.studio_id
  WHERE s.archived_at IS NULL
    AND a.starts_on < (v_period + interval '1 month')::date
    AND (a.ends_on IS NULL OR a.ends_on >= v_period)
  ORDER BY a.student_id, (a.starts_on <= v_period) DESC, a.starts_on ASC
  ON CONFLICT (student_id, period) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Each student's charge for the month, with payments applied oldest-charge-first across all of the
-- student's charges. "Today" defaults to the current date in India. The optional student list scopes the
-- computation inside SQL, so a caller that bypasses row-level security (the family view) cannot over-read.
-- balance_paise is the student's total charged minus total paid over all time; negative means credit.
CREATE FUNCTION public.student_ledger_status(p_period date, p_today date DEFAULT NULL, p_student_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  charge_id uuid,
  period date,
  due_on date,
  amount_paise bigint,
  allocated_paise bigint,
  outstanding_paise bigint,
  status text,
  fee_plan_name text,
  balance_paise bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT s.id, s.name FROM public.students s WHERE p_student_ids IS NULL OR s.id = ANY (p_student_ids)
  ),
  ordered AS (
    SELECT c.*, coalesce(sum(c.amount_paise) OVER (
      PARTITION BY c.student_id ORDER BY c.due_on, c.period, c.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prior_paise
    FROM public.charges c
    JOIN scoped ON scoped.id = c.student_id
    WHERE c.voided_at IS NULL
  ),
  paid AS (
    SELECT p.student_id, sum(p.amount_paise) AS paid_paise
    FROM public.payments p
    JOIN scoped ON scoped.id = p.student_id
    WHERE p.voided_at IS NULL
    GROUP BY p.student_id
  ),
  totals AS (
    SELECT o.student_id, sum(o.amount_paise) AS charged_paise FROM ordered o GROUP BY o.student_id
  ),
  allocated AS (
    SELECT o.*, scoped.name AS student_name,
      least(o.amount_paise, greatest(0, coalesce(paid.paid_paise, 0) - o.prior_paise)) AS allocated_paise,
      coalesce(totals.charged_paise, 0) - coalesce(paid.paid_paise, 0) AS balance_paise
    FROM ordered o
    JOIN scoped ON scoped.id = o.student_id
    LEFT JOIN paid ON paid.student_id = o.student_id
    LEFT JOIN totals ON totals.student_id = o.student_id
  )
  SELECT a.student_id, a.student_name, a.id, a.period, a.due_on, a.amount_paise, a.allocated_paise,
    a.amount_paise - a.allocated_paise,
    CASE
      WHEN a.amount_paise - a.allocated_paise = 0 THEN 'paid'
      WHEN a.due_on < coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) THEN 'overdue'
      ELSE 'due'
    END,
    a.fee_plan_name,
    a.balance_paise
  FROM allocated a
  WHERE a.period = p_period - (extract(day FROM p_period)::int - 1)
$$;

-- Totals for a month from the same function, so the overview and the list cannot disagree.
-- "Pending" means due or overdue; overdue is a subset of pending.
CREATE FUNCTION public.ledger_overview(p_period date, p_today date DEFAULT NULL)
RETURNS TABLE (
  billed_paise bigint,
  collected_paise bigint,
  outstanding_paise bigint,
  pending_students integer,
  overdue_students integer,
  total_students integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    coalesce(sum(l.amount_paise), 0)::bigint,
    coalesce(sum(l.allocated_paise), 0)::bigint,
    coalesce(sum(l.outstanding_paise), 0)::bigint,
    (count(*) FILTER (WHERE l.status IN ('due', 'overdue')))::integer,
    (count(*) FILTER (WHERE l.status = 'overdue'))::integer,
    count(*)::integer
  FROM public.student_ledger_status(p_period, p_today, NULL) l
$$;

REVOKE ALL ON FUNCTION public.generate_monthly_charges(date, date), public.student_ledger_status(date, date, uuid[]), public.ledger_overview(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_charges(date, date), public.student_ledger_status(date, date, uuid[]), public.ledger_overview(date, date) TO authenticated, service_role;

-- Record a payment the studio received outside ChoreoStudio. A repeated idempotency key returns the original
-- row, so a double click or a retry is recorded once; reusing a key for a different payment is refused.
CREATE FUNCTION public.record_payment(
  p_student uuid, p_amount_paise bigint, p_method text, p_paid_on date, p_note text, p_idempotency_key text
)
RETURNS public.payments
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_row public.payments;
BEGIN
  SELECT studio_id INTO v_studio FROM public.students WHERE id = p_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;
  IF p_paid_on > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'the payment date cannot be in the future';
  END IF;
  INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, note, idempotency_key)
  VALUES (v_studio, p_student, p_amount_paise, p_method, p_paid_on, p_note, p_idempotency_key)
  ON CONFLICT (studio_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.payments WHERE studio_id = v_studio AND idempotency_key = p_idempotency_key;
    IF v_row.student_id <> p_student OR v_row.amount_paise <> p_amount_paise OR v_row.paid_on <> p_paid_on THEN
      RAISE EXCEPTION 'that payment key was already used for a different payment';
    END IF;
  END IF;
  RETURN v_row;
END $$;

-- Mark a batch's attendance for a day in one atomic call. Every student must be on the roster that day, or
-- nothing is written. p_marks is a JSON array of {student_id, present}. The date must be within a year back
-- and a week ahead of today in India.
CREATE FUNCTION public.mark_attendance(p_batch uuid, p_session_on date, p_marks jsonb)
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
  ON CONFLICT (batch_id, session_on) DO UPDATE SET session_on = EXCLUDED.session_on
  RETURNING id INTO v_session;

  INSERT INTO public.attendance_records (studio_id, session_id, student_id, present)
  SELECT v_studio, v_session, m.student_id, m.present
  FROM jsonb_to_recordset(p_marks) AS m(student_id uuid, present boolean)
  ON CONFLICT (session_id, student_id) DO UPDATE SET present = EXCLUDED.present, marked_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- A batch's roster for one day with each student's mark (null when not yet marked).
CREATE FUNCTION public.batch_day(p_batch uuid, p_on date)
RETURNS TABLE (student_id uuid, student_name text, present boolean)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.name, ar.present
  FROM public.batch_members bm
  JOIN public.students s ON s.id = bm.student_id AND s.studio_id = bm.studio_id
  LEFT JOIN public.class_sessions cs ON cs.batch_id = bm.batch_id AND cs.session_on = p_on
  LEFT JOIN public.attendance_records ar ON ar.session_id = cs.id AND ar.student_id = s.id
  WHERE bm.batch_id = p_batch AND bm.joined_on <= p_on AND (bm.left_on IS NULL OR bm.left_on >= p_on)
  ORDER BY s.name
$$;

REVOKE ALL ON FUNCTION public.record_payment(uuid, bigint, text, date, text, text), public.mark_attendance(uuid, date, jsonb), public.batch_day(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, bigint, text, date, text, text), public.mark_attendance(uuid, date, jsonb), public.batch_day(uuid, date) TO authenticated, service_role;

-- A student's attendance marks across batches for a date range of at most a year, newest first.
CREATE FUNCTION public.student_attendance(p_student uuid, p_from date, p_to date)
RETURNS TABLE (session_on date, batch_id uuid, batch_name text, present boolean)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_to < p_from THEN
    RAISE EXCEPTION 'the end date cannot be before the start date';
  END IF;
  IF p_to - p_from > 366 THEN
    RAISE EXCEPTION 'choose a range of at most one year';
  END IF;
  RETURN QUERY
  SELECT cs.session_on, cs.batch_id, b.name, ar.present
  FROM public.attendance_records ar
  JOIN public.class_sessions cs ON cs.id = ar.session_id AND cs.studio_id = ar.studio_id
  JOIN public.batches b ON b.id = cs.batch_id AND b.studio_id = cs.studio_id
  WHERE ar.student_id = p_student AND cs.session_on BETWEEN p_from AND p_to
  ORDER BY cs.session_on DESC, b.name;
END $$;
REVOKE ALL ON FUNCTION public.student_attendance(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_attendance(uuid, date, date) TO authenticated, service_role;
