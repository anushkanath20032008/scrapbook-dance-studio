import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimInput } from "@/lib/schemas";
import { paise, uuid, validate, voidReason } from "@/lib/validators";

// Public: no sign-in. Access is the unguessable family-link token, checked on the server.
export const submitClaim = createServerFn({ method: "POST" })
  .inputValidator(validate(claimInput))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/claims.server")).submitClaim(supabaseAdmin, data);
  });

export const listMyClaims = createServerFn({ method: "GET" })
  .inputValidator(validate(z.object({ token: z.string().min(1).max(200) })))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/claims.server")).listMyClaims(supabaseAdmin, data.token);
  });

export const listClaimQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/claims.server")).listClaimQueue(context));

export const confirmClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        claimId: uuid,
        amountPaise: paise.optional(),
        acknowledgeExcess: z.boolean().default(false),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/claims.server")).confirmClaim(context, supabaseAdmin, data);
  });

export const rejectClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ claimId: uuid, reason: voidReason })))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/claims.server")).rejectClaim(context, supabaseAdmin, data);
  });

export const getClaimScreenshotUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ claimId: uuid })))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/claims.server")).getClaimScreenshotUrl(
      context,
      supabaseAdmin,
      data,
    );
  });
