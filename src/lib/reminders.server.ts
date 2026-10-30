import { unwrap, type StudioContext } from "./studio.server";
import { firstOfMonth, todayInIndia } from "./validators";

type Choice = {
  period: string;
  studentId?: string | undefined;
  onlyOverdue?: boolean | undefined;
};

const choiceArgs = (input: Choice) => ({
  p_period: firstOfMonth(input.period),
  p_today: todayInIndia(),
  ...(input.studentId ? { p_student: input.studentId } : {}),
  ...(input.onlyOverdue ? { p_only_overdue: true } : {}),
});

/**
 * Queue reminders for the month: for one dancer when a student is given, otherwise everyone with a due or
 * overdue charge (only overdue when asked). Safe to repeat: each day's reminder is queued once per charge.
 */
export async function queueReminders({ supabase }: StudioContext, input: Choice) {
  const queued = unwrap(await supabase.rpc("queue_fee_reminders", choiceArgs(input)));
  return { queued };
}

/** Who would be messaged, and who would be skipped and why, for the same choice. Changes nothing. */
export async function previewReminders({ supabase }: StudioContext, input: Choice) {
  return unwrap(await supabase.rpc("preview_fee_reminders", choiceArgs(input)));
}

/** Whether a WhatsApp provider is configured, so the console can say honestly that reminders are only queued. */
export function getMessagingStatus() {
  const configured = Boolean(
    (process.env["VOBIZ_AUTH_ID"] && process.env["VOBIZ_AUTH_TOKEN"] && process.env["VOBIZ_CHANNEL_ID"] && process.env["VOBIZ_WABA_ID"]) ||
      (process.env["WHATSAPP_PHONE_NUMBER_ID"] && process.env["WHATSAPP_ACCESS_TOKEN"]) ||
      (process.env["WHATSAPP_PROVIDER_URL"] && process.env["WHATSAPP_PROVIDER_TOKEN"]),
  );
  return { providerConfigured: configured };
}

/** Whether automated WhatsApp is switched on for the studio, and whether its plan allows it. */
export async function getAutomation({ supabase }: StudioContext) {
  const row = unwrap(await supabase.rpc("whatsapp_automation_status"))[0];
  return { studioPlus: row?.studio_plus ?? false, enabled: row?.enabled ?? false };
}

/** Switch automation on or off. The database refuses turning it on without an active Studio+ plan. */
export async function setAutomation({ supabase }: StudioContext, input: { on: boolean }) {
  return { enabled: unwrap(await supabase.rpc("set_whatsapp_automation", { p_on: input.on })) };
}

export async function listReminders(
  { supabase }: StudioContext,
  input: { status?: string | undefined; limit: number },
) {
  let query = supabase
    .from("reminders")
    .select(
      "id, student_id, guardian_id, charge_id, kind, status, attempts, next_attempt_at, sent_at, delivery_status, delivered_at, last_error, created_at, payload",
    )
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.status) query = query.eq("status", input.status);
  return unwrap(await query);
}

/** Clears one of the studio's own queued reminders (marked cancelled, never deleted). */
export async function dismissReminder({ supabase }: StudioContext, input: { id: string }) {
  const dismissed = unwrap(await supabase.rpc("dismiss_reminder", { p_id: input.id }));
  if (!dismissed) throw new Error("That reminder is no longer waiting to send.");
  return { dismissed: true };
}
