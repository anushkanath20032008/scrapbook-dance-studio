import { studioPlans } from "./plans";

export type AccountPlanInput = {
  plan: string;
  billingStatus: string;
  trialEndsAt: string | null;
  studentLimit: number | null;
  studentCount: number;
  now: Date;
};

export type AccountPlanSummary = {
  headline: string;
  detail: string;
  /** True for a studio that has never subscribed, or whose subscription has ended. */
  canChoosePlan: boolean;
  /** True once a subscription exists, which is when the billing page has something to show. */
  hasSubscription: boolean;
  /** The last day of the free month, while it is still running. */
  trialEndsOn: string | null;
};

const dancers = (n: number) => `${n} dancer${n === 1 ? "" : "s"}`;

function planLabel(plan: string): string {
  const sold = studioPlans.find((p) => p.id === plan);
  if (sold) return `${sold.name}, ${sold.price} a month`;
  return plan === "growth" ? "Growth" : "No paid plan";
}

/** What the account page says about the studio's plan, in plain words, from the facts the server holds. */
export function accountPlanSummary(input: AccountPlanInput): AccountPlanSummary {
  const { plan, billingStatus, trialEndsAt, studentLimit, studentCount, now } = input;
  const count = dancers(studentCount);
  const limitNote =
    studentLimit === null
      ? "There is no dancer limit."
      : `Your plan allows up to ${studentLimit} dancers.`;
  const base = {
    canChoosePlan: false,
    hasSubscription: billingStatus !== "not_started",
    trialEndsOn: null,
  };

  if (billingStatus === "not_started" || (billingStatus === "cancelled" && plan === "waitlist")) {
    const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
    if (billingStatus === "not_started" && trialEnd && trialEnd > now) {
      return {
        ...base,
        canChoosePlan: true,
        headline: "Free month. Everything is included.",
        detail: `No card needed. You have ${count} so far.`,
        trialEndsOn: trialEnd.toISOString().slice(0, 10),
      };
    }
    return {
      ...base,
      canChoosePlan: true,
      headline: billingStatus === "cancelled" ? "Subscription ended" : "Free month is over",
      detail: `You have ${count}. ${limitNote} Dancers you already added stay. Choose a plan to add more.`,
    };
  }
  if (billingStatus === "past_due" || billingStatus === "on_hold") {
    return {
      ...base,
      headline: planLabel(plan),
      detail:
        "Your last payment did not go through. Open Manage billing to fix it. Your dancers and records are safe.",
    };
  }
  if (billingStatus === "cancelled") {
    return {
      ...base,
      headline: planLabel(plan),
      detail: "Cancelled. Your plan stays until the end of the period you paid for.",
    };
  }
  return { ...base, headline: planLabel(plan), detail: `Active. You have ${count}. ${limitNote}` };
}
