-- Covering indexes for composite foreign keys (Supabase lint 0001).
CREATE INDEX IF NOT EXISTS attendance_records_studio_session_idx ON public.attendance_records (studio_id, session_id);
CREATE INDEX IF NOT EXISTS batch_members_studio_batch_idx ON public.batch_members (studio_id, batch_id);
CREATE INDEX IF NOT EXISTS charges_studio_fee_plan_idx ON public.charges (studio_id, fee_plan_id);
CREATE INDEX IF NOT EXISTS charges_studio_student_idx ON public.charges (studio_id, student_id);
CREATE INDEX IF NOT EXISTS class_sessions_studio_batch_idx ON public.class_sessions (studio_id, batch_id);
CREATE INDEX IF NOT EXISTS fee_plan_assignments_studio_plan_idx ON public.fee_plan_assignments (studio_id, fee_plan_id);
CREATE INDEX IF NOT EXISTS makeup_classes_created_by_idx ON public.makeup_classes (created_by);
CREATE INDEX IF NOT EXISTS makeup_classes_studio_makeup_batch_idx ON public.makeup_classes (studio_id, makeup_batch_id);
CREATE INDEX IF NOT EXISTS makeup_classes_studio_missed_batch_idx ON public.makeup_classes (studio_id, missed_batch_id);
CREATE INDEX IF NOT EXISTS member_invites_redeemed_by_idx ON public.member_invites (redeemed_by);
CREATE INDEX IF NOT EXISTS payment_claims_studio_guardian_idx ON public.payment_claims (studio_id, guardian_id);
CREATE INDEX IF NOT EXISTS payment_claims_studio_payment_idx ON public.payment_claims (studio_id, payment_id);
CREATE INDEX IF NOT EXISTS payment_claims_studio_student_idx ON public.payment_claims (studio_id, student_id);
CREATE INDEX IF NOT EXISTS reminders_studio_charge_idx ON public.reminders (studio_id, charge_id);
CREATE INDEX IF NOT EXISTS reminders_studio_guardian_idx ON public.reminders (studio_id, guardian_id);
CREATE INDEX IF NOT EXISTS reminders_studio_student_idx ON public.reminders (studio_id, student_id);

-- Evaluate auth.uid() once per statement, not once per row (Supabase lint 0003).
DO $$
DECLARE r record; q text; w text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' LOOP
    q := r.qual; w := r.with_check;
    IF q IS NOT NULL THEN q := replace(replace(q, '( SELECT auth.uid() AS uid)', '@@UID@@'), 'auth.uid()', '(select auth.uid())'); q := replace(q, '@@UID@@', '(select auth.uid())'); END IF;
    IF w IS NOT NULL THEN w := replace(replace(w, '( SELECT auth.uid() AS uid)', '@@UID@@'), 'auth.uid()', '(select auth.uid())'); w := replace(w, '@@UID@@', '(select auth.uid())'); END IF;
    IF q IS DISTINCT FROM r.qual OR w IS DISTINCT FROM r.with_check THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I%s%s', r.policyname, r.schemaname, r.tablename,
        CASE WHEN q IS DISTINCT FROM r.qual THEN ' USING (' || q || ')' ELSE '' END,
        CASE WHEN w IS DISTINCT FROM r.with_check THEN ' WITH CHECK (' || w || ')' ELSE '' END);
    END IF;
  END LOOP;
END $$;
