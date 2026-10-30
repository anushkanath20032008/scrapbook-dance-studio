import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, listLimit, uuid, validate } from "@/lib/validators";

const queueInput = z.object({
  period: isoDate,
  studentId: uuid.optional(),
  onlyOverdue: z.boolean().optional(),
});
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

export const previewReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(queueInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/reminders.server")).previewReminders(context, data),
  );

export const getMessagingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => (await import("@/lib/reminders.server")).getMessagingStatus());

export const dismissReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/reminders.server")).dismissReminder(context, data),
  );
