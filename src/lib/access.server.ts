import type { Db } from "./studio.server";

export const SUBSCRIBE_MESSAGE =
  "Your free month has ended. Subscribe for ₹249 a month on the Account page to keep using ChoreoStudio. Everything you have added is safe.";

export type StudioAccess = {
  hasAccess: boolean;
  trialEndsAt: string | null;
  reason: string | null;
};

/**
 * Whether this studio may still change anything. After the free month a subscription is needed: the studio can
 * still read everything it has, but adding, editing and marking stop until it subscribes. A payment that is
 * merely late ("past_due") keeps working, so a card that needs renewing never locks a studio out mid-month.
 */
export function decideAccess(input: {
  trialEndsAt: string | null;
  billingStatus: string | null;
  isPlatformOwner: boolean;
  hasStudio: boolean;
  now: Date;
}): StudioAccess {
  const { trialEndsAt, billingStatus, isPlatformOwner, hasStudio, now } = input;
  const base = { trialEndsAt, reason: null as string | null };
  // Not a studio owner (a teacher, say): their studio's own subscription is checked where their writes land.
  if (!hasStudio || isPlatformOwner) return { ...base, hasAccess: true };
  if (billingStatus === "active" || billingStatus === "past_due")
    return { ...base, hasAccess: true };
  // Without a trial end date there is nothing to prove the free month is over, so the studio keeps working.
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  if (!trialEnd || Number.isNaN(trialEnd.getTime()) || trialEnd > now)
    return { ...base, hasAccess: true };
  return { ...base, hasAccess: false, reason: SUBSCRIBE_MESSAGE };
}

/** Ask the database the three facts the decision needs. Never throws: a lookup that fails allows the write. */
export async function studioAccess(supabase: Db, userId: string): Promise<StudioAccess> {
  try {
    const [profile, capacity, role] = await Promise.all([
      supabase.from("studio_profiles").select("billing_status").eq("user_id", userId).maybeSingle(),
      supabase.rpc("studio_capacity"),
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    ]);
    if (profile.error || capacity.error)
      return { hasAccess: true, trialEndsAt: null, reason: null };
    return decideAccess({
      trialEndsAt: (capacity.data?.[0]?.trial_ends_at as string | undefined) ?? null,
      billingStatus: profile.data?.billing_status ?? null,
      isPlatformOwner: role.data === true,
      hasStudio: profile.data !== null,
      now: new Date(),
    });
  } catch {
    return { hasAccess: true, trialEndsAt: null, reason: null };
  }
}
