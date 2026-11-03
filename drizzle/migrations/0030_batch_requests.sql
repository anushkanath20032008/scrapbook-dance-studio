-- Batch requests: a dance teacher can suggest a new batch, and nothing exists in the studio until the owner
-- approves it. Approving creates the batch; declining keeps the request for the teacher to see.
--
-- The table is closed: no direct reads or writes for anyone but the service role. The teacher's two calls and
-- the owner's three calls are SECURITY DEFINER functions that start from auth.uid(), so a teacher can only ever
-- file a request for the studio they teach at and read their own, and only that studio's owner can list or decide
-- them. Purely additive: no existing table, policy or function is changed.

CREATE TABLE public.batch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  weekdays smallint[] NOT NULL DEFAULT '{}' CHECK (weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  starts_at time,
  ends_at time,
  trainer_name text CHECK (trainer_name IS NULL OR length(trainer_name) <= 120),
  room text CHECK (room IS NULL OR length(room) <= 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_at timestamptz,
  -- The batch that approval made.
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX batch_requests_studio_idx ON public.batch_requests (studio_id, status, created_at DESC);
CREATE INDEX batch_requests_requester_idx ON public.batch_requests (requested_by, created_at DESC);

ALTER TABLE public.batch_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.batch_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.batch_requests TO service_role;

-- A teacher suggests a batch for the studio they teach at.
CREATE FUNCTION public.instructor_request_batch(
  p_name text, p_weekdays smallint[], p_starts_at time, p_ends_at time, p_room text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid := public.caller_instructor_studio();
  v_id uuid;
BEGIN
  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'you do not have access to a studio';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'give the batch a name';
  END IF;
  IF (SELECT count(*) FROM public.batch_requests r WHERE r.requested_by = auth.uid() AND r.status = 'pending') >= 10 THEN
    RAISE EXCEPTION 'you already have 10 requests waiting for the owner';
  END IF;
  INSERT INTO public.batch_requests (studio_id, requested_by, name, weekdays, starts_at, ends_at, room)
  VALUES (v_studio, auth.uid(), btrim(p_name), coalesce(p_weekdays, '{}'), p_starts_at, p_ends_at, nullif(btrim(coalesce(p_room, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- The caller's own requests and what became of them.
CREATE FUNCTION public.instructor_my_batch_requests()
RETURNS TABLE (id uuid, name text, weekdays smallint[], starts_at time, ends_at time, room text, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.weekdays, r.starts_at, r.ends_at, r.room, r.status, r.created_at
  FROM public.batch_requests r
  WHERE r.requested_by = auth.uid()
  ORDER BY r.created_at DESC
  LIMIT 50
$$;

-- The studio owner's view: waiting requests first, then the latest decided ones, with who asked.
CREATE FUNCTION public.list_batch_requests()
RETURNS TABLE (id uuid, name text, weekdays smallint[], starts_at time, ends_at time, room text, status text, created_at timestamptz, requester_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.weekdays, r.starts_at, r.ends_at, r.room, r.status, r.created_at,
         (SELECT i.email FROM public.studio_instructors i WHERE i.user_id = r.requested_by AND i.studio_id = r.studio_id LIMIT 1)
  FROM public.batch_requests r
  WHERE r.studio_id = auth.uid()
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 50
$$;

-- Approve a waiting request: the batch is created for the studio. Returns the new batch's id.
CREATE FUNCTION public.approve_batch_request(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.batch_requests;
  v_batch uuid;
BEGIN
  SELECT * INTO v_request FROM public.batch_requests r
  WHERE r.id = p_id AND r.studio_id = auth.uid() FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'request not found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'this request was already decided';
  END IF;
  INSERT INTO public.batches (studio_id, name, weekdays, starts_at, ends_at, trainer_name, room)
  VALUES (v_request.studio_id, v_request.name, v_request.weekdays, v_request.starts_at, v_request.ends_at, v_request.trainer_name, v_request.room)
  RETURNING id INTO v_batch;
  UPDATE public.batch_requests SET status = 'approved', decided_at = now(), batch_id = v_batch WHERE id = v_request.id;
  RETURN v_batch;
END $$;

CREATE FUNCTION public.decline_batch_request(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.batch_requests SET status = 'declined', decided_at = now()
  WHERE id = p_id AND studio_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found or already decided';
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION
  public.instructor_request_batch(text, smallint[], time, time, text),
  public.instructor_my_batch_requests(),
  public.list_batch_requests(),
  public.approve_batch_request(uuid),
  public.decline_batch_request(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.instructor_request_batch(text, smallint[], time, time, text),
  public.instructor_my_batch_requests(),
  public.list_batch_requests(),
  public.approve_batch_request(uuid),
  public.decline_batch_request(uuid)
TO authenticated, service_role;
