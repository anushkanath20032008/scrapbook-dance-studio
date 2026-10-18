-- Reminders (the queue), family links, the Dodo webhook event log, and server-managed billing columns.
-- Owners can read reminders but only queue_fee_reminders creates them; workers use the service role.

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  student_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fee_due', 'fee_overdue')),
  template_name text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 1000),
  sent_at timestamptz,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id),
  FOREIGN KEY (studio_id, charge_id) REFERENCES public.charges (studio_id, id)
);
CREATE INDEX reminders_due_idx ON public.reminders (status, next_attempt_at);
CREATE INDEX reminders_studio_idx ON public.reminders (studio_id, created_at DESC);

CREATE TABLE public.family_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id)
);
CREATE INDEX family_links_guardian_idx ON public.family_links (studio_id, guardian_id);

CREATE FUNCTION public.guard_family_link_revoke() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'this link is revoked and cannot be restored';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER family_links_revoke_guard BEFORE UPDATE ON public.family_links FOR EACH ROW EXECUTE FUNCTION public.guard_family_link_revoke();

CREATE TABLE public.billing_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  event_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminders, public.family_links, public.billing_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reminders, public.family_links, public.billing_events TO service_role;
GRANT SELECT ON public.reminders TO authenticated;
GRANT SELECT, INSERT ON public.family_links TO authenticated;
GRANT UPDATE (revoked_at) ON public.family_links TO authenticated;
CREATE POLICY "Studio reads own reminders" ON public.reminders FOR SELECT TO authenticated USING (studio_id = auth.uid());
CREATE POLICY "Studio reads own family_links" ON public.family_links FOR SELECT TO authenticated USING (studio_id = auth.uid());
CREATE POLICY "Studio creates own family_links" ON public.family_links FOR INSERT TO authenticated WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio revokes own family_links" ON public.family_links FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());

-- Queue a reminder for every due or overdue charge in the month whose student has a guardian who has not
-- opted out. Runs with definer rights because owners cannot insert reminders; the studio always comes from
-- the caller's identity and the status function is scoped to that studio's students. At most one reminder
-- per charge, kind and India date.
CREATE FUNCTION public.queue_fee_reminders(p_period date, p_today date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_students uuid[];
  v_count integer;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  SELECT coalesce(array_agg(s.id), ARRAY[]::uuid[]) INTO v_students
  FROM public.students s WHERE s.studio_id = v_studio AND s.archived_at IS NULL;

  INSERT INTO public.reminders (studio_id, guardian_id, student_id, charge_id, kind, template_name, payload, dedupe_key)
  SELECT v_studio, g.id, l.student_id, l.charge_id,
    CASE WHEN l.status = 'overdue' THEN 'fee_overdue' ELSE 'fee_due' END,
    CASE WHEN l.status = 'overdue' THEN 'fee_overdue_reminder' ELSE 'fee_due_reminder' END,
    jsonb_build_object(
      'studio_name', sp.studio_name,
      'guardian_name', g.name,
      'student_name', l.student_name,
      'amount_paise', l.outstanding_paise,
      'due_on', l.due_on,
      'period', l.period
    ),
    format('fee:%s:%s:%s', l.charge_id, CASE WHEN l.status = 'overdue' THEN 'fee_overdue' ELSE 'fee_due' END, v_today)
  FROM public.student_ledger_status(p_period, v_today, v_students) l
  JOIN public.students st ON st.id = l.student_id AND st.studio_id = v_studio
  JOIN public.guardians g ON g.id = st.guardian_id AND g.studio_id = v_studio AND NOT g.reminders_opted_out AND g.archived_at IS NULL
  JOIN public.studio_profiles sp ON sp.user_id = v_studio
  WHERE l.status IN ('due', 'overdue')
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Hand a worker a batch of reminders that are due, or whose earlier worker's lease ran out. A fresh claim
-- does not count as an attempt; taking over an expired lease does, because the earlier worker died or hung
-- mid-send, and that stops a poisonous row from being reclaimed forever. Workers record the outcome and any
-- further attempt themselves.
CREATE FUNCTION public.claim_due_reminders(p_limit integer, p_lease_seconds integer DEFAULT 300)
RETURNS SETOF public.reminders
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.reminders r
  SET attempts = r.attempts + (CASE WHEN r.status = 'sending' THEN 1 ELSE 0 END),
      status = 'sending',
      lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  WHERE r.id IN (
    SELECT q.id FROM public.reminders q
    WHERE (q.status = 'queued' AND q.next_attempt_at <= now())
       OR (q.status = 'sending' AND q.lease_expires_at < now())
    ORDER BY q.next_attempt_at, q.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*
$$;

REVOKE ALL ON FUNCTION public.queue_fee_reminders(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_fee_reminders(date, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_due_reminders(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer, integer) TO service_role;

-- Server-managed billing state on the studio profile. Owners may still edit contact fields (migration 0001);
-- insert is narrowed to the contact columns so a profile cannot be created with billing values pre-set.
ALTER TABLE public.studio_profiles
  ADD COLUMN dodo_customer_id text,
  ADD COLUMN dodo_subscription_id text,
  ADD COLUMN billing_updated_at timestamptz,
  ADD COLUMN current_period_end timestamptz,
  ADD CONSTRAINT studio_profiles_plan_check CHECK (plan IN ('waitlist', 'starter', 'growth', 'studio')),
  ADD CONSTRAINT studio_profiles_billing_status_check CHECK (billing_status IN ('not_started', 'active', 'past_due', 'on_hold', 'cancelled'));
REVOKE INSERT ON public.studio_profiles FROM authenticated;
GRANT INSERT (user_id, name, studio_name, phone, city) ON public.studio_profiles TO authenticated;
