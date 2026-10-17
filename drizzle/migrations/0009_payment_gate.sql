-- The payment gate. Every payment an owner records is compared with what the dancer owes: an exact amount
-- saves, a part payment leaves the rest owed, and a larger amount is refused until the caller acknowledges
-- the excess. The reference (for example a UPI transaction number) is stored beside the payment.

ALTER TABLE public.payments
  ADD COLUMN reference text CHECK (reference IS NULL OR length(btrim(reference)) BETWEEN 1 AND 100);

-- What is owed, what would still be owed after this amount, and how much of it would be excess. "Owed" is
-- everything charged minus everything paid (voided entries excluded) and never goes below zero. Runs with the
-- caller's rights, so another studio's dancer reads as owing nothing.
CREATE FUNCTION public.payment_check(p_student uuid, p_amount_paise bigint)
RETURNS TABLE (owed_paise bigint, remaining_paise bigint, excess_paise bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH t AS (
    SELECT greatest(0,
      coalesce((SELECT sum(c.amount_paise) FROM public.charges c WHERE c.student_id = p_student AND c.voided_at IS NULL), 0)
      - coalesce((SELECT sum(p.amount_paise) FROM public.payments p WHERE p.student_id = p_student AND p.voided_at IS NULL), 0)
    )::bigint AS owed
  )
  SELECT t.owed, greatest(0, t.owed - p_amount_paise)::bigint, greatest(0, p_amount_paise - t.owed)::bigint
  FROM t
$$;

-- Same arguments as before plus a reference and an excess acknowledgment, both optional, so a caller that
-- passes the original six still works. A repeated idempotency key returns the original payment without
-- running the gate again.
DROP FUNCTION public.record_payment(uuid, bigint, text, date, text, text);
CREATE FUNCTION public.record_payment(
  p_student uuid, p_amount_paise bigint, p_method text, p_paid_on date, p_note text, p_idempotency_key text,
  p_reference text DEFAULT NULL, p_acknowledge_excess boolean DEFAULT false
)
RETURNS public.payments
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_row public.payments;
  v_excess bigint;
  v_reference text := nullif(btrim(p_reference), '');
BEGIN
  SELECT studio_id INTO v_studio FROM public.students WHERE id = p_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;
  IF p_paid_on > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'the payment date cannot be in the future';
  END IF;

  SELECT * INTO v_row FROM public.payments WHERE studio_id = v_studio AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_row.student_id <> p_student OR v_row.amount_paise <> p_amount_paise OR v_row.paid_on <> p_paid_on THEN
      RAISE EXCEPTION 'that payment key was already used for a different payment';
    END IF;
    RETURN v_row;
  END IF;

  SELECT c.excess_paise INTO v_excess FROM public.payment_check(p_student, p_amount_paise) c;
  IF v_excess > 0 AND NOT coalesce(p_acknowledge_excess, false) THEN
    RAISE EXCEPTION 'this payment is more than what is owed; acknowledge the excess to save it';
  END IF;

  INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, note, idempotency_key, reference)
  VALUES (v_studio, p_student, p_amount_paise, p_method, p_paid_on, p_note, p_idempotency_key, v_reference)
  ON CONFLICT (studio_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    -- A concurrent call with the same key won the race; return its row.
    SELECT * INTO v_row FROM public.payments WHERE studio_id = v_studio AND idempotency_key = p_idempotency_key;
    IF v_row.student_id <> p_student OR v_row.amount_paise <> p_amount_paise OR v_row.paid_on <> p_paid_on THEN
      RAISE EXCEPTION 'that payment key was already used for a different payment';
    END IF;
  END IF;
  RETURN v_row;
END $$;

-- One dancer's charges with how much of each is settled, and the date and method of the payment that
-- completed it (payments applied oldest charge first, as the ledger does). Voided charges are listed and
-- marked but settle nothing.
CREATE FUNCTION public.student_charge_ledger(p_student uuid, p_today date DEFAULT NULL)
RETURNS TABLE (
  charge_id uuid,
  period date,
  due_on date,
  amount_paise bigint,
  allocated_paise bigint,
  outstanding_paise bigint,
  status text,
  fee_plan_name text,
  voided_at timestamptz,
  void_reason text,
  settled_on date,
  settled_method text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH live AS (
    SELECT c.*, coalesce(sum(c.amount_paise) OVER (
      ORDER BY c.due_on, c.period, c.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prior_paise
    FROM public.charges c
    WHERE c.student_id = p_student AND c.voided_at IS NULL
  ),
  paid AS (
    SELECT coalesce(sum(p.amount_paise), 0) AS total
    FROM public.payments p WHERE p.student_id = p_student AND p.voided_at IS NULL
  ),
  running AS (
    SELECT p.paid_on, p.method,
           sum(p.amount_paise) OVER (ORDER BY p.paid_on, p.created_at, p.id) AS cumulative_paise
    FROM public.payments p WHERE p.student_id = p_student AND p.voided_at IS NULL
  ),
  allocated AS (
    SELECT l.*, least(l.amount_paise, greatest(0, paid.total - l.prior_paise)) AS allocated_paise
    FROM live l CROSS JOIN paid
  )
  SELECT a.id, a.period, a.due_on, a.amount_paise, a.allocated_paise, a.amount_paise - a.allocated_paise,
    CASE
      WHEN a.amount_paise - a.allocated_paise = 0 THEN 'paid'
      WHEN a.due_on < coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date) THEN 'overdue'
      ELSE 'due'
    END,
    a.fee_plan_name, a.voided_at, a.void_reason,
    s.paid_on, s.method
  FROM allocated a
  LEFT JOIN LATERAL (
    SELECT r.paid_on, r.method FROM running r
    WHERE a.amount_paise - a.allocated_paise = 0 AND r.cumulative_paise >= a.prior_paise + a.amount_paise
    ORDER BY r.cumulative_paise LIMIT 1
  ) s ON true
  UNION ALL
  SELECT v.id, v.period, v.due_on, v.amount_paise, 0::bigint, 0::bigint, 'voided',
    v.fee_plan_name, v.voided_at, v.void_reason, NULL::date, NULL::text
  FROM public.charges v
  WHERE v.student_id = p_student AND v.voided_at IS NOT NULL
  ORDER BY 2 DESC, 1
$$;

REVOKE ALL ON FUNCTION public.payment_check(uuid, bigint), public.student_charge_ledger(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_check(uuid, bigint), public.student_charge_ledger(uuid, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_payment(uuid, bigint, text, date, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, bigint, text, date, text, text, text, boolean) TO authenticated, service_role;
