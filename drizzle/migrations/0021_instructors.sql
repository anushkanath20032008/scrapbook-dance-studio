-- Instructors: a low-privilege login for a studio's dance teacher. An owner invites an instructor by email or
-- with a one-time link and short code (7 days by default, single use, revocable). The instructor signs in with
-- their own account, accepts the invite, and from then on can see the studio's batches, the dancers' names on
-- those batches, and mark and view attendance. Nothing else.
--
-- Access is derived from studio_instructors alone: no live row, no data. Instructors get no table privileges
-- and no row policies at all; every instructor read and write goes through the SECURITY DEFINER functions
-- below, which start from auth.uid() and the caller's live row. That is stricter than a set of instructor
-- SELECT policies and cannot widen an owner policy by union. Fees, charges, payments, claims, reminders, phone
-- numbers and the studio profile have no instructor function, so they stay out of reach. Invite secrets are
-- stored only as SHA-256. Purely additive: no existing table, policy or function is changed.

CREATE TABLE public.studio_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  -- The email the owner invited (lowercased), or the one the instructor signed up with for a link-only invite.
  email text CHECK (email IS NULL OR (length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+$')),
  token_hash text NOT NULL UNIQUE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  -- Set when the invite is accepted. A row with a user is an instructor; a row without one is a pending invite.
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) = (accepted_at IS NULL))
);
CREATE INDEX studio_instructors_studio_idx ON public.studio_instructors (studio_id, created_at DESC);
-- One live instructor login per account.
CREATE UNIQUE INDEX studio_instructors_one_live_per_user_idx ON public.studio_instructors (user_id) WHERE user_id IS NOT NULL AND revoked_at IS NULL;

CREATE TRIGGER studio_instructors_revoke_guard BEFORE UPDATE ON public.studio_instructors
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_revoke();

ALTER TABLE public.studio_instructors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_instructors FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.studio_instructors TO service_role;
-- Owners see status only: never the hashes, and never the instructor's account id.
GRANT SELECT (id, studio_id, email, expires_at, accepted_at, revoked_at, created_at) ON public.studio_instructors TO authenticated;
GRANT UPDATE (revoked_at) ON public.studio_instructors TO authenticated;
CREATE POLICY "Studio reads own studio_instructors" ON public.studio_instructors FOR SELECT TO authenticated USING (studio_id = auth.uid());
CREATE POLICY "Studio removes own studio_instructors" ON public.studio_instructors FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());

-- An instructor account never becomes a studio of its own by signing in to the console.
CREATE FUNCTION public.block_instructor_studio() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.studio_instructors i WHERE i.user_id = NEW.user_id AND i.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'an instructor login cannot run a studio; use a different email for your own studio';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER studio_profiles_block_instructor BEFORE INSERT ON public.studio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_instructor_studio();

-- The studio the caller teaches at, or NULL. Internal helper for the functions below.
CREATE FUNCTION public.caller_instructor_studio() RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.studio_id FROM public.studio_instructors i
  WHERE i.user_id = auth.uid() AND i.revoked_at IS NULL
  LIMIT 1
$$;

-- Invite an instructor. The server generates the secrets and passes only their hashes. An email is optional:
-- with one, only an account with that email can accept; without one, anyone holding the link or code can.
-- Issuing a new invite for the same email revokes the older pending one.
CREATE FUNCTION public.create_instructor_invite(p_email text, p_days integer, p_token_hash text, p_code_hash text)
RETURNS TABLE (id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studio_profiles sp WHERE sp.user_id = v_studio) THEN
    RAISE EXCEPTION 'only the studio owner can invite instructors';
  END IF;
  IF p_days NOT IN (1, 7, 30) THEN
    RAISE EXCEPTION 'choose 1, 7 or 30 days';
  END IF;
  IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+$') THEN
    RAISE EXCEPTION 'that email does not look right';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('instructor-invite:' || v_studio::text));
  IF (SELECT count(*) FROM public.studio_instructors i WHERE i.studio_id = v_studio AND i.revoked_at IS NULL AND i.user_id IS NOT NULL) >= 20 THEN
    RAISE EXCEPTION 'a studio can have up to 20 instructors';
  END IF;
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.studio_instructors i
    WHERE i.studio_id = v_studio AND i.email = v_email AND i.user_id IS NOT NULL AND i.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'that instructor is already on your team';
  END IF;
  IF (SELECT count(*) FROM public.studio_instructors i WHERE i.studio_id = v_studio AND i.created_at > now() - interval '1 hour') >= 20 THEN
    RAISE EXCEPTION 'too many invites just now; try again in an hour';
  END IF;
  IF v_email IS NOT NULL THEN
    UPDATE public.studio_instructors i SET revoked_at = now()
    WHERE i.studio_id = v_studio AND i.email = v_email AND i.user_id IS NULL AND i.revoked_at IS NULL;
  END IF;
  RETURN QUERY
  INSERT INTO public.studio_instructors (studio_id, email, token_hash, code_hash, expires_at)
  VALUES (v_studio, v_email, p_token_hash, p_code_hash, now() + make_interval(days => p_days))
  RETURNING studio_instructors.id, studio_instructors.expires_at;
END $$;

-- Accept an invite while signed in. The secret is the long link token (43 characters) or the short code
-- (8 characters, dashes and case ignored). A wrong, used, expired, revoked or wrongly-addressed invite returns
-- NULL and counts toward the same throttle as dancer invites. Returns the studio's name.
CREATE FUNCTION public.redeem_instructor_invite(p_secret text, p_source text DEFAULT NULL)
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
  v_email text;
  v_invite public.studio_instructors;
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
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_user;

  IF length(v_secret) = 43 THEN
    SELECT * INTO v_invite FROM public.studio_instructors i
    WHERE i.token_hash = encode(sha256(convert_to(v_secret, 'UTF8')), 'hex') FOR UPDATE;
  ELSIF length(v_code) = 8 THEN
    SELECT * INTO v_invite FROM public.studio_instructors i
    WHERE i.code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex') FOR UPDATE;
  END IF;

  IF v_invite.id IS NULL
     OR v_invite.user_id IS NOT NULL
     OR v_invite.revoked_at IS NOT NULL
     OR v_invite.expires_at <= now()
     OR (v_invite.email IS NOT NULL AND v_invite.email IS DISTINCT FROM v_email)
     OR NOT EXISTS (SELECT 1 FROM public.studio_profiles sp WHERE sp.user_id = v_invite.studio_id) THEN
    INSERT INTO public.invite_attempts (user_id, source_hash) VALUES (v_user, v_source);
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.studio_profiles sp WHERE sp.user_id = v_user) THEN
    RAISE EXCEPTION 'this account already runs a studio; sign in with a different email to join as an instructor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_instructors i WHERE i.user_id = v_user AND i.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'this account is already an instructor';
  END IF;

  UPDATE public.studio_instructors
  SET user_id = v_user, accepted_at = now(), email = coalesce(email, v_email)
  WHERE id = v_invite.id;
  SELECT sp.studio_name INTO v_studio_name FROM public.studio_profiles sp WHERE sp.user_id = v_invite.studio_id;
  RETURN coalesce(nullif(v_studio_name, ''), 'your studio');
END $$;

-- Who the caller is to the instructor console: the studio they teach at, or no row.
CREATE FUNCTION public.instructor_me()
RETURNS TABLE (studio_id uuid, studio_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.studio_id, coalesce(nullif(sp.studio_name, ''), 'Your studio')
  FROM public.studio_instructors i
  JOIN public.studio_profiles sp ON sp.user_id = i.studio_id
  WHERE i.user_id = auth.uid() AND i.revoked_at IS NULL
$$;

-- The studio's live batches. No fees, no counts of money, nothing about the studio's account.
CREATE FUNCTION public.instructor_batches()
RETURNS TABLE (id uuid, name text, weekdays smallint[], starts_at time, ends_at time, trainer_name text, room text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.weekdays, b.starts_at, b.ends_at, b.trainer_name, b.room
  FROM public.batches b
  WHERE b.studio_id = public.caller_instructor_studio() AND b.archived_at IS NULL
  ORDER BY b.name
$$;

-- The dancers on one batch today: id and name only. Empty for a batch of another studio.
CREATE FUNCTION public.instructor_batch_roster(p_batch uuid)
RETURNS TABLE (student_id uuid, student_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name
  FROM public.batches b
  JOIN public.batch_members bm ON bm.batch_id = b.id AND bm.studio_id = b.studio_id
  JOIN public.students s ON s.id = bm.student_id AND s.studio_id = bm.studio_id AND s.archived_at IS NULL
  WHERE b.id = p_batch AND b.studio_id = public.caller_instructor_studio()
    AND bm.joined_on <= (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND (bm.left_on IS NULL OR bm.left_on >= (now() AT TIME ZONE 'Asia/Kolkata')::date)
  ORDER BY s.name
$$;

-- A batch's roster for one day with each dancer's mark (null when not yet marked): the owner's batch_day,
-- limited to the instructor's studio.
CREATE FUNCTION public.instructor_batch_day(p_batch uuid, p_on date)
RETURNS TABLE (student_id uuid, student_name text, present boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, ar.present
  FROM public.batches b
  JOIN public.batch_members bm ON bm.batch_id = b.id AND bm.studio_id = b.studio_id
  JOIN public.students s ON s.id = bm.student_id AND s.studio_id = bm.studio_id
  LEFT JOIN public.class_sessions cs ON cs.batch_id = bm.batch_id AND cs.session_on = p_on
  LEFT JOIN public.attendance_records ar ON ar.session_id = cs.id AND ar.student_id = s.id
  WHERE b.id = p_batch AND b.studio_id = public.caller_instructor_studio()
    AND bm.joined_on <= p_on AND (bm.left_on IS NULL OR bm.left_on >= p_on)
  ORDER BY s.name
$$;

-- Mark a batch's attendance for a day in one atomic call: the owner's mark_attendance, limited to the
-- instructor's studio. Every dancer must be on the roster that day, or nothing is written.
CREATE FUNCTION public.instructor_mark_attendance(p_batch uuid, p_session_on date, p_marks jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := public.caller_instructor_studio();
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_session uuid;
  v_missing text;
  v_count integer;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'you do not have access to a studio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batches b WHERE b.id = p_batch AND b.studio_id = v_studio) THEN
    RAISE EXCEPTION 'batch not found';
  END IF;
  IF p_session_on < v_today - 366 OR p_session_on > v_today + 7 THEN
    RAISE EXCEPTION 'the date must be within the last year or the coming week';
  END IF;
  IF jsonb_typeof(p_marks) <> 'array' OR jsonb_array_length(p_marks) = 0 THEN
    RAISE EXCEPTION 'at least one attendance mark is required';
  END IF;

  SELECT string_agg(coalesce(s.name, m.student_id::text), ', ') INTO v_missing
  FROM jsonb_to_recordset(p_marks) AS m(student_id uuid, present boolean)
  LEFT JOIN public.students s ON s.id = m.student_id AND s.studio_id = v_studio
  WHERE NOT EXISTS (
    SELECT 1 FROM public.batch_members bm
    WHERE bm.batch_id = p_batch AND bm.student_id = m.student_id AND bm.studio_id = v_studio
      AND bm.joined_on <= p_session_on AND (bm.left_on IS NULL OR bm.left_on >= p_session_on)
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'not on the roster for that date: %', v_missing;
  END IF;

  INSERT INTO public.class_sessions (studio_id, batch_id, session_on) VALUES (v_studio, p_batch, p_session_on)
  ON CONFLICT (batch_id, session_on) DO UPDATE SET session_on = EXCLUDED.session_on
  RETURNING id INTO v_session;

  INSERT INTO public.attendance_records (studio_id, session_id, student_id, present)
  SELECT v_studio, v_session, m.student_id, m.present
  FROM jsonb_to_recordset(p_marks) AS m(student_id uuid, present boolean)
  ON CONFLICT (session_id, student_id) DO UPDATE SET present = EXCLUDED.present, marked_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.block_instructor_studio(), public.caller_instructor_studio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  public.create_instructor_invite(text, integer, text, text),
  public.redeem_instructor_invite(text, text),
  public.instructor_me(),
  public.instructor_batches(),
  public.instructor_batch_roster(uuid),
  public.instructor_batch_day(uuid, date),
  public.instructor_mark_attendance(uuid, date, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_instructor_invite(text, integer, text, text),
  public.redeem_instructor_invite(text, text),
  public.instructor_me(),
  public.instructor_batches(),
  public.instructor_batch_roster(uuid),
  public.instructor_batch_day(uuid, date),
  public.instructor_mark_attendance(uuid, date, jsonb)
TO authenticated, service_role;
