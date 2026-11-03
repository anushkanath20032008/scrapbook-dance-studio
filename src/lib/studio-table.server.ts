import { listBatches } from "./batches.server";
import { getInstructorBatchDay, getInstructorBatches } from "./instructors.server";
import { recordPayment, voidPayment } from "./ledger.server";
import { unwrap, type StudioContext } from "./studio.server";
import {
  UNDO_WINDOW_MS,
  type PayStatus,
  type TableBatch,
  type TeacherBatch,
} from "./studio-table";
import { firstOfMonth } from "./validators";

const meetsOn = (weekdays: number[], date: string) =>
  weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());

const statusOf = (value: string | undefined): PayStatus =>
  value === "paid" || value === "due" || value === "overdue" ? value : "none";

/** Every active batch with its dancers, what each owes this month, and today's attendance mark. */
export async function getStudioTable(
  context: StudioContext,
  input: { period: string; date: string },
): Promise<TableBatch[]> {
  const { supabase } = context;
  const batches = await listBatches(context, { includeArchived: false, limit: 100 });
  if (batches.length === 0) return [];

  const [days, ledger] = await Promise.all([
    Promise.all(
      batches.map(async (batch) =>
        unwrap(await supabase.rpc("batch_day", { p_batch: batch.id, p_on: input.date })),
      ),
    ),
    supabase.rpc("student_ledger_status", { p_period: firstOfMonth(input.period) }),
  ]);
  const charges = new Map(unwrap(ledger).map((row) => [row.student_id, row]));

  return batches.map((batch, index) => ({
    id: batch.id,
    name: batch.name,
    weekdays: batch.weekdays,
    startsAt: batch.starts_at,
    endsAt: batch.ends_at,
    meetsToday: meetsOn(batch.weekdays, input.date),
    rows: days[index]!.map((member) => {
      const charge = charges.get(member.student_id);
      return {
        studentId: member.student_id,
        name: member.student_name,
        feePaise: Number(charge?.amount_paise ?? 0),
        outstandingPaise: Number(charge?.outstanding_paise ?? 0),
        status: statusOf(charge?.status),
        present: member.present,
      };
    }),
  }));
}

/** The teacher's batches and dancers with attendance only: this payload has no money fields at all. */
export async function getTeacherTable(
  context: StudioContext,
  input: { date: string },
): Promise<TeacherBatch[]> {
  const batches = await getInstructorBatches(context);
  return Promise.all(
    batches.map(async (batch) => {
      const day = await getInstructorBatchDay(context, { batchId: batch.id, date: input.date });
      return {
        id: batch.id,
        name: batch.name,
        weekdays: batch.weekdays,
        startsAt: batch.starts_at,
        endsAt: batch.ends_at,
        meetsToday: meetsOn(batch.weekdays, input.date),
        rows: day.map((member) => ({
          studentId: member.student_id,
          name: member.student_name,
          present: member.present,
        })),
      };
    }),
  );
}

export type BatchPaidInput = {
  batchId: string;
  method: string;
  paidOn: string;
  period: string;
  studentIds: string[];
  idempotencyKey: string;
};

/**
 * Record a payment for each chosen dancer in a batch, for exactly what they owe this month. Each payment gets
 * its own key built from the batch key, so a retry cannot record anyone twice. Dancers who fail are listed;
 * the rest stay recorded.
 */
export async function markBatchPaid(context: StudioContext, input: BatchPaidInput) {
  const ledger = unwrap(
    await context.supabase.rpc("student_ledger_status", {
      p_period: firstOfMonth(input.period),
      p_student_ids: input.studentIds,
    }),
  );
  const paymentIds: string[] = [];
  const failed: { studentId: string; reason: string }[] = [];
  let totalPaise = 0;
  for (const row of ledger) {
    const owed = Number(row.balance_paise);
    if (owed <= 0) continue;
    try {
      const result = await recordPayment(context, {
        studentId: row.student_id,
        amountPaise: owed,
        method: input.method,
        paidOn: input.paidOn,
        note: "Marked paid for the whole batch",
        idempotencyKey: `${input.idempotencyKey}:${row.student_id}`,
      });
      paymentIds.push(result.id);
      totalPaise += owed;
    } catch (error) {
      failed.push({
        studentId: row.student_id,
        reason: error instanceof Error ? error.message : "Could not record this payment",
      });
    }
  }
  return { paymentIds, totalPaise, failed };
}

/** Void the payments from one bulk "mark paid", only while they are under ten minutes old. */
export async function undoBatchPaid(context: StudioContext, input: { paymentIds: string[] }) {
  const payments = unwrap(
    await context.supabase
      .from("payments")
      .select("id, created_at, voided_at")
      .in("id", input.paymentIds),
  );
  const live = payments.filter((payment) => payment.voided_at === null);
  if (live.some((payment) => Date.now() - new Date(payment.created_at).getTime() > UNDO_WINDOW_MS))
    throw new Error("It's too late to undo this. Void the payments one by one instead.");
  for (const payment of live)
    await voidPayment(context, { id: payment.id, reason: "Undone right after marking the batch paid" });
  return { undone: live.length };
}
