// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type TestDb } from "./harness";
import { newPlan, newStudent, newStudio } from "./fixtures";

describe("fee due day and back-dated fees", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const monthStart = (back: number) =>
    db
      .admin<{ d: string }>(
        "SELECT (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) - ($1::int || ' months')::interval)::date::text AS d",
        [back],
      )
      .then((rows) => rows[0].d);

  it("puts a due date past the end of a short month on its last day", async () => {
    const [row] = await db.admin<{ feb: string; oct: string; first: string }>(
      "SELECT public.charge_due_date('2027-02-01', 30)::text AS feb, public.charge_due_date('2026-10-01', 31)::text AS oct, public.charge_due_date('2026-10-01', 1)::text AS first",
    );
    expect(row).toEqual({ feb: "2027-02-28", oct: "2026-10-31", first: "2026-10-01" });
  });

  it("uses the studio's due day for a month's charges, and refuses a day outside 1 to 31", async () => {
    const owner = await newStudio(db);
    await newStudent(db, owner, "Asha", { amountPaise: 100000, startsOn: await monthStart(0) });
    await db.admin("UPDATE public.studio_profiles SET fee_due_day = 10 WHERE user_id = $1", [owner]);
    await db.query({ user: owner }, "SELECT public.generate_monthly_charges(($1)::date)", [await monthStart(0)]);
    const [charge] = await db.admin<{ due_on: string; period: string }>(
      "SELECT due_on::text, period::text FROM public.charges WHERE studio_id = $1",
      [owner],
    );
    expect(charge.due_on.slice(8)).toBe("10");
    await expect(
      db.admin("UPDATE public.studio_profiles SET fee_due_day = 32 WHERE user_id = $1", [owner]),
    ).rejects.toThrow();
  });

  it("bills every month from the join month for a dancer who joined earlier", async () => {
    const owner = await newStudio(db);
    const dancer = await newStudent(db, owner, "Bela", { amountPaise: 150000, startsOn: await monthStart(2) });
    const [made] = await db.query<{ n: number }>(
      { user: owner },
      "SELECT public.generate_student_charges($1, $2::date) AS n",
      [dancer.id, await monthStart(2)],
    );
    expect(made.n).toBe(3);
    const rows = await db.admin<{ period: string; amount_paise: string }>(
      "SELECT period::text, amount_paise::text FROM public.charges WHERE student_id = $1 ORDER BY period",
      [dancer.id],
    );
    expect(rows.map((r) => r.amount_paise)).toEqual(["150000", "150000", "150000"]);
    // Running it again adds nothing.
    const [again] = await db.query<{ n: number }>(
      { user: owner },
      "SELECT public.generate_student_charges($1, $2::date) AS n",
      [dancer.id, await monthStart(2)],
    );
    expect(again.n).toBe(0);
  });

  it("does not bill months before the fee starts, or a fee that starts later", async () => {
    const owner = await newStudio(db);
    const planId = await newPlan(db, owner, "Plan", 100000);
    const [student] = await db.admin<{ id: string }>(
      "INSERT INTO public.students (studio_id, name) VALUES ($1, 'Chirag') RETURNING id",
      [owner],
    );
    await db.admin("SELECT public.assign_fee_plan($1, $2, $3::date)", [student.id, planId, await monthStart(1)]);
    const [made] = await db.query<{ n: number }>(
      { user: owner },
      "SELECT public.generate_student_charges($1, $2::date) AS n",
      [student.id, await monthStart(5)],
    );
    expect(made.n).toBe(2);
  });
});
