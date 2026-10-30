-- Overview is one month at a time, so money still owed from earlier months was invisible. earlier_arrears totals,
-- per dancer, what is still unpaid for months before p_period. dancers_awaiting_fee counts dancers whose fee plan
-- covers p_period but who have no charge for it yet, so a dancer who joined later is not counted.
CREATE OR REPLACE FUNCTION public.earlier_arrears(p_period date, p_today date DEFAULT NULL)
RETURNS TABLE(student_id uuid, outstanding_paise bigint, months integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT l.student_id, sum(l.outstanding_paise)::bigint, count(*)::integer
  FROM (SELECT DISTINCT c.period FROM public.charges c WHERE c.period < p_period AND c.voided_at IS NULL) p
  CROSS JOIN LATERAL public.student_ledger_status(p.period, p_today, NULL) l
  JOIN public.students s ON s.id = l.student_id
  WHERE l.outstanding_paise > 0 AND s.archived_at IS NULL
  GROUP BY l.student_id
$$;

CREATE OR REPLACE FUNCTION public.dancers_awaiting_fee(p_period date)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT count(DISTINCT a.student_id)::integer
  FROM public.fee_plan_assignments a
  JOIN public.students s ON s.id = a.student_id AND s.studio_id = a.studio_id
  WHERE s.archived_at IS NULL
    AND a.starts_on < (p_period + interval '1 month')::date
    AND (a.ends_on IS NULL OR a.ends_on >= p_period)
    AND NOT EXISTS (
      SELECT 1 FROM public.charges c
      WHERE c.student_id = a.student_id AND c.period = p_period AND c.voided_at IS NULL
    )
$$;

GRANT EXECUTE ON FUNCTION public.earlier_arrears(date, date), public.dancers_awaiting_fee(date) TO authenticated;
