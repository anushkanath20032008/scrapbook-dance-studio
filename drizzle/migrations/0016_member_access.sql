-- Member portal: a dancer signs in with their own account and sees only their own record at the studios they
-- belong to. An owner invites a dancer (link plus short code, 7 days by default, single use, revocable); the
-- dancer redeems it while signed in, which attaches their account to that one dancer record. Dancers are
-- adults and are their own contact, so a membership points at the dancer's guardians row (the studio's
-- contact record for that person) and nothing else.
--
-- Access is derived from member_links alone: no link, no rows. Members get no table privileges and no row
-- policies at all; every member read and write goes through the SECURITY DEFINER functions below, which
-- start from auth.uid() and the caller's active links. That is stricter than a set of member SELECT
-- policies and cannot widen an owner policy by union. Invite secrets are stored only as SHA-256.

CREATE TABLE public.member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id)
);
CREATE INDEX member_invites_guardian_idx ON public.member_invites (studio_id, guardian_id, created_at DESC);

CREATE TABLE public.member_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id)
);
-- One live login per dancer record. A removed membership stays as history; a later invite makes a new row.
CREATE UNIQUE INDEX member_links_one_live_per_dancer_idx ON public.member_links (studio_id, guardian_id) WHERE revoked_at IS NULL;
CREATE INDEX member_links_user_idx ON public.member_links (user_id) WHERE revoked_at IS NULL;

-- Failed redemption attempts, for throttling. Written only by redeem_member_invite.
CREATE TABLE public.invite_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  source_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invite_attempts_user_idx ON public.invite_attempts (user_id, attempted_at);
CREATE INDEX invite_attempts_source_idx ON public.invite_attempts (source_hash, attempted_at) WHERE source_hash IS NOT NULL;

CREATE FUNCTION public.guard_member_revoke() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'this is revoked and cannot be restored';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER member_invites_revoke_guard BEFORE UPDATE ON public.member_invites FOR EACH ROW EXECUTE FUNCTION public.guard_member_revoke();
CREATE TRIGGER member_links_revoke_guard BEFORE UPDATE ON public.member_links FOR EACH ROW EXECUTE FUNCTION public.guard_member_revoke();

ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_invites, public.member_links, public.invite_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.member_invites, public.member_links, public.invite_attempts TO service_role;
-- Owners see status only: never the hashes, and never which account a membership belongs to.
GRANT SELECT (id, studio_id, guardian_id, expires_at, redeemed_at, revoked_at, created_at) ON public.member_invites TO authenticated;
GRANT SELECT (id, studio_id, guardian_id, revoked_at, created_at) ON public.member_links TO authenticated;
GRANT UPDATE (revoked_at) ON public.member_invites, public.member_links TO authenticated;
CREATE POLICY "Studio reads own member_invites" ON public.member_invites FOR SELECT TO authenticated USING (studio_id = auth.uid());
CREATE POLICY "Studio revokes own member_invites" ON public.member_invites FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio reads own member_links" ON public.member_links FOR SELECT TO authenticated USING (studio_id = auth.uid());
CREATE POLICY "Studio revokes own member_links" ON public.member_links FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());

-- Claims now record which door they came through.
ALTER TABLE public.payment_claims
  ADD COLUMN submitted_via text NOT NULL DEFAULT 'link' CHECK (submitted_via IN ('link', 'member'));

-- Create an invite for one of the caller's dancers. The server generates the secrets and passes only their
-- hashes. Issuing a new invite revokes the dancer's older pending ones, so at most one is ever open. A dancer
-- who already has a login must have it removed first.
CREATE FUNCTION public.create_member_invite(p_guardian uuid, p_days integer, p_token_hash text, p_code_hash text)
RETURNS TABLE (id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_days NOT IN (1, 7, 30) THEN
    RAISE EXCEPTION 'choose 1, 7 or 30 days';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.guardians g WHERE g.id = p_guardian AND g.studio_id = v_studio AND g.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'that dancer was not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.member_links l WHERE l.studio_id = v_studio AND l.guardian_id = p_guardian AND l.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'this dancer already has a login; remove their access before inviting again';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_guardian::text));
  IF (SELECT count(*) FROM public.member_invites i WHERE i.studio_id = v_studio AND i.guardian_id = p_guardian AND i.created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'too many invites for this dancer just now; try again in an hour';
  END IF;
  UPDATE public.member_invites i SET revoked_at = now()
  WHERE i.studio_id = v_studio AND i.guardian_id = p_guardian AND i.redeemed_at IS NULL AND i.revoked_at IS NULL;
  RETURN QUERY
  INSERT INTO public.member_invites (studio_id, guardian_id, token_hash, code_hash, expires_at)
  VALUES (v_studio, p_guardian, p_token_hash, p_code_hash, now() + make_interval(days => p_days))
  RETURNING member_invites.id, member_invites.expires_at;
END $$;

-- Attach the caller's account to the dancer record an invite was made for. The secret is the long link token
-- (43 characters) or the short code (8 characters, dashes and case ignored). Every failure returns NULL, so
-- nothing about the studio or dancer is revealed and the failed attempt can still be recorded for the
-- throttle: five failures a minute or twenty an hour, counted per account and per source.
CREATE FUNCTION public.redeem_member_invite(p_secret text, p_source text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_source text := nullif(left(btrim(coalesce(p_source, '')), 100), '');
  v_secret text := btrim(coalesce(p_secret, ''));
  v_code text := upper(regexp_replace(coalesce(p_secret, ''), '[\s-]', '', 'g'));
  v_invite public.member_invites;
  v_studio_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  DELETE FROM public.invite_attempts WHERE attempted_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.invite_attempts a
      WHERE a.attempted_at > now() - interval '1 minute' AND (a.user_id = v_user OR (v_source IS NOT NULL AND a.source_hash = v_source))) >= 5
     OR (SELECT count(*) FROM public.invite_attempts a
      WHERE a.attempted_at > now() - interval '1 hour' AND (a.user_id = v_user OR (v_source IS NOT NULL AND a.source_hash = v_source))) >= 20 THEN
    RETURN NULL;
  END IF;

  IF length(v_secret) = 43 THEN
    SELECT * INTO v_invite FROM public.member_invites i
    WHERE i.token_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex') FOR UPDATE;
  ELSIF length(v_code) = 8 THEN
    SELECT * INTO v_invite FROM public.member_invites i
    WHERE i.code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex') FOR UPDATE;
  END IF;

  IF v_invite.id IS NULL
     OR v_invite.redeemed_at IS NOT NULL
     OR v_invite.revoked_at IS NOT NULL
     OR v_invite.expires_at <= now()
     OR NOT EXISTS (
       SELECT 1 FROM public.guardians g
       WHERE g.id = v_invite.guardian_id AND g.studio_id = v_invite.studio_id AND g.archived_at IS NULL)
     OR EXISTS (
       SELECT 1 FROM public.member_links l
       WHERE l.studio_id = v_invite.studio_id AND l.guardian_id = v_invite.guardian_id AND l.revoked_at IS NULL) THEN
    INSERT INTO public.invite_attempts (user_id, source_hash) VALUES (v_user, v_source);
    RETURN NULL;
  END IF;

  INSERT INTO public.member_links (user_id, studio_id, guardian_id)
  VALUES (v_user, v_invite.studio_id, v_invite.guardian_id);
  UPDATE public.member_invites SET redeemed_at = now(), redeemed_by = v_user WHERE id = v_invite.id;
  SELECT sp.studio_name INTO v_studio_name FROM public.studio_profiles sp WHERE sp.user_id = v_invite.studio_id;
  RETURN coalesce(v_studio_name, 'your studio');
END $$;

-- The studios the caller belongs to (one row per studio), with the studio's name and nothing else.
CREATE FUNCTION public.member_studios()
RETURNS TABLE (studio_id uuid, studio_name text, joined_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.studio_id, coalesce(sp.studio_name, 'Your studio'), min(l.created_at)
  FROM public.member_links l
  JOIN public.guardians g ON g.id = l.guardian_id AND g.studio_id = l.studio_id AND g.archived_at IS NULL
  JOIN public.studio_profiles sp ON sp.user_id = l.studio_id
  WHERE l.user_id = auth.uid() AND l.revoked_at IS NULL
  GROUP BY l.studio_id, sp.studio_name
  ORDER BY min(l.created_at)
$$;

-- What a dancer sees at one studio: the same fixed shape as the family link, with statuses from the same
-- student_ledger_status function the studio uses. NULL when the caller has no live membership there.
CREATE FUNCTION public.member_view(p_studio uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardians uuid[];
  v_students uuid[];
  v_result jsonb;
BEGIN
  SELECT coalesce(array_agg(l.guardian_id), ARRAY[]::uuid[]) INTO v_guardians
  FROM public.member_links l
  JOIN public.guardians g ON g.id = l.guardian_id AND g.studio_id = l.studio_id AND g.archived_at IS NULL
  WHERE l.user_id = auth.uid() AND l.studio_id = p_studio AND l.revoked_at IS NULL;
  IF cardinality(v_guardians) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(array_agg(s.id), ARRAY[]::uuid[]) INTO v_students
  FROM public.students s
  WHERE s.studio_id = p_studio AND s.guardian_id = ANY (v_guardians) AND s.archived_at IS NULL;

  SELECT jsonb_build_object(
    'studio_name', (SELECT sp.studio_name FROM public.studio_profiles sp WHERE sp.user_id = p_studio),
    'guardian_name', (SELECT string_agg(g.name, ', ' ORDER BY g.name) FROM public.guardians g WHERE g.id = ANY (v_guardians)),
    'balance_paise', coalesce(sum(st.balance), 0)::bigint,
    'students', coalesce(jsonb_agg(st.obj ORDER BY st.name), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT s.name, bal.balance,
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'balance_paise', bal.balance::bigint,
        'batches', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', b.name, 'weekdays', b.weekdays, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
            'trainer_name', b.trainer_name, 'room', b.room) ORDER BY b.name), '[]'::jsonb)
          FROM public.batch_members m
          JOIN public.batches b ON b.id = m.batch_id AND b.studio_id = m.studio_id AND b.archived_at IS NULL
          WHERE m.student_id = s.id AND m.studio_id = p_studio AND m.left_on IS NULL),
        'attendance', (
          SELECT coalesce(jsonb_agg(x.item ORDER BY x.marked_at DESC), '[]'::jsonb)
          FROM (
            SELECT jsonb_build_object('date', cs.session_on, 'present', ar.present) AS item, ar.marked_at
            FROM public.attendance_records ar
            JOIN public.class_sessions cs ON cs.id = ar.session_id AND cs.studio_id = ar.studio_id
            WHERE ar.student_id = s.id AND ar.studio_id = p_studio
            ORDER BY ar.marked_at DESC LIMIT 60) x),
        'charges', (
          SELECT coalesce(jsonb_agg(y.item ORDER BY y.period DESC, y.due_on DESC), '[]'::jsonb)
          FROM (
            SELECT c.period, c.due_on, jsonb_build_object(
              'period', c.period, 'due_on', c.due_on, 'amount_paise', c.amount_paise, 'plan', c.fee_plan_name,
              'status', coalesce(ls.status, 'due')) AS item
            FROM public.charges c
            LEFT JOIN LATERAL (
              SELECT l.status FROM public.student_ledger_status(c.period, NULL, ARRAY[s.id]) l WHERE l.charge_id = c.id
            ) ls ON true
            WHERE c.student_id = s.id AND c.studio_id = p_studio AND c.voided_at IS NULL
            ORDER BY c.period DESC, c.due_on DESC LIMIT 24) y),
        'payments', (
          SELECT coalesce(jsonb_agg(z.item ORDER BY z.paid_on DESC, z.created_at DESC), '[]'::jsonb)
          FROM (
            SELECT p.paid_on, p.created_at, jsonb_build_object(
              'amount_paise', p.amount_paise, 'method', p.method, 'paid_on', p.paid_on) AS item
            FROM public.payments p
            WHERE p.student_id = s.id AND p.studio_id = p_studio AND p.voided_at IS NULL
            ORDER BY p.paid_on DESC, p.created_at DESC LIMIT 24) z)
      ) AS obj
    FROM public.students s
    CROSS JOIN LATERAL (
      SELECT coalesce((SELECT sum(c.amount_paise) FROM public.charges c WHERE c.student_id = s.id AND c.voided_at IS NULL), 0)
           - coalesce((SELECT sum(p.amount_paise) FROM public.payments p WHERE p.student_id = s.id AND p.voided_at IS NULL), 0) AS balance
    ) bal
    WHERE s.id = ANY (v_students)
  ) st;
  RETURN v_result;
END $$;

-- The caller's own payment claims at one studio, newest first.
CREATE FUNCTION public.member_claims(p_studio uuid)
RETURNS TABLE (
  id uuid, student_id uuid, amount_paise bigint, method text, paid_on date, status text,
  decision_reason text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.student_id, c.amount_paise, c.method, c.paid_on, c.status, c.decision_reason, c.created_at
  FROM public.payment_claims c
  WHERE c.studio_id = p_studio
    AND c.guardian_id IN (
      SELECT l.guardian_id FROM public.member_links l
      JOIN public.guardians g ON g.id = l.guardian_id AND g.studio_id = l.studio_id AND g.archived_at IS NULL
      WHERE l.user_id = auth.uid() AND l.studio_id = p_studio AND l.revoked_at IS NULL)
  ORDER BY c.created_at DESC
  LIMIT 20
$$;

-- A dancer reports a payment for themselves. The dancer record comes from the caller's live membership, never
-- from the input, and the claim goes through the same checks and the same five-waiting cap as a family-link
-- claim (the cap counts per dancer record, so using both doors cannot double it). It changes no balance.
CREATE FUNCTION public.submit_payment_claim_member(
  p_studio uuid, p_student uuid, p_amount_paise bigint, p_method text, p_paid_on date, p_reference text DEFAULT NULL
)
RETURNS public.payment_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian uuid;
  v_row public.payment_claims;
BEGIN
  SELECT l.guardian_id INTO v_guardian
  FROM public.member_links l
  JOIN public.guardians g ON g.id = l.guardian_id AND g.studio_id = l.studio_id AND g.archived_at IS NULL
  JOIN public.students s ON s.guardian_id = l.guardian_id AND s.studio_id = l.studio_id AND s.id = p_student AND s.archived_at IS NULL
  WHERE l.user_id = auth.uid() AND l.studio_id = p_studio AND l.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that dancer is not on your account';
  END IF;
  SELECT * INTO v_row FROM public.submit_payment_claim(v_guardian, p_student, p_amount_paise, p_method, p_paid_on, p_reference);
  UPDATE public.payment_claims SET submitted_via = 'member' WHERE id = v_row.id RETURNING * INTO v_row;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.guard_member_revoke() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.create_member_invite(uuid, integer, text, text),
  public.redeem_member_invite(text, text),
  public.member_studios(),
  public.member_view(uuid),
  public.member_claims(uuid),
  public.submit_payment_claim_member(uuid, uuid, bigint, text, date, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_member_invite(uuid, integer, text, text),
  public.redeem_member_invite(text, text),
  public.member_studios(),
  public.member_view(uuid),
  public.member_claims(uuid),
  public.submit_payment_claim_member(uuid, uuid, bigint, text, date, text)
TO authenticated, service_role;
