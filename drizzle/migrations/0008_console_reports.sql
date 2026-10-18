-- Reports behind the console's Home screen. Both are built on student_ledger_status, the same function the
-- family view and the ledger overview use, so the owner's numbers cannot disagree with anyone else's.
-- They run with the caller's rights, so row-level security limits them to the caller's own studio.

-- Everyone who still owes money for the month, oldest overdue first. days_overdue counts calendar days from
-- the due date in India time with no grace period, and is zero on the due date.
CREATE FUNCTION public.unpaid_students(p_period date, p_today date DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  charge_id uuid,
  due_on date,
  amount_paise bigint,
  outstanding_paise bigint,
  days_overdue integer,
  status text,
  phone text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.student_id, r.student_name, r.charge_id, r.due_on, r.amount_paise, r.outstanding_paise,
         r.days_overdue, r.status, r.phone
  FROM (
    SELECT l.student_id, l.student_name, l.charge_id, l.due_on, l.amount_paise, l.outstanding_paise,
           greatest(0, coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) - l.due_on)::integer AS days_overdue,
           l.status, g.phone
    FROM public.student_ledger_status(p_period, p_today, NULL) l
    JOIN public.students s ON s.id = l.student_id
    LEFT JOIN public.guardians g ON g.id = s.guardian_id AND g.studio_id = s.studio_id
    WHERE l.outstanding_paise > 0
  ) r
  ORDER BY r.days_overdue DESC, r.due_on, r.student_name
$$;

-- The month in numbers: billed, collected, and what is missing split into overdue and not yet due, plus
-- how many dancers are active, charged and paid, and how many batches are running.
CREATE FUNCTION public.studio_snapshot(p_period date, p_today date DEFAULT NULL)
RETURNS TABLE (
  billed_paise bigint,
  collected_paise bigint,
  missing_paise bigint,
  overdue_paise bigint,
  not_yet_due_paise bigint,
  active_students integer,
  charged_students integer,
  paid_students integer,
  ongoing_batches integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH l AS (SELECT * FROM public.student_ledger_status(p_period, p_today, NULL))
  SELECT
    coalesce(sum(l.amount_paise), 0)::bigint,
    coalesce(sum(l.allocated_paise), 0)::bigint,
    coalesce(sum(l.outstanding_paise), 0)::bigint,
    coalesce(sum(l.outstanding_paise) FILTER (WHERE l.status = 'overdue'), 0)::bigint,
    coalesce(sum(l.outstanding_paise) FILTER (WHERE l.status = 'due'), 0)::bigint,
    (SELECT count(*) FROM public.students WHERE archived_at IS NULL)::integer,
    count(*)::integer,
    (count(*) FILTER (WHERE l.status = 'paid'))::integer,
    (SELECT count(*) FROM public.batches WHERE archived_at IS NULL)::integer
  FROM l
$$;

REVOKE ALL ON FUNCTION public.unpaid_students(date, date), public.studio_snapshot(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unpaid_students(date, date), public.studio_snapshot(date, date) TO authenticated, service_role;
