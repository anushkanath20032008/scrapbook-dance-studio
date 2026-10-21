-- Telegram reminders: a dancer joins the studio's bot through a private single-use invite link
-- (t.me/<bot>?start=<token>). The invite secret is stored only as SHA-256. Once redeemed, the row holds the
-- Telegram chat id, which is what lets the studio message that dancer. Owners create, read and revoke their own
-- invites; only the service role (the bot webhook) redeems them and writes the send log.

CREATE TABLE public.telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  chat_id bigint,
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((chat_id IS NULL) = (joined_at IS NULL)),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id)
);
CREATE INDEX telegram_links_guardian_idx ON public.telegram_links (studio_id, guardian_id, created_at DESC);
CREATE INDEX telegram_links_chat_idx ON public.telegram_links (chat_id) WHERE chat_id IS NOT NULL AND revoked_at IS NULL;
-- One live chat per dancer: a newer join replaces the older one (see redeem_telegram_link).
CREATE UNIQUE INDEX telegram_links_one_live_chat_idx ON public.telegram_links (studio_id, guardian_id)
  WHERE chat_id IS NOT NULL AND revoked_at IS NULL;

CREATE FUNCTION public.guard_telegram_link_revoke() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'this link is revoked and cannot be restored';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER telegram_links_revoke_guard BEFORE UPDATE ON public.telegram_links FOR EACH ROW EXECUTE FUNCTION public.guard_telegram_link_revoke();

-- One row per charge per India day that a Telegram reminder was sent: stops a double send and drives the
-- "reminded today" marker. Written only by the service role after Telegram accepted the message.
CREATE TABLE public.telegram_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  charge_id uuid NOT NULL,
  sent_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (charge_id, sent_on),
  FOREIGN KEY (studio_id, charge_id) REFERENCES public.charges (studio_id, id)
);
CREATE INDEX telegram_reminder_log_studio_idx ON public.telegram_reminder_log (studio_id, sent_on);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_links, public.telegram_reminder_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.telegram_links, public.telegram_reminder_log TO service_role;
GRANT SELECT, INSERT ON public.telegram_links TO authenticated;
GRANT UPDATE (revoked_at) ON public.telegram_links TO authenticated;
GRANT SELECT ON public.telegram_reminder_log TO authenticated;
CREATE POLICY "Studio reads own telegram_links" ON public.telegram_links FOR SELECT TO authenticated USING (studio_id = auth.uid());
-- An owner can only create an unjoined invite; the chat id comes from the bot, never from the browser.
CREATE POLICY "Studio creates own telegram invites" ON public.telegram_links FOR INSERT TO authenticated
  WITH CHECK (studio_id = auth.uid() AND chat_id IS NULL AND joined_at IS NULL AND revoked_at IS NULL);
CREATE POLICY "Studio revokes own telegram_links" ON public.telegram_links FOR UPDATE TO authenticated
  USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid());
CREATE POLICY "Studio reads own telegram_reminder_log" ON public.telegram_reminder_log FOR SELECT TO authenticated USING (studio_id = auth.uid());

-- Called only by the webhook, after it has checked the bot's secret header. Outcomes: 'joined' (invite used now),
-- 'already' (the same chat used it before), 'invalid' (unknown, revoked or used by another chat). Single use is
-- decided under a row lock. A dancer's older live chat is revoked so a re-join replaces it.
CREATE FUNCTION public.redeem_telegram_link(p_token_hash text, p_chat_id bigint)
RETURNS TABLE (outcome text, studio_id uuid, guardian_id uuid)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_link public.telegram_links;
BEGIN
  SELECT * INTO v_link FROM public.telegram_links l WHERE l.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_link.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;
  IF v_link.chat_id IS NOT NULL THEN
    IF v_link.chat_id = p_chat_id THEN
      RETURN QUERY SELECT 'already'::text, v_link.studio_id, v_link.guardian_id;
    ELSE
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    END IF;
    RETURN;
  END IF;
  UPDATE public.telegram_links l SET revoked_at = now()
  WHERE l.studio_id = v_link.studio_id AND l.guardian_id = v_link.guardian_id
    AND l.chat_id IS NOT NULL AND l.revoked_at IS NULL;
  UPDATE public.telegram_links l SET chat_id = p_chat_id, joined_at = now() WHERE l.id = v_link.id;
  RETURN QUERY SELECT 'joined'::text, v_link.studio_id, v_link.guardian_id;
END $$;

REVOKE ALL ON FUNCTION public.redeem_telegram_link(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_telegram_link(text, bigint) TO service_role;
