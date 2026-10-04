REVOKE UPDATE ON public.studio_profiles FROM authenticated;
GRANT UPDATE (name, studio_name, phone, city) ON public.studio_profiles TO authenticated;