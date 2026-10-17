import { ensureStudio, friendlyError, type StudioContext } from "./studio.server";

/** What the console shell needs after sign-in: the studio's identity, plan and billing state, and platform role. */
export async function getConsoleContext(context: StudioContext) {
  await ensureStudio(context);
  const { supabase, userId } = context;

  const { data: profile, error } = await supabase
    .from("studio_profiles")
    .select("name, studio_name, plan, billing_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw friendlyError(error, "Could not load your studio.");

  // The platform owner role lives in its own table and is checked by the database, never from the email address.
  const { data: isPlatformOwner, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "owner",
  });
  if (roleError) throw friendlyError(roleError, "Could not load your studio.");

  return {
    ownerName: profile?.name ?? "",
    studioName: profile?.studio_name ?? "",
    plan: profile?.plan ?? "waitlist",
    billingStatus: profile?.billing_status ?? "not_started",
    isPlatformOwner: isPlatformOwner === true,
  };
}
