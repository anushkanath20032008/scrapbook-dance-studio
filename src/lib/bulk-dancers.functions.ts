import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_PASTED_DANCERS } from "@/lib/bulk-dancers";
import { isoDate, paise, personName, phone, validate } from "@/lib/validators";

export const bulkAddDancers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        dancers: z
          .array(
            z.object({
              name: personName,
              phone: phone.nullable(),
              feePaise: paise.nullable(),
            }),
          )
          .min(1, "Paste at least one dancer")
          .max(MAX_PASTED_DANCERS, `Add up to ${MAX_PASTED_DANCERS} dancers at a time`),
        defaultFeePaise: paise.nullable(),
        billThisMonth: z.boolean(),
        dueOn: isoDate.optional(),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/bulk-dancers.server")).bulkAddDancers(context, data),
  );
