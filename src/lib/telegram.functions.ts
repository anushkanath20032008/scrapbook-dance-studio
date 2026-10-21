import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isoDate, uuid, validate } from "@/lib/validators";

const periodInput = z.object({ period: isoDate });

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => (await import("@/lib/telegram.server")).getTelegramStatus());

export const createTelegramInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ guardianId: uuid })))
  .handler(async ({ data, context }) => {
    const telegram = await import("@/lib/telegram.server");
    const config = telegram.telegramConfig();
    if (!config) throw new Error("Telegram reminders are not set up yet.");
    return telegram.createTelegramInvite(context, data, config.username);
  });

export const listTelegramLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ guardianId: uuid.optional() })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/telegram.server")).listTelegramLinks(context, data),
  );

export const revokeTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ id: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/telegram.server")).revokeTelegramLink(context, data),
  );

export const listTelegramRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(periodInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/telegram.server")).listTelegramRecipients(context, data),
  );

export const sendTelegramReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(periodInput.extend({ chargeIds: z.array(uuid).min(1).max(500) })))
  .handler(async ({ data, context }) => {
    const telegram = await import("@/lib/telegram.server");
    const config = telegram.telegramConfig();
    if (!config) throw new Error("Telegram reminders are not set up yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return telegram.sendTelegramReminders(
      context,
      supabaseAdmin,
      telegram.createTelegramClient(config.token),
      data,
    );
  });
