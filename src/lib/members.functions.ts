import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { joinInput, memberClaimInput } from "@/lib/schemas";
import { uuid, validate } from "@/lib/validators";

// Owner side: invites and who has joined. Runs under the owner's rights.
export const createMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        guardianId: uuid,
        days: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    const baseUrl = process.env["PUBLIC_APP_URL"] || new URL(getRequest().url).origin;
    return (await import("@/lib/members.server")).createInvite(context, data, baseUrl);
  });

export const listMemberAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ guardianId: uuid.optional() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/members.server")).listMemberAccess(context, data),
  );

export const revokeMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/members.server")).revokeInvite(context, data),
  );

export const removeMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/members.server")).removeAccess(context, data),
  );

// Dancer side: every call runs on the dancer's own sign-in, so the database decides what they can reach.
export const redeemMemberInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(joinInput))
  .handler(async ({ data, context }) => {
    const members = await import("@/lib/members.server");
    const source = members.sourceTag(getRequest().headers.get("x-forwarded-for"));
    return members.redeemInvite(context, data, source);
  });

export const listMyStudios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/members.server")).listMyStudios(context));

export const getMemberView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studioId: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/members.server")).getMemberView(context, data),
  );

export const listMemberClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studioId: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/members.server")).listMemberClaims(context, data),
  );

export const submitMemberClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(memberClaimInput))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/members.server")).submitMemberClaim(context, supabaseAdmin, data);
  });
