import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requestCountry } from "@/lib/country.functions";

const planSchema = z.enum(["starter", "growth", "studio"]);

// The Dodo SDK and its secrets live in billing.server.ts, loaded only inside the server handler.
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ plan: planSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { startSubscriptionCheckout } = await import("@/lib/billing.server");
    return startSubscriptionCheckout(data.plan, {
      supabase: context.supabase,
      userId: context.userId,
      requestOrigin: new URL(getRequest().url).origin,
      country: requestCountry(getRequest()),
    });
  });

/** Opens Dodo's hosted billing page for a studio that already pays. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { openBillingPortal: open } = await import("@/lib/billing.server");
    return open({
      supabase: context.supabase,
      userId: context.userId,
      requestOrigin: new URL(getRequest().url).origin,
    });
  });

/** Whether paid plans can be bought and the billing page opened yet. */
export const getBillingAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { billingAvailability } = await import("@/lib/billing.server");
    return billingAvailability();
  });
