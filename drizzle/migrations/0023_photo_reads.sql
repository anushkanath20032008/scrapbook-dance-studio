-- Photo reads: a spend cap for reading dancers from a photo of a register. The table records only that a studio
-- read one page and when: no image, no text, no names. take_photo_reads refuses past 30 pages in 24 hours,
-- because the reading service key is the founder's money and an unattended loop would run up the bill before
-- anyone noticed. credit_photo_read gives one page back when the provider failed before a usable reply, so a
-- failed page and its retry cost one page.
--
-- Owner-only: both functions start from auth.uid() and need that account's own studio, so a Dance teacher is
-- refused. Nobody has table privileges and there are no row policies. Purely additive.

CREATE TABLE public.photo_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photo_reads_studio_idx ON public.photo_reads (studio_id, read_at DESC);

ALTER TABLE public.photo_reads ENABLE ROW LEVEL SECURITY;
-- Supabase's default grants would otherwise leave this table open to signed-in and anonymous users.
REVOKE ALL ON public.photo_reads FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.photo_reads TO service_role;

-- Record p_pages (1 to 6) page reads for the caller's studio. Returns the pages used in the last 24 hours,
-- this request included. Refuses the whole request when it would pass 30 pages.
CREATE FUNCTION public.take_photo_reads(p_pages integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
  v_used integer;
BEGIN
  IF v_studio IS NULL OR NOT EXISTS (SELECT 1 FROM public.studio_profiles sp WHERE sp.user_id = v_studio) THEN
    RAISE EXCEPTION 'only the studio owner can read photos';
  END IF;
  IF p_pages IS NULL OR p_pages < 1 OR p_pages > 6 THEN
    RAISE EXCEPTION 'read between 1 and 6 pages at a time';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('photo-reads:' || v_studio::text));
  SELECT count(*) INTO v_used FROM public.photo_reads r
  WHERE r.studio_id = v_studio AND r.read_at > now() - interval '24 hours';
  IF v_used + p_pages > 30 THEN
    RAISE EXCEPTION 'You have read 30 pages in the last 24 hours, which is the limit. Type or paste the rest, or try again tomorrow.';
  END IF;
  INSERT INTO public.photo_reads (studio_id) SELECT v_studio FROM generate_series(1, p_pages);
  RETURN v_used + p_pages;
END $$;

-- Give back the caller's most recent page read. Does nothing when there is none in the window.
CREATE FUNCTION public.credit_photo_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := auth.uid();
BEGIN
  IF v_studio IS NULL OR NOT EXISTS (SELECT 1 FROM public.studio_profiles sp WHERE sp.user_id = v_studio) THEN
    RAISE EXCEPTION 'only the studio owner can read photos';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('photo-reads:' || v_studio::text));
  DELETE FROM public.photo_reads
  WHERE id = (
    SELECT r.id FROM public.photo_reads r
    WHERE r.studio_id = v_studio AND r.read_at > now() - interval '24 hours'
    ORDER BY r.read_at DESC LIMIT 1
  );
END $$;

REVOKE ALL ON FUNCTION public.take_photo_reads(integer), public.credit_photo_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_photo_reads(integer), public.credit_photo_read() TO authenticated, service_role;
