import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, listLimit, validate } from "@/lib/validators";

const queueInput = z.object({ period: isoDate });
const listInput = z.object({
  status: z.enum(["queued", "sending", "sent", "failed"]).optional(),
  limit: listLimit,
});

export const queueReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(queueInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/reminders.server")).queueReminders(context, data),
  );

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(listInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/reminders.server")).listReminders(context, data),
  );
