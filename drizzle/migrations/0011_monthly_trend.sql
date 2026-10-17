-- The month-by-month trend: billed, collected and missing per charge month for the last N months (default
-- six, at most 24), oldest first, with zero rows for months that have no charges. Payments are applied to a
-- dancer's charges oldest first, exactly as student_ledger_status does, so a payment made in a later month
-- counts as collected for the charge month it settled and each month agrees with the Home screen.
-- Voided charges and payments are excluded. Runs with the caller's rights.
CREATE FUNCTION public.monthly_trend(p_months integer DEFAULT 6, p_today date DEFAULT NULL)
RETURNS TABLE (period date, billed_paise bigint, collected_paise bigint, missing_paise bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH this_month AS (
    SELECT date_trunc('month', coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date))::date AS first_day
  ),
  months AS (
    SELECT (t.first_day - make_interval(months => g))::date AS period
    FROM this_month t, generate_series(0, greatest(1, least(coalesce(p_months, 6), 24)) - 1) AS g
  ),
  ordered AS (
    SELECT c.student_id, c.period, c.amount_paise,
      coalesce(sum(c.amount_paise) OVER (
        PARTITION BY c.student_id ORDER BY c.due_on, c.period, c.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS prior_paise
    FROM public.charges c
    WHERE c.voided_at IS NULL
  ),
  paid AS (
    SELECT p.student_id, sum(p.amount_paise) AS paid_paise
    FROM public.payments p
    WHERE p.voided_at IS NULL
    GROUP BY p.student_id
  ),
  allocated AS (
    SELECT o.period, o.amount_paise,
      least(o.amount_paise, greatest(0, coalesce(p.paid_paise, 0) - o.prior_paise)) AS allocated_paise
    FROM ordered o
    LEFT JOIN paid p ON p.student_id = o.student_id
  )
  SELECT m.period,
    coalesce(sum(a.amount_paise), 0)::bigint,
    coalesce(sum(a.allocated_paise), 0)::bigint,
    coalesce(sum(a.amount_paise - a.allocated_paise), 0)::bigint
  FROM months m
  LEFT JOIN allocated a ON a.period = m.period
  GROUP BY m.period
  ORDER BY m.period
$$;

REVOKE ALL ON FUNCTION public.monthly_trend(integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_trend(integer, date) TO authenticated, service_role;
