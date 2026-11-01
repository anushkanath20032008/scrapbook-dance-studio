import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uuid, validate } from "@/lib/validators";

export const createFamilyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ guardianId: uuid })))
  .handler(async ({ data, context }) => {
    const baseUrl = process.env["PUBLIC_APP_URL"] || new URL(getRequest().url).origin;
    return (await import("@/lib/family.server")).createFamilyLink(context, data, baseUrl);
  });

export const listFamilyLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ guardianId: uuid.optional() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/family.server")).listFamilyLinks(context, data),
  );

export const revokeFamilyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/family.server")).revokeFamilyLink(context, data),
  );

// Public: no sign-in, access is the unguessable token itself.
export const getFamilyView = createServerFn({ method: "GET" })
  .inputValidator(validate(z.object({ token: z.string().min(1).max(200) })))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await import("@/lib/family.server")).getFamilyView(supabaseAdmin, data.token);
  });

/** The private pay-claim link for each dancer, made on first use, so reminders can carry it. */
export const getReminderLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studentIds: z.array(uuid).min(1).max(200) })))
  .handler(async ({ data, context }) => {
    const baseUrl = process.env["PUBLIC_APP_URL"] || new URL(getRequest().url).origin;
    return (await import("@/lib/family.server")).reminderLinksForStudents(context, data, baseUrl);
  });
