-- Supabase grants every privilege on new tables to anon and authenticated by default. The three original
-- tables never revoked them (row-level security still blocked access, but TRUNCATE and the grants themselves
-- should not exist). Keep only what the app needs: owners read their rows and edit contact columns.
REVOKE ALL ON public.studio_profiles, public.user_roles, public.waitlist_signups FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.studio_profiles, public.user_roles, public.waitlist_signups TO service_role;
GRANT SELECT ON public.studio_profiles, public.user_roles, public.waitlist_signups TO authenticated;
GRANT INSERT (user_id, name, studio_name, phone, city) ON public.studio_profiles TO authenticated;
GRANT UPDATE (name, studio_name, phone, city) ON public.studio_profiles TO authenticated;
