-- What each studio is owed this month, for the daily owner nudge email. It reads across studios, so only
-- the server (service role) may call it; owners and anonymous callers cannot.
CREATE FUNCTION public.owner_nudge_summary(p_today date DEFAULT NULL)
RETURNS TABLE (
  studio_id uuid,
  unpaid_count integer,
  outstanding_paise bigint,
  due_today_count integer,
  overdue_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT st.studio_id,
    count(*)::integer,
    sum(l.outstanding_paise)::bigint,
    (count(*) FILTER (WHERE l.due_on = x.d))::integer,
    (count(*) FILTER (WHERE l.status = 'overdue'))::integer
  FROM (SELECT coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) AS d) x,
    LATERAL public.student_ledger_status(date_trunc('month', x.d)::date, x.d, NULL) l
    JOIN public.students st ON st.id = l.student_id
  WHERE l.outstanding_paise > 0
  GROUP BY st.studio_id
$$;

REVOKE ALL ON FUNCTION public.owner_nudge_summary(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_nudge_summary(date) TO service_role;
