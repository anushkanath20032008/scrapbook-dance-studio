import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, uuid, validate } from "@/lib/validators";

// Make-up classes: open to the owner and to a Dance teacher. The database functions refuse anyone else.
export const getMakeupBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/makeups.server")).listMakeupBatches(context));

export const getAbsentees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, date: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/makeups.server")).listAbsentees(context, data),
  );

export const planMakeup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        batchId: uuid,
        missedOn: isoDate,
        studentIds: z.array(uuid).min(1, "Choose at least one dancer").max(200),
        makeupBatchId: uuid,
        makeupOn: isoDate,
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/makeups.server")).planMakeup(context, data),
  );

export const getMakeups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/makeups.server")).listMakeups(context));

export const completeMakeup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/makeups.server")).finishMakeup(context, data),
  );
