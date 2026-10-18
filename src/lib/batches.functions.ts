import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { batchInput } from "@/lib/schemas";
import { isoDate, listLimit, uuid, validate } from "@/lib/validators";

export const listBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(z.object({ includeArchived: z.boolean().default(false), limit: listLimit })),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).listBatches(context, data),
  );

export const saveBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(batchInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).saveBatch(context, data),
  );

export const setBatchArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid, archived: z.boolean() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).setBatchArchived(context, data),
  );

export const addToBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(z.object({ batchId: uuid, studentId: uuid, joinedOn: isoDate.optional() })),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).addToBatch(context, data),
  );

export const removeFromBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(z.object({ batchId: uuid, studentId: uuid, leftOn: isoDate.optional() })),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).removeFromBatch(context, data),
  );

export const getRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ batchId: uuid, asOf: isoDate.optional() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/batches.server")).getRoster(context, data),
  );
