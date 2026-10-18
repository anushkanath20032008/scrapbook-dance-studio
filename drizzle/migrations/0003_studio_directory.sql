-- Studio directory: guardians, students, batches, rosters, fee plans and per-student fee-plan assignments.
-- A studio is the owner's account: studio_id is studio_profiles.user_id.
-- Every child references its parents through (studio_id, id) so a row can never link across studios.
-- Nothing here is deletable by an owner; records are archived or closed with an end date.

CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9[:space:]-]{10,18}$'),
  reminders_opted_out boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, id)
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  guardian_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, id),
  FOREIGN KEY (studio_id, guardian_id) REFERENCES public.guardians (studio_id, id)
);
CREATE INDEX students_guardian_idx ON public.students (studio_id, guardian_id);

CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  weekdays smallint[] NOT NULL DEFAULT '{}' CHECK (weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  starts_at time,
  ends_at time,
  trainer_name text CHECK (trainer_name IS NULL OR length(trainer_name) <= 120),
  room text CHECK (room IS NULL OR length(room) <= 120),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, id)
);

CREATE TABLE public.batch_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  student_id uuid NOT NULL,
  joined_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  left_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (left_on IS NULL OR left_on >= joined_on),
  FOREIGN KEY (studio_id, batch_id) REFERENCES public.batches (studio_id, id),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id)
);
CREATE UNIQUE INDEX batch_members_one_open_idx ON public.batch_members (batch_id, student_id) WHERE left_on IS NULL;
CREATE INDEX batch_members_student_idx ON public.batch_members (studio_id, student_id);

CREATE TABLE public.fee_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  classes_per_week smallint CHECK (classes_per_week IS NULL OR classes_per_week BETWEEN 1 AND 14),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, id)
);

CREATE TABLE public.fee_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studio_profiles(user_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  fee_plan_id uuid NOT NULL,
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  starts_on date NOT NULL,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  FOREIGN KEY (studio_id, student_id) REFERENCES public.students (studio_id, id),
  FOREIGN KEY (studio_id, fee_plan_id) REFERENCES public.fee_plans (studio_id, id)
);
CREATE UNIQUE INDEX fee_plan_assignments_one_open_idx ON public.fee_plan_assignments (student_id) WHERE ends_on IS NULL;
CREATE INDEX fee_plan_assignments_student_idx ON public.fee_plan_assignments (studio_id, student_id, starts_on);

-- Row-level security and grants. Supabase grants everything on new tables to anon and authenticated by
-- default, so revoke first and grant only what owners need: read, create and edit their own rows.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['guardians', 'students', 'batches', 'batch_members', 'fee_plans', 'fee_plan_assignments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (studio_id = auth.uid())', 'Studio reads own ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (studio_id = auth.uid())', 'Studio creates own ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (studio_id = auth.uid()) WITH CHECK (studio_id = auth.uid())', 'Studio edits own ' || t, t);
  END LOOP;
END $$;

-- Give a student exactly one open fee plan: close the current one the day before the new one starts and
-- open the next at the plan's current amount, in a single call. Runs with the caller's rights, so
-- row-level security decides which students and plans are visible.
CREATE FUNCTION public.assign_fee_plan(p_student uuid, p_plan uuid, p_starts_on date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan public.fee_plans;
  v_open public.fee_plan_assignments;
  v_id uuid;
BEGIN
  SELECT * INTO v_plan FROM public.fee_plans WHERE id = p_plan;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fee plan not found';
  END IF;
  IF v_plan.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'fee plan is archived';
  END IF;
  PERFORM 1 FROM public.students WHERE id = p_student AND studio_id = v_plan.studio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;
  SELECT * INTO v_open FROM public.fee_plan_assignments WHERE student_id = p_student AND ends_on IS NULL FOR UPDATE;
  IF FOUND THEN
    IF p_starts_on <= v_open.starts_on THEN
      RAISE EXCEPTION 'the new plan must start after the current one began (%)', v_open.starts_on;
    END IF;
    UPDATE public.fee_plan_assignments SET ends_on = p_starts_on - 1 WHERE id = v_open.id;
  END IF;
  INSERT INTO public.fee_plan_assignments (studio_id, student_id, fee_plan_id, amount_paise, starts_on)
  VALUES (v_plan.studio_id, p_student, p_plan, v_plan.amount_paise, p_starts_on)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.assign_fee_plan(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_fee_plan(uuid, uuid, date) TO authenticated, service_role;
