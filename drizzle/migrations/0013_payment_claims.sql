-- Payment claims: a dancer says they paid, through their private link. A claim is only a claim: it changes no
-- balance and no total until the studio confirms it, and the studio's own bank or UPI statement, matched by
-- reference number, is the source of truth. A confirmed claim becomes an ordinary ledger payment through the
-- same gate as any other payment. A screenshot is optional supporting evidence kept in a private bucket and
-- deleted once the claim is decided.

CREATE TABLE public.payment_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0 AND amount_paise <= 1000000000),
  method text NOT NULL CHECK (method IN ('cash', 'upi', 'bank', 'other')),
  reference text CHECK (reference IS NULL OR length(btrim(reference)) BETWEEN 1 AND 100),
  paid_on date NOT NULL,
  screenshot_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  decision_reason text CHECK (decision_reason IS NULL OR length(decision_reason) <= 500),
  decided_at timestamptz,
  payment_id uuid,
  confirmed_paise bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (method NOT IN ('upi', 'bank') OR reference IS NOT NULL),
  CHECK (status <> 'rejected' OR (decision_reason IS NOT NULL AND length(btrim(decision_reason)) > 0)),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id),
  FOREIGN KEY (studio_id, payment_id) REFERENCES public.payments (studio_id, id)
);
CREATE INDEX payment_claims_studio_idx ON public.payment_claims (studio_id, status, created_at);
CREATE INDEX payment_claims_guardian_idx ON public.payment_claims (guardian_id, status);

ALTER TABLE public.payment_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_claims TO service_role;
GRANT SELECT ON public.payment_claims TO authenticated;
CREATE POLICY "Studio reads own payment_claims" ON public.payment_claims FOR SELECT TO authenticated USING (studio_id = auth.uid());

-- A private bucket the browser cannot read or write: uploads use a signed URL issued after the link is
-- checked, and the owner views through a short-lived signed URL. Only PNG, JPEG and WebP up to 5 MB.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('claim-screenshots', 'claim-screenshots', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Called only by the public server function, after it has checked the family link. The dancer must belong to
-- the link's contact, the date cannot be in the future, UPI and bank payments need a reference number, and a
-- contact can have at most five claims waiting. The limit is enforced here, under a lock, not in the browser.
CREATE FUNCTION public.submit_payment_claim(
  p_guardian uuid, p_student uuid, p_amount_paise bigint, p_method text, p_paid_on date, p_reference text DEFAULT NULL
)
RETURNS public.payment_claims
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_row public.payment_claims;
  v_reference text := nullif(btrim(p_reference), '');
BEGIN
  SELECT s.studio_id INTO v_studio
  FROM public.students s
  WHERE s.id = p_student AND s.guardian_id = p_guardian AND s.archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that dancer is not on this link';
  END IF;
  IF p_paid_on > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'the payment date cannot be in the future';
  END IF;
  IF p_method IN ('upi', 'bank') AND v_reference IS NULL THEN
    RAISE EXCEPTION 'enter the reference number for a UPI or bank payment';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_guardian::text));
  IF (SELECT count(*) FROM public.payment_claims WHERE guardian_id = p_guardian AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'five payments are already waiting to be checked; the studio needs to review them first';
  END IF;

  INSERT INTO public.payment_claims (studio_id, student_id, guardian_id, amount_paise, method, reference, paid_on)
  VALUES (v_studio, p_student, p_guardian, p_amount_paise, p_method, v_reference, p_paid_on)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- The owner confirms a claim, optionally for a different amount than claimed. It becomes a ledger payment through
-- record_payment (so the amount-versus-owed gate applies), using the claim id as the idempotency key, so
-- confirming twice records one payment. Runs with definer rights, scoped to the caller's own studio.
CREATE FUNCTION public.confirm_payment_claim(
  p_claim uuid, p_amount_paise bigint DEFAULT NULL, p_acknowledge_excess boolean DEFAULT false
)
RETURNS public.payment_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.payment_claims;
  v_payment public.payments;
  v_amount bigint;
BEGIN
  SELECT * INTO v_claim FROM public.payment_claims WHERE id = p_claim AND studio_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim not found';
  END IF;
  IF v_claim.status = 'confirmed' THEN
    RETURN v_claim;
  END IF;
  IF v_claim.status = 'rejected' THEN
    RAISE EXCEPTION 'this claim was rejected and can no longer be confirmed';
  END IF;

  v_amount := coalesce(p_amount_paise, v_claim.amount_paise);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'the amount must be above zero';
  END IF;
  SELECT * INTO v_payment FROM public.record_payment(
    v_claim.student_id, v_amount, v_claim.method, v_claim.paid_on, 'Confirmed from a payment claim',
    'claim:' || v_claim.id::text, v_claim.reference, p_acknowledge_excess
  );
  UPDATE public.payment_claims
  SET status = 'confirmed', payment_id = v_payment.id, confirmed_paise = v_amount, decided_at = now()
  WHERE id = v_claim.id
  RETURNING * INTO v_claim;
  RETURN v_claim;
END $$;

-- The owner rejects a claim with a reason. Nothing else changes. Runs with definer rights, scoped to the caller.
CREATE FUNCTION public.reject_payment_claim(p_claim uuid, p_reason text)
RETURNS public.payment_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.payment_claims;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'a reason is required to reject a claim';
  END IF;
  SELECT * INTO v_claim FROM public.payment_claims WHERE id = p_claim AND studio_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim not found';
  END IF;
  IF v_claim.status <> 'pending' THEN
    RAISE EXCEPTION 'this claim has already been decided';
  END IF;
  UPDATE public.payment_claims
  SET status = 'rejected', decision_reason = btrim(p_reason), decided_at = now()
  WHERE id = v_claim.id
  RETURNING * INTO v_claim;
  RETURN v_claim;
END $$;

-- The To verify list: pending claims beside what the dancer owes, flagged as a possible duplicate when the
-- reference number is already on a live payment or on another pending claim. A rejected claim's reference is
-- free to use again. Runs with the caller's rights.
CREATE FUNCTION public.payment_claim_queue()
RETURNS TABLE (
  claim_id uuid,
  student_id uuid,
  student_name text,
  amount_paise bigint,
  method text,
  reference text,
  paid_on date,
  created_at timestamptz,
  has_screenshot boolean,
  owed_paise bigint,
  remaining_paise bigint,
  excess_paise bigint,
  possible_duplicate boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.student_id, s.name, c.amount_paise, c.method, c.reference, c.paid_on, c.created_at,
    c.screenshot_path IS NOT NULL, pc.owed_paise, pc.remaining_paise, pc.excess_paise,
    (c.reference IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.studio_id = c.studio_id AND p.voided_at IS NULL AND lower(btrim(p.reference)) = lower(btrim(c.reference))
      )
      OR EXISTS (
        SELECT 1 FROM public.payment_claims o
        WHERE o.studio_id = c.studio_id AND o.id <> c.id AND o.status = 'pending'
          AND lower(btrim(o.reference)) = lower(btrim(c.reference))
      )
    ))
  FROM public.payment_claims c
  JOIN public.students s ON s.id = c.student_id AND s.studio_id = c.studio_id
  CROSS JOIN LATERAL public.payment_check(c.student_id, c.amount_paise) pc
  WHERE c.status = 'pending'
  ORDER BY c.created_at
$$;

-- Screenshots that should no longer exist: those of decided claims, and of claims left pending past the
-- retention period. The purge job deletes them from storage and clears the path.
CREATE FUNCTION public.claim_screenshots_to_purge(p_days integer DEFAULT 30)
RETURNS TABLE (claim_id uuid, screenshot_path text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.screenshot_path
  FROM public.payment_claims c
  WHERE c.screenshot_path IS NOT NULL
    AND (c.status <> 'pending' OR c.created_at < now() - make_interval(days => p_days))
$$;

REVOKE ALL ON FUNCTION public.submit_payment_claim(uuid, uuid, bigint, text, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_claim(uuid, uuid, bigint, text, date, text) TO service_role;
REVOKE ALL ON FUNCTION public.claim_screenshots_to_purge(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_screenshots_to_purge(integer) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_payment_claim(uuid, bigint, boolean), public.reject_payment_claim(uuid, text), public.payment_claim_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment_claim(uuid, bigint, boolean), public.reject_payment_claim(uuid, text), public.payment_claim_queue() TO authenticated, service_role;
