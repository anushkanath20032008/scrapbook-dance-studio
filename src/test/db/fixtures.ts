import type { TestDb } from "./harness";

/** A studio (owner account plus profile row). */
export async function newStudio(db: TestDb, label = "Studio"): Promise<string> {
  const owner = await db.addUser();
  await db.admin("INSERT INTO public.studio_profiles (user_id, studio_name) VALUES ($1, $2)", [owner, label]);
  return owner;
}

export async function newGuardian(db: TestDb, studio: string, name = "Guardian", extra: { optedOut?: boolean } = {}): Promise<string> {
  const [row] = await db.admin<{ id: string }>(
    "INSERT INTO public.guardians (studio_id, name, phone, reminders_opted_out) VALUES ($1, $2, '+91 98765 43210', $3) RETURNING id",
    [studio, name, extra.optedOut ?? false],
  );
  return row.id;
}

export async function newPlan(db: TestDb, studio: string, name: string, amountPaise: number): Promise<string> {
  const [row] = await db.admin<{ id: string }>(
    "INSERT INTO public.fee_plans (studio_id, name, amount_paise) VALUES ($1, $2, $3) RETURNING id",
    [studio, name, amountPaise],
  );
  return row.id;
}

/** A student on a fee plan from `startsOn`. Returns ids for the student and the plan. */
export async function newStudent(
  db: TestDb,
  studio: string,
  name: string,
  options: { amountPaise?: number; startsOn?: string; guardian?: string; planName?: string } = {},
): Promise<{ id: string; planId: string | null }> {
  const [student] = await db.admin<{ id: string }>(
    "INSERT INTO public.students (studio_id, name, guardian_id) VALUES ($1, $2, $3) RETURNING id",
    [studio, name, options.guardian ?? null],
  );
  if (options.amountPaise === undefined) return { id: student.id, planId: null };
  const planId = await newPlan(db, studio, options.planName ?? `${name} plan`, options.amountPaise);
  await db.admin("SELECT public.assign_fee_plan($1, $2, $3::date)", [student.id, planId, options.startsOn ?? "2026-10-01"]);
  return { id: student.id, planId };
}

export async function newBatch(db: TestDb, studio: string, name = "Batch"): Promise<string> {
  const [row] = await db.admin<{ id: string }>("INSERT INTO public.batches (studio_id, name) VALUES ($1, $2) RETURNING id", [studio, name]);
  return row.id;
}

let paymentCounter = 0;
export const payment = async (db: TestDb, owner: string, student: string, amountPaise: number, paidOn = "2026-10-06") =>
  db.query<{ id: string }>(
    { user: owner },
    "INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, idempotency_key) VALUES ($1, $2, $3, 'upi', $4::date, $5) RETURNING id",
    [owner, student, amountPaise, paidOn, `test-payment-${++paymentCounter}`],
  ).then((rows) => rows[0].id);
