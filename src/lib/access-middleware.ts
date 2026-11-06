import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studioAccess, SUBSCRIBE_MESSAGE } from "./access.server";

/**
 * Put this after requireSubscription on every server function that changes studio data. Reading stays open so an
 * owner whose free month ended can still see everything and decide to subscribe.
 */
export const requireSubscription = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const access = await studioAccess(context.supabase, context.userId);
    if (!access.hasAccess) throw new Error(access.reason ?? SUBSCRIBE_MESSAGE);
    return next();
  });
