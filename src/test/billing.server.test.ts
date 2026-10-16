import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioPlanId } from "@/lib/plans";

const dodo = vi.hoisted(() => ({ create: vi.fn(), options: [] as unknown[] }));

vi.mock("dodopayments", () => ({
  default: class {
    checkoutSessions = { create: dodo.create };
    constructor(options: unknown) {
      dodo.options.push(options);
    }
  },
}));

const { startSubscriptionCheckout } = await import("@/lib/billing.server");

type Profile = { studio_name: string; billing_status: string; plan?: string } | null;

// A signed-in owner whose studio_profiles lookup returns `profile`.
function ownerContext(profile: Profile) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: profile, error: null }),
  };
  return {
    supabase: { from: () => query } as never,
    userId: "user-1",
    requestOrigin: "https://choreostudio.live",
  };
}

const newStudio = { studio_name: "Ghungroo Studio", billing_status: "not_started" };
const checkout = (plan: StudioPlanId, profile: Profile = newStudio) =>
  startSubscriptionCheckout(plan, ownerContext(profile));

describe("startSubscriptionCheckout", () => {
  beforeEach(() => {
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "test-key");
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "");
    vi.stubEnv("DODO_PAYMENTS_STARTER_PRODUCT_ID", "pdt_starter");
    vi.stubEnv("DODO_PAYMENTS_GROWTH_PRODUCT_ID", "pdt_growth");
    vi.stubEnv("DODO_PAYMENTS_STUDIO_PRODUCT_ID", "pdt_studio");
    vi.stubEnv("PUBLIC_APP_URL", "https://www.choreostudio.live/");
    dodo.create
      .mockReset()
      .mockResolvedValue({ session_id: "cks_1", checkout_url: "https://checkout.dodo/abc" });
    dodo.options.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("creates a test-mode checkout for the chosen plan and returns only the URL", async () => {
    const result = await checkout("growth");

    expect(result).toEqual({ checkoutUrl: "https://checkout.dodo/abc" });
    expect(dodo.create).toHaveBeenCalledWith({
      product_cart: [{ product_id: "pdt_growth", quantity: 1 }],
      return_url: "https://www.choreostudio.live/account?billing=success",
      metadata: { user_id: "user-1", plan: "growth", studio_name: "Ghungroo Studio" },
    });
    expect(dodo.options).toEqual([{ bearerToken: "test-key", environment: "test_mode" }]);
  });

  it("maps each plan to its own product", async () => {
    await checkout("starter");
    await checkout("studio");

    expect(dodo.create.mock.calls.map(([body]) => body.product_cart[0].product_id)).toEqual([
      "pdt_starter",
      "pdt_studio",
    ]);
  });

  it("uses live mode only when configured", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "live_mode");

    await checkout("starter");

    expect(dodo.options).toEqual([{ bearerToken: "test-key", environment: "live_mode" }]);
  });

  it("gives a clear error when the plan's product ID is not configured", async () => {
    vi.stubEnv("DODO_PAYMENTS_STUDIO_PRODUCT_ID", "");

    await expect(checkout("studio")).rejects.toThrow(
      "The Studio+ plan isn't available for checkout yet",
    );
    expect(dodo.create).not.toHaveBeenCalled();
  });

  it("gives the same error when the API key is missing", async () => {
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "");

    await expect(checkout("starter")).rejects.toThrow(
      "The Starter plan isn't available for checkout yet",
    );
    expect(dodo.create).not.toHaveBeenCalled();
  });

  it("refuses a second checkout once the studio has a subscription", async () => {
    await expect(
      checkout("growth", { studio_name: "Ghungroo Studio", billing_status: "active" }),
    ).rejects.toThrow("Your studio already has a subscription.");
    expect(dodo.create).not.toHaveBeenCalled();
  });

  it("lets a studio whose subscription ended (cancelled, back on the waitlist) subscribe again", async () => {
    await checkout("growth", {
      studio_name: "Ghungroo Studio",
      billing_status: "cancelled",
      plan: "waitlist",
    });

    expect(dodo.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a cancelled studio that still holds a paid plan, and on-hold or past-due studios", async () => {
    for (const profile of [
      { billing_status: "cancelled", plan: "growth" },
      { billing_status: "on_hold", plan: "waitlist" },
      { billing_status: "past_due", plan: "starter" },
    ]) {
      await expect(checkout("studio", { studio_name: "x", ...profile })).rejects.toThrow(
        "already has a subscription",
      );
    }
    expect(dodo.create).not.toHaveBeenCalled();
  });

  it("lets an owner without a saved profile check out", async () => {
    await checkout("starter", null);

    expect(dodo.create.mock.calls[0]?.[0]?.metadata).toEqual({
      user_id: "user-1",
      plan: "starter",
      studio_name: "",
    });
  });

  it("returns to the request origin when PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "");

    await checkout("starter");

    expect(dodo.create.mock.calls[0]?.[0]?.return_url).toBe(
      "https://choreostudio.live/account?billing=success",
    );
  });

  it("hides Dodo errors behind a generic message", async () => {
    dodo.create.mockRejectedValue(new Error("401 invalid key test-key"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(checkout("starter")).rejects.toThrow(
      "Could not start checkout. Please try again.",
    );
  });

  it("fails when Dodo returns no checkout URL", async () => {
    dodo.create.mockResolvedValue({ session_id: "cks_2", checkout_url: null });

    await expect(checkout("starter")).rejects.toThrow(
      "Could not start checkout. Please try again.",
    );
  });
});
