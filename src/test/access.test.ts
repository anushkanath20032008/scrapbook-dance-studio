import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/access.server";

const now = new Date("2026-11-06T00:00:00Z");
const base = {
  trialEndsAt: null,
  billingStatus: null,
  isPlatformOwner: false,
  hasStudio: true,
  now,
};

describe("who may still change things", () => {
  it("lets a studio inside its free month work", () => {
    expect(decideAccess({ ...base, trialEndsAt: "2026-11-20T00:00:00Z" }).hasAccess).toBe(true);
  });
  it("stops a studio whose free month ended with no subscription", () => {
    const out = decideAccess({ ...base, trialEndsAt: "2026-10-01T00:00:00Z" });
    expect(out.hasAccess).toBe(false);
    expect(out.reason).toContain("249");
  });
  it("lets a paying studio work", () => {
    expect(decideAccess({ ...base, billingStatus: "active" }).hasAccess).toBe(true);
  });
  it("keeps a late payment working rather than locking the studio out", () => {
    expect(decideAccess({ ...base, billingStatus: "past_due" }).hasAccess).toBe(true);
  });
  it("stops a studio whose subscription ended", () => {
    expect(
      decideAccess({ ...base, billingStatus: "cancelled", trialEndsAt: "2026-10-01T00:00:00Z" })
        .hasAccess,
    ).toBe(false);
  });
  it("keeps working when the trial date could not be read, rather than locking anyone out", () => {
    expect(decideAccess({ ...base, trialEndsAt: null }).hasAccess).toBe(true);
  });
  it("never stops the platform owner or someone without a studio", () => {
    expect(decideAccess({ ...base, isPlatformOwner: true }).hasAccess).toBe(true);
    expect(decideAccess({ ...base, hasStudio: false }).hasAccess).toBe(true);
  });
});
