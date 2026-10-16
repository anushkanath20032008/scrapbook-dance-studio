import { unwrap, type StudioContext } from "./studio.server";
import { firstOfMonth } from "./validators";

export async function generateCharges(
  { supabase }: StudioContext,
  input: { period: string; dueOn?: string | undefined },
) {
  const created = unwrap(
    await supabase.rpc("generate_monthly_charges", {
      p_period: firstOfMonth(input.period),
      ...(input.dueOn ? { p_due_on: input.dueOn } : {}),
    }),
  );
  return { created };
}

/** Record a payment received outside ChoreoStudio. A repeated idempotency key returns the original payment. */
export async function recordPayment(
  { supabase }: StudioContext,
  input: {
    studentId: string;
    amountPaise: number;
    method: string;
    paidOn: string;
    note: string | null;
    idempotencyKey: string;
  },
) {
  return unwrap(
    await supabase.rpc("record_payment", {
      p_student: input.studentId,
      p_amount_paise: input.amountPaise,
      p_method: input.method,
      p_paid_on: input.paidOn,
      p_note: input.note,
      p_idempotency_key: input.idempotencyKey,
    }),
  );
}

async function voidEntry(
  context: StudioContext,
  table: "charges" | "payments",
  input: { id: string; reason: string },
) {
  const result = await context.supabase
    .from(table)
    .update({ voided_at: new Date().toISOString(), void_reason: input.reason })
    .eq("id", input.id)
    .select("id, voided_at, void_reason")
    .maybeSingle();
  return unwrap(
    result,
    table === "charges" ? "That charge was not found." : "That payment was not found.",
  );
}

export const voidCharge = (context: StudioContext, input: { id: string; reason: string }) =>
  voidEntry(context, "charges", input);
export const voidPayment = (context: StudioContext, input: { id: string; reason: string }) =>
  voidEntry(context, "payments", input);

export async function getLedgerStatus({ supabase }: StudioContext, input: { period: string }) {
  return unwrap(
    await supabase.rpc("student_ledger_status", { p_period: firstOfMonth(input.period) }),
  );
}

export async function getOverview({ supabase }: StudioContext, input: { period: string }) {
  const [overview] = unwrap(
    await supabase.rpc("ledger_overview", { p_period: firstOfMonth(input.period) }),
  );
  return (
    overview ?? {
      billed_paise: 0,
      collected_paise: 0,
      outstanding_paise: 0,
      pending_students: 0,
      overdue_students: 0,
      total_students: 0,
    }
  );
}

/** Every charge and payment for one student, voided ones included and marked, with the running balance. */
export async function getStudentLedger({ supabase }: StudioContext, input: { studentId: string }) {
  const charges = unwrap(
    await supabase
      .from("charges")
      .select("id, period, due_on, amount_paise, fee_plan_name, voided_at, void_reason")
      .eq("student_id", input.studentId)
      .order("period", { ascending: false })
      .limit(240),
  );
  const payments = unwrap(
    await supabase
      .from("payments")
      .select("id, amount_paise, method, paid_on, note, voided_at, void_reason")
      .eq("student_id", input.studentId)
      .order("paid_on", { ascending: false })
      .limit(500),
  );
  const live = <T extends { voided_at: string | null; amount_paise: number }>(rows: T[]) =>
    rows
      .filter((row) => row.voided_at === null)
      .reduce((total, row) => total + row.amount_paise, 0);
  return { charges, payments, balance_paise: live(charges) - live(payments) };
}
