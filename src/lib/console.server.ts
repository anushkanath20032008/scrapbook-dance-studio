import { getInstructorMe } from "./instructors.server";
import { ensureStudio, friendlyError, type StudioContext } from "./studio.server";

/** What the console shell needs after sign-in: the studio's identity, plan and billing state, and platform role. */
export async function getConsoleContext(context: StudioContext) {
  // An instructor gets the trimmed console and never a studio of their own, so check before ensureStudio.
  const instructor = await getInstructorMe(context);
  if (instructor) {
    return {
      role: "instructor" as const,
      studentLimit: null,
      studentCount: 0,
      trialEndsAt: null,
      ownerName: "",
      studioName: instructor.studio_name,
      plan: "waitlist",
      billingStatus: "not_started",
      isPlatformOwner: false,
    };
  }
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

  // How many dancers the studio has and the plan's limit (null means no limit). A failure here just hides the count.
  const capacity = await supabase.rpc("studio_capacity");
  const cap = capacity.error ? undefined : capacity.data?.[0];

  return {
    role: "owner" as const,
    studentLimit: (cap?.student_limit as number | null | undefined) ?? null,
    studentCount: cap?.student_count ?? 0,
    trialEndsAt: cap?.trial_ends_at ?? null,
    ownerName: profile?.name ?? "",
    studioName: profile?.studio_name ?? "",
    plan: profile?.plan ?? "waitlist",
    billingStatus: profile?.billing_status ?? "not_started",
    isPlatformOwner: isPlatformOwner === true,
  };
}
