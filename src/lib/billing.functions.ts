import { createServerFn } from "@tanstack/react-start";
import DodoPayments from "dodopayments";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studioPlans, type StudioPlanId } from "@/lib/plans";

const planSchema = z.enum(["starter", "growth", "studio"]);

// Product IDs and the API key stay in server-only environment variables.
function productIdFor(plan: StudioPlanId) {
  const ids: Record<StudioPlanId, string | undefined> = {
    starter: process.env.DODO_PAYMENTS_STARTER_PRODUCT_ID,
    growth: process.env.DODO_PAYMENTS_GROWTH_PRODUCT_ID,
    studio: process.env.DODO_PAYMENTS_STUDIO_PRODUCT_ID,
  };
  return ids[plan]?.trim() || undefined;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plan: planSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const productId = productIdFor(data.plan);
    if (!productId || !process.env.DODO_PAYMENTS_API_KEY) {
      const planName = studioPlans.find((plan) => plan.id === data.plan)?.name ?? "selected";
      throw new Error(
        `The ${planName} plan isn't available for checkout yet. Please try again later or book a demo.`,
      );
    }

    const { data: profile, error } = await context.supabase
      .from("studio_profiles")
      .select("studio_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your studio details.");

    const client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment:
        process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
    });
    const baseUrl = (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
    let checkoutUrl: string | null | undefined;
    try {
      const session = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        return_url: `${baseUrl}/account?billing=success`,
        metadata: {
          user_id: context.userId,
          plan: data.plan,
          studio_name: profile?.studio_name ?? "",
        },
      });
      checkoutUrl = session.checkout_url;
    } catch (err) {
      console.error("[billing] Dodo checkout session failed", err);
    }
    if (!checkoutUrl) throw new Error("Could not start checkout. Please try again.");
    return { checkoutUrl };
  });
