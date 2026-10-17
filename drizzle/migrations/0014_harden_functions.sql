-- Found by the Supabase security advisor after migrating off Lovable Cloud. Supabase grants EXECUTE on new
-- functions to anon by default, and REVOKE ... FROM PUBLIC does not remove that explicit grant, so the role
-- check was callable without signing in. Only signed-in users and the server need it. The two guard triggers
-- also get a fixed search_path.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
ALTER FUNCTION public.guard_ledger_void() SET search_path = public;
ALTER FUNCTION public.guard_family_link_revoke() SET search_path = public;
