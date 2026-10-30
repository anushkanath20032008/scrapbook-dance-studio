-- A dancer with no fee plan at all still needs one, so they count as waiting for a fee for any month they were
-- already on the roster. A dancer whose plan starts later is not counted for earlier months.
CREATE OR REPLACE FUNCTION public.dancers_awaiting_fee(p_period date)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
  FROM public.students s
  WHERE s.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.charges c
      WHERE c.student_id = s.id AND c.period = p_period AND c.voided_at IS NULL
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.fee_plan_assignments a
        WHERE a.student_id = s.id AND a.studio_id = s.studio_id
          AND a.starts_on < (p_period + interval '1 month')::date
          AND (a.ends_on IS NULL OR a.ends_on >= p_period)
      )
      OR (
        NOT EXISTS (SELECT 1 FROM public.fee_plan_assignments a WHERE a.student_id = s.id AND a.studio_id = s.studio_id)
        AND s.created_at < (p_period + interval '1 month')
      )
    )
$$;
