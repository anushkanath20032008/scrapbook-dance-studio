import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { feePlanInput } from "@/lib/schemas";
import { isoDate, listLimit, uuid, validate } from "@/lib/validators";

export const listFeePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(z.object({ includeArchived: z.boolean().default(false), limit: listLimit })),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/fees.server")).listFeePlans(context, data),
  );

export const saveFeePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(feePlanInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/fees.server")).saveFeePlan(context, data),
  );

export const setFeePlanArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid, archived: z.boolean() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/fees.server")).setFeePlanArchived(context, data),
  );

export const assignFeePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studentId: uuid, planId: uuid, startsOn: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/fees.server")).assignFeePlan(context, data),
  );

export const listAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studentId: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/fees.server")).listAssignments(context, data),
  );
