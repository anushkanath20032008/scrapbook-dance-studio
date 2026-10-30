-- Studio+ automated WhatsApp. A studio opts in with set_whatsapp_automation, which only works on an active
-- Studio+ plan; billing columns stay server-managed, so the switch is not an owner-writable column. The sender
-- only claims reminders from studios that have it on. Delivery updates from the provider land through
-- record_delivery_status, which only the service role can call. Purely additive except the claim function,
-- which is replaced with the same signature plus the studio check.

ALTER TABLE public.studio_profiles ADD COLUMN whatsapp_automation boolean NOT NULL DEFAULT false;
ALTER TABLE public.reminders
  ADD COLUMN delivery_status text CHECK (delivery_status IN ('delivered', 'read')),
  ADD COLUMN delivered_at timestamptz;

-- Whether a studio is on an active Studio+ plan.
CREATE FUNCTION public.studio_plus_active(p_studio uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_profiles sp
    WHERE sp.user_id = p_studio AND sp.plan = 'studio' AND sp.billing_status = 'active'
  )
$$;

-- What the Messages page needs: is Studio+ active, and is automation on.
CREATE FUNCTION public.whatsapp_automation_status()
RETURNS TABLE (studio_plus boolean, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.studio_plus_active(sp.user_id), sp.whatsapp_automation
  FROM public.studio_profiles sp WHERE sp.user_id = auth.uid()
$$;

CREATE FUNCTION public.set_whatsapp_automation(p_on boolean) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.studio_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'only the studio owner can change this';
  END IF;
  IF p_on AND NOT public.studio_plus_active(auth.uid()) THEN
    RAISE EXCEPTION 'Automated WhatsApp is part of Studio+';
  END IF;
  UPDATE public.studio_profiles SET whatsapp_automation = p_on WHERE user_id = auth.uid();
  RETURN p_on;
END $$;

-- Same as before, limited to studios that are on Studio+ with automation switched on. A reminder queued by a
-- studio that is not is left alone, so the owner still sends it with the tap-to-send button.
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_limit integer, p_lease_seconds integer DEFAULT 300)
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
    JOIN public.studio_profiles sp ON sp.user_id = q.studio_id
    WHERE ((q.status = 'queued' AND q.next_attempt_at <= now())
       OR (q.status = 'sending' AND q.lease_expires_at < now()))
      AND sp.whatsapp_automation AND public.studio_plus_active(q.studio_id)
    ORDER BY q.next_attempt_at, q.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*
$$;

-- A delivery update from the provider, matched by the message id it returned when the message was sent.
-- 'failed' marks the reminder failed with the reason; delivered and read never move a failed one back.
CREATE FUNCTION public.record_delivery_status(p_message_id text, p_status text, p_error text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  IF p_status NOT IN ('delivered', 'read', 'failed') THEN
    RAISE EXCEPTION 'unknown status';
  END IF;
  IF p_status = 'failed' THEN
    UPDATE public.reminders
    SET status = 'failed', last_error = left(coalesce(p_error, 'WhatsApp could not deliver this message.'), 1000)
    WHERE provider_message_id = p_message_id AND delivery_status IS NULL;
  ELSE
    UPDATE public.reminders
    SET delivery_status = CASE WHEN delivery_status = 'read' THEN 'read' ELSE p_status END,
        delivered_at = coalesce(delivered_at, now())
    WHERE provider_message_id = p_message_id AND status = 'sent';
  END IF;
  v_found := FOUND;
  RETURN v_found;
END $$;

REVOKE ALL ON FUNCTION public.studio_plus_active(uuid), public.record_delivery_status(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_plus_active(uuid), public.record_delivery_status(text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.whatsapp_automation_status(), public.set_whatsapp_automation(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_automation_status(), public.set_whatsapp_automation(boolean) TO authenticated, service_role;
