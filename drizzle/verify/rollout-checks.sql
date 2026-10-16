-- Read-only checks to run after applying migrations 0003 to 0006. It returns one row per problem and no rows
-- when everything is as designed. Run it with a role that can read the catalogs (the database owner).
WITH new_tables(name) AS (
  VALUES ('guardians'), ('students'), ('batches'), ('batch_members'), ('fee_plans'),
         ('fee_plan_assignments'), ('class_sessions'), ('attendance_records'), ('charges'),
         ('payments'), ('reminders'), ('family_links'), ('billing_events')
),
billing_columns(name) AS (
  VALUES ('plan'), ('billing_status'), ('dodo_customer_id'), ('dodo_subscription_id'),
         ('billing_updated_at'), ('current_period_end')
)
SELECT 'table missing: ' || n.name AS problem
FROM new_tables n
WHERE to_regclass('public.' || n.name) IS NULL

UNION ALL
SELECT 'row-level security is off: ' || c.relname
FROM pg_class c
JOIN new_tables n ON n.name = c.relname
WHERE c.relnamespace = 'public'::regnamespace AND NOT c.relrowsecurity

UNION ALL
SELECT 'no policy: ' || n.name
FROM new_tables n
WHERE to_regclass('public.' || n.name) IS NOT NULL
  AND n.name <> 'billing_events' -- service role only, by design
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = n.name)

UNION ALL
SELECT 'anon can reach ' || g.table_name || ' (' || g.privilege_type || ')'
FROM information_schema.role_table_grants g
JOIN new_tables n ON n.name = g.table_name
WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'PUBLIC')

UNION ALL
SELECT 'owners can delete from ' || g.table_name
FROM information_schema.role_table_grants g
JOIN new_tables n ON n.name = g.table_name
WHERE g.table_schema = 'public' AND g.grantee = 'authenticated' AND g.privilege_type = 'DELETE'

UNION ALL
SELECT 'owners can write ' || g.table_name || ' (' || g.privilege_type || ')'
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.grantee = 'authenticated'
  AND g.table_name IN ('reminders', 'billing_events')
  AND g.privilege_type <> 'SELECT'

UNION ALL
SELECT 'owners can reach billing_events'
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public' AND g.grantee = 'authenticated' AND g.table_name = 'billing_events'

UNION ALL
SELECT 'owners can change ledger rows directly: ' || g.table_name || ' (' || g.privilege_type || ')'
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.grantee = 'authenticated'
  AND g.table_name IN ('charges', 'payments')
  AND g.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE')

UNION ALL
SELECT 'owners can set billing column ' || g.column_name || ' (' || g.privilege_type || ')'
FROM information_schema.column_privileges g
JOIN billing_columns b ON b.name = g.column_name
WHERE g.table_schema = 'public'
  AND g.table_name = 'studio_profiles'
  AND g.grantee IN ('authenticated', 'PUBLIC')
  AND g.privilege_type IN ('INSERT', 'UPDATE')

UNION ALL
SELECT 'owners can run ' || p.proname
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('claim_due_reminders', 'apply_billing_event')
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')

UNION ALL
SELECT 'anon can run ' || p.proname
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('assign_fee_plan', 'batch_day', 'claim_due_reminders', 'generate_monthly_charges',
                    'ledger_overview', 'mark_attendance', 'queue_fee_reminders', 'record_payment',
                    'student_attendance', 'student_ledger_status', 'apply_billing_event')
  AND has_function_privilege('anon', p.oid, 'EXECUTE')

UNION ALL
SELECT 'row-level security is off: ' || c.relname
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('studio_profiles', 'user_roles', 'waitlist_signups')
  AND NOT c.relrowsecurity

UNION ALL
SELECT 'public policy on ' || p.tablename || ': ' || p.policyname
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('studio_profiles', 'user_roles', 'waitlist_signups')
  AND p.cmd IN ('SELECT', 'ALL')
  AND p.roles && ARRAY['anon', 'public']::name[];
