// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newBatch, newGuardian, newStudent, newStudio, payment } from "./fixtures";

type Unpaid = {
  student_name: string;
  due_on: string;
  amount_paise: string;
  outstanding_paise: string;
  days_overdue: number;
  status: string;
  phone: string | null;
};
type Snapshot = Record<string, string | number>;

describe("console reports: unpaid list and month snapshot", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const generate = (owner: string, period: string, dueOn: string) =>
    db.query({ user: owner }, "SELECT public.generate_monthly_charges($1::date, $2::date)", [
      period,
      dueOn,
    ]);
  const unpaid = (owner: string, period: string, today: string) =>
    db.query<Unpaid>(
      { user: owner },
      "SELECT student_name, due_on::text, amount_paise::text, outstanding_paise::text, days_overdue, status, phone FROM public.unpaid_students($1::date, $2::date)",
      [period, today],
    );
  const snapshot = (owner: string, period: string, today: string) =>
    db
      .query<Snapshot>(
        { user: owner },
        "SELECT billed_paise::text, collected_paise::text, missing_paise::text, overdue_paise::text, not_yet_due_paise::text, active_students, charged_students, paid_students, ongoing_batches FROM public.studio_snapshot($1::date, $2::date)",
        [period, today],
      )
      .then((rows) => rows[0]);

  it("AE6: three owe 1,500 and one is past due, so 4,500 is missing with 1,500 overdue", async () => {
    const owner = await newStudio(db);
    for (const name of ["Asha", "Bela", "Chitra"])
      await newStudent(db, owner, name, { amountPaise: 150000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    // Charges are due on the 5th, so on the 6th all three are past due; make two of them due later.
    await db.admin(
      "UPDATE public.charges SET due_on = '2026-10-20' WHERE student_id IN (SELECT id FROM public.students WHERE name IN ('Bela', 'Chitra'))",
    );
    const snap = await snapshot(owner, "2026-10-01", "2026-10-06");
    expect(snap).toMatchObject({
      billed_paise: "450000",
      collected_paise: "0",
      missing_paise: "450000",
      overdue_paise: "150000",
      not_yet_due_paise: "300000",
      charged_students: 3,
      paid_students: 0,
    });
  });

  it("counts days overdue from the due date, zero on the due date, oldest first", async () => {
    const owner = await newStudio(db);
    const g = await newGuardian(db, owner, "Contact");
    await newStudent(db, owner, "Early", { amountPaise: 100000, guardian: g });
    await newStudent(db, owner, "Late", { amountPaise: 100000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    await db.admin(
      "UPDATE public.charges SET due_on = '2026-10-01' WHERE student_id IN (SELECT id FROM public.students WHERE name = 'Late')",
    );
    const onDueDate = await unpaid(owner, "2026-10-01", "2026-10-05");
    expect(onDueDate.map((r) => [r.student_name, r.days_overdue])).toEqual([
      ["Late", 4],
      ["Early", 0],
    ]);
    const later = await unpaid(owner, "2026-10-01", "2026-10-09");
    expect(later.map((r) => [r.student_name, r.days_overdue, r.status])).toEqual([
      ["Late", 8, "overdue"],
      ["Early", 4, "overdue"],
    ]);
    expect(later.find((r) => r.student_name === "Early")?.phone).toBe("+91 98765 43210");
    expect(later.find((r) => r.student_name === "Late")?.phone).toBeNull();
  });

  it("drops a fully paid student and shrinks a part-paid amount", async () => {
    const owner = await newStudio(db);
    const full = await newStudent(db, owner, "Full", { amountPaise: 150000 });
    const part = await newStudent(db, owner, "Part", { amountPaise: 150000 });
    await newStudent(db, owner, "Nothing", { amountPaise: 150000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    await payment(db, owner, full.id, 150000);
    await payment(db, owner, part.id, 100000);
    const rows = await unpaid(owner, "2026-10-01", "2026-10-06");
    expect(rows.map((r) => [r.student_name, r.outstanding_paise])).toEqual([
      ["Nothing", "150000"],
      ["Part", "50000"],
    ]);
    const snap = await snapshot(owner, "2026-10-01", "2026-10-06");
    expect(snap).toMatchObject({
      collected_paise: "250000",
      missing_paise: "200000",
      charged_students: 3,
      paid_students: 1,
    });
  });

  it("never lists a voided charge", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Voided", { amountPaise: 150000 });
    await newStudent(db, owner, "Kept", { amountPaise: 150000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    await db.query(
      { user: owner },
      "UPDATE public.charges SET voided_at = now(), void_reason = 'entered by mistake' WHERE student_id IN (SELECT id FROM public.students WHERE name = 'Voided')",
    );
    expect((await unpaid(owner, "2026-10-01", "2026-10-06")).map((r) => r.student_name)).toEqual([
      "Kept",
    ]);
    expect(await snapshot(owner, "2026-10-01", "2026-10-06")).toMatchObject({
      billed_paise: "150000",
      charged_students: 1,
    });
  });

  it("does not let one student's credit reduce another student's amount", async () => {
    const owner = await newStudio(db);
    const rich = await newStudent(db, owner, "Rich", { amountPaise: 100000 });
    await newStudent(db, owner, "Owes", { amountPaise: 100000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    await payment(db, owner, rich.id, 500000);
    const rows = await unpaid(owner, "2026-10-01", "2026-10-06");
    expect(rows.map((r) => [r.student_name, r.outstanding_paise])).toEqual([["Owes", "100000"]]);
    expect((await snapshot(owner, "2026-10-01", "2026-10-06"))["missing_paise"]).toBe("100000");
  });

  it("counts active dancers and ongoing batches, ignoring archived ones", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Active");
    const gone = await newStudent(db, owner, "Archived");
    await db.admin("UPDATE public.students SET archived_at = now() WHERE id = $1", [gone.id]);
    await newBatch(db, owner, "Running");
    const old = await newBatch(db, owner, "Old");
    await db.admin("UPDATE public.batches SET archived_at = now() WHERE id = $1", [old]);
    const snap = await snapshot(owner, "2026-10-01", "2026-10-06");
    expect(snap).toMatchObject({
      active_students: 1,
      ongoing_batches: 1,
      charged_students: 0,
      billed_paise: "0",
    });
  });

  it("never shows another studio's dancers or money", async () => {
    const mine = await newStudio(db);
    const theirs = await newStudio(db);
    await newStudent(db, theirs, "Stranger", { amountPaise: 900000 });
    await generate(theirs, "2026-10-01", "2026-10-05");
    expect(await unpaid(mine, "2026-10-01", "2026-10-06")).toEqual([]);
    expect(await snapshot(mine, "2026-10-01", "2026-10-06")).toMatchObject({
      billed_paise: "0",
      missing_paise: "0",
      active_students: 0,
    });
  });

  it("is not available to anonymous callers", async () => {
    expect(
      await rejection(
        db.query("anon", "SELECT * FROM public.unpaid_students('2026-10-01'::date, NULL)"),
      ),
    ).toMatch(/permission denied/i);
    expect(
      await rejection(
        db.query("anon", "SELECT * FROM public.studio_snapshot('2026-10-01'::date, NULL)"),
      ),
    ).toMatch(/permission denied/i);
  });
});
