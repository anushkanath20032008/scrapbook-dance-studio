import type { SupabaseClient } from "@supabase/supabase-js";
import DodoPayments from "dodopayments";
import type { Database } from "@/integrations/supabase/types";
import { studioPlans, type StudioPlanId } from "@/lib/plans";

// Product IDs and the API key stay in server-only environment variables.
function productIdFor(plan: StudioPlanId) {
  const ids: Record<StudioPlanId, string | undefined> = {
    starter: process.env["DODO_PAYMENTS_STARTER_PRODUCT_ID"],
    growth: process.env["DODO_PAYMENTS_GROWTH_PRODUCT_ID"],
    studio: process.env["DODO_PAYMENTS_STUDIO_PRODUCT_ID"],
  };
  return ids[plan]?.trim() || undefined;
}

type CheckoutContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  // Origin of the incoming request, used when PUBLIC_APP_URL is unset.
  requestOrigin: string;
};

// The checkout logic behind createSubscriptionCheckout, for an already-authenticated studio owner.
export async function startSubscriptionCheckout(plan: StudioPlanId, context: CheckoutContext) {
  const productId = productIdFor(plan);
  if (!productId || !process.env["DODO_PAYMENTS_API_KEY"]) {
    const planName = studioPlans.find((p) => p.id === plan)?.name ?? "selected";
    throw new Error(
      `The ${planName} plan isn't available for checkout yet. Please try again later or book a demo.`,
    );
  }

  const { data: profile, error } = await context.supabase
    .from("studio_profiles")
    .select("studio_name, billing_status, plan")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Could not load your studio details.");
  // billing_status and plan are server-managed. Checkout is allowed for a new studio, or for one whose
  // subscription ended (cancelled and expired back to the waitlist); a cancelled studio still holding a
  // paid plan has time left and is refused.
  if (profile && profile.billing_status !== "not_started") {
    const ended = profile.billing_status === "cancelled" && profile.plan === "waitlist";
    if (!ended) throw new Error("Your studio already has a subscription.");
  }

  const client = new DodoPayments({
    bearerToken: process.env["DODO_PAYMENTS_API_KEY"],
    environment:
      process.env["DODO_PAYMENTS_ENVIRONMENT"] === "live_mode" ? "live_mode" : "test_mode",
  });
  const baseUrl = (process.env["PUBLIC_APP_URL"] || context.requestOrigin).replace(/\/+$/, "");
  let checkoutUrl: string | null | undefined;
  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${baseUrl}/account?billing=success`,
      metadata: {
        user_id: context.userId,
        plan,
        studio_name: profile?.studio_name ?? "",
      },
    });
    checkoutUrl = session.checkout_url;
  } catch (err) {
    console.error("[billing] Dodo checkout session failed", err);
  }
  if (!checkoutUrl) throw new Error("Could not start checkout. Please try again.");
  return { checkoutUrl };
}
