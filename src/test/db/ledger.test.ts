// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newPlan, newStudent, newStudio, payment } from "./fixtures";

type Status = {
  student_id: string;
  charge_id: string;
  period: string;
  due_on: string;
  amount_paise: string;
  allocated_paise: string;
  outstanding_paise: string;
  status: string;
  fee_plan_name: string;
  balance_paise: string;
};

describe("ledger: charges, payments and derived status", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const generate = (owner: string, period: string, dueOn: string | null = null) =>
    db
      .query<{ n: number }>(
        { user: owner },
        "SELECT public.generate_monthly_charges($1::date, $2::date) AS n",
        [period, dueOn],
      )
      .then((rows) => rows[0].n);

  const status = (
    owner: string,
    period: string,
    today: string,
    studentIds: string[] | null = null,
  ) =>
    db.query<Status>(
      { user: owner },
      "SELECT student_id, charge_id, period::text, due_on::text, amount_paise::text, allocated_paise::text, outstanding_paise::text, status, fee_plan_name, balance_paise::text FROM public.student_ledger_status($1::date, $2::date, $3::uuid[]) ORDER BY fee_plan_name",
      [period, today, studentIds],
    );

  it("charges two students in one batch different amounts for the same month", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Ananya", { amountPaise: 900000, planName: "Eight classes" });
    await newStudent(db, owner, "Arjun", { amountPaise: 500000, planName: "Four classes" });
    expect(await generate(owner, "2026-10-01")).toBe(2);
    const rows = await status(owner, "2026-10-01", "2026-10-03");
    expect(rows.map((r) => [r.fee_plan_name, r.amount_paise, r.due_on])).toEqual([
      ["Eight classes", "900000", "2026-10-05"],
      ["Four classes", "500000", "2026-10-05"],
    ]);
  });

  it("creates charges once however many times generation runs, and treats any day of the month as the month", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Kabir", { amountPaise: 700000 });
    expect(await generate(owner, "2026-10-17")).toBe(1);
    expect(await generate(owner, "2026-10-01")).toBe(0);
    const [{ period }] = await status(owner, "2026-10-01", "2026-10-03");
    expect(period).toBe("2026-10-01");
  });

  it("does not charge students without an assignment covering the month, or archived students", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "No plan");
    await newStudent(db, owner, "Starts later", { amountPaise: 100000, startsOn: "2026-12-01" });
    const archived = await newStudent(db, owner, "Archived", { amountPaise: 100000 });
    await db.admin("UPDATE public.students SET archived_at = now() WHERE id = $1", [archived.id]);
    expect(await generate(owner, "2026-10-01")).toBe(0);
  });

  it("uses the plan in effect at the start of the month, and a plan that starts mid-month for new joiners", async () => {
    const owner = await newStudio(db);
    const mover = await newStudent(db, owner, "Mover", {
      amountPaise: 900000,
      planName: "Old plan",
    });
    const newPlanId = await newPlan(db, owner, "New plan", 500000);
    await db.admin("SELECT public.assign_fee_plan($1, $2, DATE '2026-10-20')", [
      mover.id,
      newPlanId,
    ]);
    await newStudent(db, owner, "Joiner", {
      amountPaise: 300000,
      startsOn: "2026-10-15",
      planName: "Joiner plan",
    });
    expect(await generate(owner, "2026-10-01")).toBe(2);
    const rows = await status(owner, "2026-10-01", "2026-10-03");
    expect(rows.map((r) => [r.fee_plan_name, r.amount_paise])).toEqual([
      ["Joiner plan", "300000"],
      ["Old plan", "900000"],
    ]);
  });

  it("keeps a charge's plan and amount when the student later moves to another plan", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Diya", {
      amountPaise: 900000,
      planName: "Eight classes",
    });
    await generate(owner, "2026-10-01");
    const cheaper = await newPlan(db, owner, "Four classes", 500000);
    await db.admin("SELECT public.assign_fee_plan($1, $2, DATE '2026-11-01')", [s.id, cheaper]);
    await generate(owner, "2026-11-01");
    const october = await status(owner, "2026-10-01", "2026-11-02");
    const november = await status(owner, "2026-11-01", "2026-11-02");
    expect([october[0].fee_plan_name, october[0].amount_paise]).toEqual([
      "Eight classes",
      "900000",
    ]);
    expect([november[0].fee_plan_name, november[0].amount_paise]).toEqual([
      "Four classes",
      "500000",
    ]);
  });

  it("applies payments to the oldest charge first and keeps later charges untouched", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Mira", { amountPaise: 900000 });
    await generate(owner, "2026-10-01");
    await generate(owner, "2026-11-01");
    await payment(db, owner, s.id, 300000);
    const [october] = await status(owner, "2026-10-01", "2026-10-20");
    const [november] = await status(owner, "2026-11-01", "2026-10-20");
    expect([october.allocated_paise, october.outstanding_paise]).toEqual(["300000", "600000"]);
    expect([november.allocated_paise, november.outstanding_paise]).toEqual(["0", "900000"]);
  });

  it("splits one payment across two charges, and shows an overpayment as a negative balance", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Priya", { amountPaise: 900000 });
    await generate(owner, "2026-10-01");
    await generate(owner, "2026-11-01");
    await payment(db, owner, s.id, 1300000);
    const [october] = await status(owner, "2026-10-01", "2026-10-20");
    const [november] = await status(owner, "2026-11-01", "2026-10-20");
    expect([october.status, october.outstanding_paise]).toEqual(["paid", "0"]);
    expect([november.allocated_paise, november.outstanding_paise]).toEqual(["400000", "500000"]);
    await payment(db, owner, s.id, 1200000);
    const [settled] = await status(owner, "2026-11-01", "2026-10-20");
    expect([settled.status, settled.outstanding_paise, settled.balance_paise]).toEqual([
      "paid",
      "0",
      "-700000",
    ]);
  });

  it("calls a charge due before its due date, overdue after it, and paid once covered", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Ishaan", { amountPaise: 400000 });
    await generate(owner, "2026-10-01");
    expect((await status(owner, "2026-10-01", "2026-10-05"))[0].status).toBe("due");
    expect((await status(owner, "2026-10-01", "2026-10-06"))[0].status).toBe("overdue");
    await payment(db, owner, s.id, 400000);
    expect((await status(owner, "2026-10-01", "2026-10-06"))[0].status).toBe("paid");
  });

  it("stops counting a voided payment and a voided charge", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Sara", { amountPaise: 400000 });
    await generate(owner, "2026-10-01");
    const paymentId = await payment(db, owner, s.id, 400000);
    await db.query(
      { user: owner },
      "UPDATE public.payments SET voided_at = now(), void_reason = 'entered twice' WHERE id = $1",
      [paymentId],
    );
    expect((await status(owner, "2026-10-01", "2026-10-20"))[0].status).toBe("overdue");
    const [{ charge_id }] = await status(owner, "2026-10-01", "2026-10-20");
    await db.query(
      { user: owner },
      "UPDATE public.charges SET voided_at = now(), void_reason = 'fee waived' WHERE id = $1",
      [charge_id],
    );
    expect(await status(owner, "2026-10-01", "2026-10-20")).toEqual([]);
  });

  it("does not regenerate a voided charge", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Waived", { amountPaise: 400000 });
    await generate(owner, "2026-10-01");
    await db.query(
      { user: owner },
      "UPDATE public.charges SET voided_at = now(), void_reason = 'waived' WHERE studio_id = $1",
      [owner],
    );
    expect(await generate(owner, "2026-10-01")).toBe(0);
  });

  it("refuses a repeated payment idempotency key within a studio but allows it in another studio", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const s = await newStudent(db, owner, "Dup", { amountPaise: 100000 });
    const t = await newStudent(db, other, "Other", { amountPaise: 100000 });
    const insert = (who: string, student: string) =>
      db.query(
        { user: who },
        "INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, idempotency_key) VALUES ($1, $2, 100, 'cash', DATE '2026-10-06', 'same-key')",
        [who, student],
      );
    await insert(owner, s.id);
    expect(await rejection(insert(owner, s.id))).toMatch(/unique|duplicate/i);
    await insert(other, t.id);
  });

  it("rejects non-positive amounts and unknown payment methods", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Bad", { amountPaise: 100000 });
    const insert = (amount: number, method: string) =>
      db.query(
        { user: owner },
        "INSERT INTO public.payments (studio_id, student_id, amount_paise, method, paid_on, idempotency_key) VALUES ($1, $2, $3, $4, DATE '2026-10-06', gen_random_uuid()::text)",
        [owner, s.id, amount, method],
      );
    expect(await rejection(insert(0, "cash"))).toMatch(/check/i);
    expect(await rejection(insert(-5, "cash"))).toMatch(/check/i);
    expect(await rejection(insert(100, "bitcoin"))).toMatch(/check/i);
  });

  it("is immutable for owners except for voiding, and a void cannot be repeated or undone", async () => {
    const owner = await newStudio(db);
    const s = await newStudent(db, owner, "Locked", { amountPaise: 100000 });
    await generate(owner, "2026-10-01");
    const paymentId = await payment(db, owner, s.id, 50000);
    expect(
      await rejection(
        db.query({ user: owner }, "DELETE FROM public.payments WHERE id = $1", [paymentId]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.payments SET amount_paise = 1 WHERE id = $1", [
          paymentId,
        ]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query({ user: owner }, "DELETE FROM public.charges WHERE studio_id = $1", [owner]),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query({ user: owner }, "UPDATE public.payments SET voided_at = now() WHERE id = $1", [
          paymentId,
        ]),
      ),
    ).toMatch(/reason/i);
    await db.query(
      { user: owner },
      "UPDATE public.payments SET voided_at = now(), void_reason = 'typo' WHERE id = $1",
      [paymentId],
    );
    expect(
      await rejection(
        db.query(
          { user: owner },
          "UPDATE public.payments SET voided_at = now(), void_reason = 'again' WHERE id = $1",
          [paymentId],
        ),
      ),
    ).toMatch(/already voided/i);
    expect(
      await rejection(
        db.query(
          { user: owner },
          "UPDATE public.payments SET voided_at = NULL, void_reason = NULL WHERE id = $1",
          [paymentId],
        ),
      ),
    ).toMatch(/already voided/i);
  });

  it("scopes the status function to the given students even for the service role, and to the owner's own studio otherwise", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const a = await newStudent(db, owner, "A", { amountPaise: 100000, planName: "a" });
    const b = await newStudent(db, owner, "B", { amountPaise: 100000, planName: "b" });
    await newStudent(db, owner, "C", { amountPaise: 100000, planName: "c" });
    await newStudent(db, other, "Other", { amountPaise: 100000, planName: "x" });
    await generate(owner, "2026-10-01");
    await db.query({ user: other }, "SELECT public.generate_monthly_charges(DATE '2026-10-01')");
    const scoped = await db.query<{ student_id: string }>(
      "service",
      "SELECT student_id FROM public.student_ledger_status(DATE '2026-10-01', DATE '2026-10-03', $1::uuid[])",
      [[a.id, b.id]],
    );
    expect(scoped.map((r) => r.student_id).sort()).toEqual([a.id, b.id].sort());
    const asOther = await db.query(
      { user: other },
      "SELECT student_id FROM public.student_ledger_status(DATE '2026-10-01', DATE '2026-10-03')",
    );
    expect(asOther).toHaveLength(1);
  });

  it("reports totals and counts that agree with the per-student statuses", async () => {
    const owner = await newStudio(db);
    const paid = await newStudent(db, owner, "Paid", { amountPaise: 400000, planName: "p1" });
    await newStudent(db, owner, "Late", { amountPaise: 300000, planName: "p2" });
    const partial = await newStudent(db, owner, "Partial", { amountPaise: 200000, planName: "p3" });
    await generate(owner, "2026-10-01");
    await payment(db, owner, paid.id, 400000);
    await payment(db, owner, partial.id, 50000);
    const [overview] = await db.query<Record<string, string | number>>(
      { user: owner },
      "SELECT billed_paise::text, collected_paise::text, outstanding_paise::text, pending_students, overdue_students, total_students FROM public.ledger_overview(DATE '2026-10-01', DATE '2026-10-10')",
    );
    expect(overview).toEqual({
      billed_paise: "900000",
      collected_paise: "450000",
      outstanding_paise: "450000",
      pending_students: 2,
      overdue_students: 2,
      total_students: 3,
    });
    const early = await db.query<{ pending_students: number; overdue_students: number }>(
      { user: owner },
      "SELECT pending_students, overdue_students FROM public.ledger_overview(DATE '2026-10-01', DATE '2026-10-02')",
    );
    expect(early[0]).toEqual({ pending_students: 2, overdue_students: 0 });
  });

  it("hides another studio's ledger entirely", async () => {
    const owner = await newStudio(db);
    const other = await newStudio(db);
    const s = await newStudent(db, owner, "Private", { amountPaise: 100000 });
    await generate(owner, "2026-10-01");
    await payment(db, owner, s.id, 100);
    for (const table of ["charges", "payments"]) {
      expect(await db.query({ user: other }, `SELECT 1 FROM public.${table}`)).toEqual([]);
      expect(await db.query("anon", `SELECT 1 FROM public.${table}`).catch(() => [])).toEqual([]);
    }
  });

  describe("record_payment", () => {
    const record = (owner: string, student: string, amount: number, paidOn: string, key: string) =>
      db.query<{ id: string; amount_paise: string }>(
        { user: owner },
        "SELECT id, amount_paise::text FROM public.record_payment($1, $2, 'upi', $3::date, 'note', $4)",
        [student, amount, paidOn, key],
      );

    it("records a payment once and returns the same row for a repeated key", async () => {
      const owner = await newStudio(db);
      const s = await newStudent(db, owner, "Idem", { amountPaise: 100000 });
      const first = await record(owner, s.id, 40000, "2026-10-06", "key-aaaa");
      const again = await record(owner, s.id, 40000, "2026-10-06", "key-aaaa");
      expect(again[0].id).toBe(first[0].id);
      const [{ count }] = await db.query<{ count: number }>(
        { user: owner },
        "SELECT count(*)::int AS count FROM public.payments",
      );
      expect(count).toBe(1);
    });

    it("refuses a repeated key that describes a different payment", async () => {
      const owner = await newStudio(db);
      const s = await newStudent(db, owner, "Idem", { amountPaise: 100000 });
      await record(owner, s.id, 40000, "2026-10-06", "key-bbbb");
      expect(await rejection(record(owner, s.id, 50000, "2026-10-06", "key-bbbb"))).toMatch(
        /different payment/i,
      );
    });

    it("rejects future dates and other studios' students", async () => {
      const owner = await newStudio(db);
      const other = await newStudio(db);
      const s = await newStudent(db, owner, "Dated", { amountPaise: 100000 });
      expect(await rejection(record(owner, s.id, 100, "2099-01-01", "key-cccc"))).toMatch(
        /future/i,
      );
      expect(await rejection(record(other, s.id, 100, "2026-10-06", "key-dddd"))).toMatch(
        /not found/i,
      );
    });
  });
});
