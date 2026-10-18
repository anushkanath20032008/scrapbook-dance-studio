// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newGuardian, newStudent, newStudio, payment } from "./fixtures";

type Summary = {
  studio_id: string;
  unpaid_count: number;
  outstanding_paise: string;
  due_today_count: number;
  overdue_count: number;
};

describe("owner nudge summary", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  const summary = (today: string) =>
    db.admin<Summary>(
      "SELECT studio_id, unpaid_count, outstanding_paise::text, due_today_count, overdue_count FROM public.owner_nudge_summary($1::date)",
      [today],
    );

  it("counts what each studio is owed this month and keeps studios apart", async () => {
    const owner = await newStudio(db, "Dance Hub");
    const other = await newStudio(db, "Other Studio");
    const late = await newStudent(db, owner, "Late", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "A"),
    });
    const paid = await newStudent(db, owner, "Paid", {
      amountPaise: 100000,
      guardian: await newGuardian(db, owner, "B"),
    });
    await newStudent(db, other, "Elsewhere", {
      amountPaise: 50000,
      guardian: await newGuardian(db, other, "C"),
    });
    for (const studio of [owner, other])
      await db.query({ user: studio }, "SELECT public.generate_monthly_charges($1::date, $2::date)", [
        "2026-10-01",
        "2026-10-05",
      ]);
    await payment(db, owner, paid.id, 100000);

    const rows = await summary("2026-10-10");
    const mine = rows.find((r) => r.studio_id === owner);
    const theirs = rows.find((r) => r.studio_id === other);
    expect(mine).toMatchObject({ unpaid_count: 1, outstanding_paise: "100000", overdue_count: 1 });
    expect(theirs).toMatchObject({ unpaid_count: 1, outstanding_paise: "50000" });
    expect(late.id).toBeTruthy();

    const onDue = await summary("2026-10-05");
    expect(onDue.find((r) => r.studio_id === owner)?.due_today_count).toBe(1);
  });

  it("is not callable by owners or anonymous callers", async () => {
    const owner = await newStudio(db, "Dance Hub");
    expect(
      await rejection(db.query({ user: owner }, "SELECT * FROM public.owner_nudge_summary(NULL)")),
    ).toBeTruthy();
    expect(
      await rejection(db.query("anon", "SELECT * FROM public.owner_nudge_summary(NULL)")),
    ).toBeTruthy();
  });
});
