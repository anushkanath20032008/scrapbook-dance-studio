import { describe, expect, it } from "vitest";
import { accountPlanSummary } from "@/lib/account-plan";

const now = new Date("2026-10-23T10:00:00Z");
const base = {
  plan: "waitlist",
  billingStatus: "not_started",
  trialEndsAt: "2026-11-14T00:00:00Z",
  studentLimit: null,
  studentCount: 7,
  now,
};

describe("accountPlanSummary", () => {
  it("shows the free month with its last day, and lets the studio pick a plan", () => {
    const summary = accountPlanSummary(base);
    expect(summary.headline).toMatch(/free month/i);
    expect(summary.trialEndsOn).toBe("2026-11-14");
    expect(summary.canChoosePlan).toBe(true);
    expect(summary.hasSubscription).toBe(false);
  });

  it("says the free month is over, with the dancer limit, once it has passed", () => {
    const summary = accountPlanSummary({
      ...base,
      trialEndsAt: "2026-10-01T00:00:00Z",
      studentLimit: 50,
    });
    expect(summary.headline).toMatch(/over/i);
    expect(summary.detail).toMatch(/up to 50 dancers/);
    expect(summary.trialEndsOn).toBeNull();
    expect(summary.canChoosePlan).toBe(true);
  });

  it("shows a paying studio its plan and offers billing, not the plan picker", () => {
    const summary = accountPlanSummary({
      ...base,
      plan: "starter",
      billingStatus: "active",
      studentLimit: 50,
    });
    expect(summary.headline).toBe("Regular, ₹249 a month");
    expect(summary.canChoosePlan).toBe(false);
    expect(summary.hasSubscription).toBe(true);
  });

  it("points a past-due studio at billing and reassures it about its data", () => {
    const summary = accountPlanSummary({ ...base, plan: "studio", billingStatus: "past_due" });
    expect(summary.detail).toMatch(/Manage billing/);
    expect(summary.canChoosePlan).toBe(false);
  });

  it("lets a studio whose subscription ended choose again", () => {
    const summary = accountPlanSummary({ ...base, billingStatus: "cancelled", studentLimit: 50 });
    expect(summary.canChoosePlan).toBe(true);
    expect(summary.hasSubscription).toBe(true);
  });
});
