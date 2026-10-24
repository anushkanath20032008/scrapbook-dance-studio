-- Each studio picks the day of the month its fees fall due (1 to 31; a day past the end of a short month
-- means the last day). It becomes the default due date for every monthly charge.
ALTER TABLE public.studio_profiles
  ADD COLUMN IF NOT EXISTS fee_due_day smallint NOT NULL DEFAULT 5 CHECK (fee_due_day BETWEEN 1 AND 31);
GRANT UPDATE (fee_due_day) ON public.studio_profiles TO authenticated;

-- The due date of a month's charge for a studio: its chosen day, or the last day of a shorter month.
CREATE OR REPLACE FUNCTION public.charge_due_date(p_period date, p_day integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT least(
    (date_trunc('month', p_period)::date + (greatest(1, least(p_day, 31)) - 1)),
    (date_trunc('month', p_period) + interval '1 month - 1 day')::date
  )
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_charges(p_period date, p_due_on date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_period date := p_period - (extract(day FROM p_period)::int - 1);
  v_due date;
  v_count integer;
BEGIN
  v_due := coalesce(
    p_due_on,
    public.charge_due_date(
      v_period,
      coalesce((SELECT fee_due_day FROM public.studio_profiles WHERE user_id = auth.uid()), 5)
    )
  );
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

-- One dancer's charges from the month their fee starts up to the current month (at most 12 months back), so
-- someone who joined earlier owes what the studio would have billed. Months already charged are left alone.
CREATE OR REPLACE FUNCTION public.generate_student_charges(p_student uuid, p_from date)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_this date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  v_month date;
  v_day integer;
  v_count integer := 0;
  v_added integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student) THEN
    RAISE EXCEPTION 'student not found';
  END IF;
  v_day := coalesce((SELECT fee_due_day FROM public.studio_profiles WHERE user_id = auth.uid()), 5);
  v_month := greatest(date_trunc('month', p_from)::date, (v_this - interval '11 months')::date);
  WHILE v_month <= v_this LOOP
    INSERT INTO public.charges (studio_id, student_id, period, due_on, amount_paise, fee_plan_id, fee_plan_name)
    SELECT a.studio_id, a.student_id, v_month, public.charge_due_date(v_month, v_day), a.amount_paise, a.fee_plan_id, fp.name
    FROM public.fee_plan_assignments a
    JOIN public.fee_plans fp ON fp.id = a.fee_plan_id AND fp.studio_id = a.studio_id
    JOIN public.students s ON s.id = a.student_id AND s.studio_id = a.studio_id
    WHERE a.student_id = p_student
      AND s.archived_at IS NULL
      AND a.starts_on < (v_month + interval '1 month')::date
      AND (a.ends_on IS NULL OR a.ends_on >= v_month)
    ORDER BY (a.starts_on <= v_month) DESC, a.starts_on ASC
    LIMIT 1
    ON CONFLICT (student_id, period) DO NOTHING;
    GET DIAGNOSTICS v_added = ROW_COUNT;
    v_count := v_count + v_added;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.charge_due_date(date, integer), public.generate_student_charges(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_due_date(date, integer), public.generate_student_charges(uuid, date) TO authenticated, service_role;
