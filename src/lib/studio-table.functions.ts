import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { paymentMethods } from "@/lib/schemas";
import { isoDate, uuid, validate } from "@/lib/validators";

const tableInput = z.object({ period: isoDate, date: isoDate });

export const getStudioTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(tableInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/studio-table.server")).getStudioTable(context, data),
  );

export const getTeacherTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ date: isoDate })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/studio-table.server")).getTeacherTable(context, data),
  );

export const markBatchPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        batchId: uuid,
        method: z.enum(paymentMethods),
        paidOn: isoDate,
        period: isoDate,
        studentIds: z.array(uuid).min(1, "Pick at least one dancer").max(300),
        idempotencyKey: z.string().min(8).max(100),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/studio-table.server")).markBatchPaid(context, data),
  );

export const undoBatchPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ paymentIds: z.array(uuid).min(1).max(300) })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/studio-table.server")).undoBatchPaid(context, data),
  );
