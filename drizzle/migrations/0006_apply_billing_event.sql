-- Apply one verified payment-provider event to a studio's plan and billing state, in a single step.
-- The row lock plus the applied flag make a redelivered or concurrent event safe: the studio changes at
-- most once per event, only forward in time, and only for its own subscription.
--
-- Outcomes (the event is marked applied in every case except an error, which rolls everything back):
--   applied      the studio row was updated
--   duplicate    this event was already applied earlier
--   stale        a newer event has already been applied to the studio
--   mismatch     the event belongs to a different subscription than the one the studio currently has
--   no_studio    the studio named by the event does not exist
--   ignored      the event carries no plan or status change
CREATE FUNCTION public.apply_billing_event(
  p_event_id text,
  p_user_id uuid,
  p_status text,
  p_plan text,
  p_subscription_id text,
  p_customer_id text,
  p_event_at timestamptz,
  p_period_end timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applied boolean;
  v_profile public.studio_profiles%ROWTYPE;
  v_outcome text;
BEGIN
  SELECT applied INTO v_applied FROM public.billing_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown billing event';
  END IF;
  IF v_applied THEN
    RETURN 'duplicate';
  END IF;

  IF p_status IS NULL THEN
    v_outcome := 'ignored';
  ELSIF p_user_id IS NULL OR p_subscription_id IS NULL OR p_event_at IS NULL THEN
    v_outcome := 'no_studio';
  ELSE
    SELECT * INTO v_profile FROM public.studio_profiles WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        INSERT INTO public.studio_profiles (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
        SELECT * INTO v_profile FROM public.studio_profiles WHERE user_id = p_user_id FOR UPDATE;
      END IF;
    END IF;

    IF v_profile.user_id IS NULL THEN
      v_outcome := 'no_studio';
    ELSIF v_profile.billing_updated_at IS NOT NULL AND p_event_at < v_profile.billing_updated_at THEN
      v_outcome := 'stale';
    ELSIF v_profile.dodo_subscription_id IS NOT NULL
      AND v_profile.dodo_subscription_id <> p_subscription_id
      -- a different subscription may take over only after the stored one has ended, and only by starting
      AND NOT (v_profile.billing_status = 'cancelled' AND v_profile.plan = 'waitlist' AND p_status = 'active')
    THEN
      v_outcome := 'mismatch';
    ELSE
      UPDATE public.studio_profiles SET
        billing_status = p_status,
        plan = coalesce(p_plan, plan),
        dodo_subscription_id = p_subscription_id,
        dodo_customer_id = coalesce(p_customer_id, dodo_customer_id),
        current_period_end = coalesce(p_period_end, current_period_end),
        billing_updated_at = p_event_at
      WHERE user_id = p_user_id;
      v_outcome := 'applied';
    END IF;
  END IF;

  UPDATE public.billing_events SET applied = true WHERE id = p_event_id;
  RETURN v_outcome;
END $$;

REVOKE ALL ON FUNCTION public.apply_billing_event(text, uuid, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_billing_event(text, uuid, text, text, text, text, timestamptz, timestamptz) TO service_role;
