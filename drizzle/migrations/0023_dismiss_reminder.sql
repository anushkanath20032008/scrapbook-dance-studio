-- An owner can clear a reminder that is still waiting to send (for example one queued weeks ago that no longer
-- applies). It is marked cancelled, never deleted, and only the studio's own queued reminders qualify.
CREATE OR REPLACE FUNCTION public.dismiss_reminder(p_id uuid) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'only the studio owner can change this';
  END IF;
  UPDATE public.reminders SET status = 'cancelled'
  WHERE id = p_id AND studio_id = auth.uid() AND status = 'queued';
  v_found := FOUND;
  RETURN v_found;
END $$;

REVOKE ALL ON FUNCTION public.dismiss_reminder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_reminder(uuid) TO authenticated, service_role;
