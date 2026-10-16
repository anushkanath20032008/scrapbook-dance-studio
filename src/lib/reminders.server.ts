import { unwrap, type StudioContext } from "./studio.server";
import { firstOfMonth, todayInIndia } from "./validators";

/** Queue a reminder for every unpaid charge of the month that is due or overdue. Safe to repeat: each day's reminder is queued once. */
export async function queueReminders({ supabase }: StudioContext, input: { period: string }) {
  const queued = unwrap(
    await supabase.rpc("queue_fee_reminders", {
      p_period: firstOfMonth(input.period),
      p_today: todayInIndia(),
    }),
  );
  return { queued };
}

export async function listReminders(
  { supabase }: StudioContext,
  input: { status?: string | undefined; limit: number },
) {
  let query = supabase
    .from("reminders")
    .select(
      "id, student_id, guardian_id, charge_id, kind, status, attempts, next_attempt_at, sent_at, last_error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.status) query = query.eq("status", input.status);
  return unwrap(await query);
}
