// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudent, newStudio } from "./fixtures";

type Row = { period: string; billed_paise: string; collected_paise: string; missing_paise: string };

describe("monthly_trend", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  let keyCounter = 0;
  const pay = (owner: string, student: string, amount: number, paidOn: string) =>
    db.query(
      { user: owner },
      "SELECT public.record_payment($1, $2, 'upi', $3::date, NULL, $4, NULL, true)",
      [student, amount, paidOn, `trend-key-${++keyCounter}-padding`],
    );
  const generate = (owner: string, period: string, dueOn: string) =>
    db.query({ user: owner }, "SELECT public.generate_monthly_charges($1::date, $2::date)", [
      period,
      dueOn,
    ]);
  const trend = (owner: string, months = 6, today = "2026-10-17") =>
    db.query<Row>(
      { user: owner },
      "SELECT period::text, billed_paise::text, collected_paise::text, missing_paise::text FROM public.monthly_trend($1, $2::date)",
      [months, today],
    );

  it("shows zeros, not gaps, for months with no charges, oldest first", async () => {
    const owner = await newStudio(db);
    const rows = await trend(owner);
    expect(rows.map((r) => r.period)).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(rows.every((r) => r.billed_paise === "0" && r.missing_paise === "0")).toBe(true);
  });

  it("counts a later payment as collected for the charge month it settled", async () => {
    const owner = await newStudio(db);
    const student = await newStudent(db, owner, "Late payer", {
      amountPaise: 100000,
      startsOn: "2026-08-01",
    });
    await generate(owner, "2026-08-01", "2026-08-05");
    await generate(owner, "2026-09-01", "2026-09-05");
    await pay(owner, student.id, 100000, "2026-10-02");
    const rows = await trend(owner, 3);
    expect(rows).toEqual([
      {
        period: "2026-08-01",
        billed_paise: "100000",
        collected_paise: "100000",
        missing_paise: "0",
      },
      {
        period: "2026-09-01",
        billed_paise: "100000",
        collected_paise: "0",
        missing_paise: "100000",
      },
      { period: "2026-10-01", billed_paise: "0", collected_paise: "0", missing_paise: "0" },
    ]);
  });

  it("excludes voided charges and payments", async () => {
    const owner = await newStudio(db);
    const student = await newStudent(db, owner, "Voider", { amountPaise: 100000 });
    await generate(owner, "2026-10-01", "2026-10-05");
    const [{ id }] = await db.query<{ id: string }>(
      { user: owner },
      "SELECT id FROM public.record_payment($1, 100000, 'cash', '2026-10-06'::date, NULL, $2)",
      [student.id, `trend-key-${++keyCounter}-padding`],
    );
    await db.query(
      { user: owner },
      "UPDATE public.payments SET voided_at = now(), void_reason = 'bounced' WHERE id = $1",
      [id],
    );
    expect((await trend(owner, 1))[0]).toMatchObject({
      billed_paise: "100000",
      collected_paise: "0",
      missing_paise: "100000",
    });
    await db.query(
      { user: owner },
      "UPDATE public.charges SET voided_at = now(), void_reason = 'wrong month' WHERE student_id = $1",
      [student.id],
    );
    expect((await trend(owner, 1))[0]).toMatchObject({ billed_paise: "0", missing_paise: "0" });
  });

  it("agrees with the Home snapshot for every month", async () => {
    const owner = await newStudio(db);
    const a = await newStudent(db, owner, "A", { amountPaise: 150000, startsOn: "2026-09-01" });
    await newStudent(db, owner, "B", { amountPaise: 90000, startsOn: "2026-09-01" });
    await generate(owner, "2026-09-01", "2026-09-05");
    await generate(owner, "2026-10-01", "2026-10-05");
    await pay(owner, a.id, 200000, "2026-10-03");
    for (const row of await trend(owner, 2)) {
      const [snap] = await db.query<Record<string, string>>(
        { user: owner },
        "SELECT billed_paise::text, collected_paise::text, missing_paise::text FROM public.studio_snapshot($1::date, '2026-10-17'::date)",
        [row.period],
      );
      expect(snap).toEqual({
        billed_paise: row.billed_paise,
        collected_paise: row.collected_paise,
        missing_paise: row.missing_paise,
      });
    }
  });

  it("limits the window to 24 months and never shows another studio's money", async () => {
    const mine = await newStudio(db);
    const theirs = await newStudio(db);
    await newStudent(db, theirs, "Stranger", { amountPaise: 900000 });
    await generate(theirs, "2026-10-01", "2026-10-05");
    expect(await trend(mine, 99)).toHaveLength(24);
    expect((await trend(mine, 1))[0]).toMatchObject({ billed_paise: "0" });
  });

  it("is not available to anonymous callers", async () => {
    expect(
      await rejection(db.query("anon", "SELECT * FROM public.monthly_trend(6, NULL)")),
    ).toMatch(/permission denied/i);
  });
});
