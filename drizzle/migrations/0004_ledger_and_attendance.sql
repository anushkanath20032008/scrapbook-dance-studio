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
