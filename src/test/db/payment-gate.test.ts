// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, rejection, type TestDb } from "./harness";
import { newStudent, newStudio } from "./fixtures";

type Check = { owed_paise: string; remaining_paise: string; excess_paise: string };

describe("payment gate: record_payment compares with what is owed", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createDb();
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  let keyCounter = 0;
  const key = () => `gate-key-${++keyCounter}-padding`;

  async function owing(amountPaise = 150000) {
    const owner = await newStudio(db);
    const student = await newStudent(db, owner, "Dancer", { amountPaise });
    await db.query(
      { user: owner },
      "SELECT public.generate_monthly_charges('2026-10-01', '2026-10-05')",
    );
    return { owner, student: student.id };
  }

  const check = (owner: string, student: string, amount: number) =>
    db
      .query<Check>(
        { user: owner },
        "SELECT owed_paise::text, remaining_paise::text, excess_paise::text FROM public.payment_check($1, $2)",
        [student, amount],
      )
      .then((rows) => rows[0]);

  const record = (
    owner: string,
    student: string,
    amount: number,
    options: { key?: string; reference?: string | null; acknowledge?: boolean } = {},
  ) =>
    db
      .query<{ id: string; reference: string | null; amount_paise: string }>(
        { user: owner },
        "SELECT id, reference, amount_paise::text FROM public.record_payment($1, $2, 'upi', '2026-10-06'::date, NULL, $3, $4, $5)",
        [
          student,
          amount,
          options.key ?? key(),
          options.reference ?? null,
          options.acknowledge ?? false,
        ],
      )
      .then((rows) => rows[0]);

  const unpaid = (owner: string) =>
    db.query<{ student_id: string; outstanding_paise: string }>(
      { user: owner },
      "SELECT student_id, outstanding_paise::text FROM public.unpaid_students('2026-10-01', '2026-10-06')",
    );

  it("AE1: an exact amount saves in one step and clears the dancer from the unpaid list", async () => {
    const { owner, student } = await owing();
    expect(await check(owner, student, 150000)).toEqual({
      owed_paise: "150000",
      remaining_paise: "0",
      excess_paise: "0",
    });
    await record(owner, student, 150000);
    expect(await unpaid(owner)).toEqual([]);
  });

  it("AE2: a part payment leaves the rest owed and the dancer listed", async () => {
    const { owner, student } = await owing();
    expect(await check(owner, student, 100000)).toEqual({
      owed_paise: "150000",
      remaining_paise: "50000",
      excess_paise: "0",
    });
    await record(owner, student, 100000);
    expect(await unpaid(owner)).toEqual([{ student_id: student, outstanding_paise: "50000" }]);
  });

  it("AE3: an excess is refused without acknowledgment and saves with it, as credit", async () => {
    const { owner, student } = await owing();
    expect(await check(owner, student, 200000)).toMatchObject({
      remaining_paise: "0",
      excess_paise: "50000",
    });
    const message = await rejection(record(owner, student, 200000));
    expect(message).toMatch(/more than what is owed/);
    expect(await unpaid(owner)).toHaveLength(1);

    await record(owner, student, 200000, { acknowledge: true });
    expect(await unpaid(owner)).toEqual([]);
    expect(await check(owner, student, 1)).toMatchObject({ owed_paise: "0", excess_paise: "1" });
  });

  it("still accepts the original six-argument call", async () => {
    const { owner, student } = await owing();
    const rows = await db.query<{ amount_paise: string }>(
      { user: owner },
      "SELECT amount_paise::text FROM public.record_payment($1, 150000, 'cash', '2026-10-06'::date, NULL, $2)",
      [student, key()],
    );
    expect(rows[0].amount_paise).toBe("150000");
  });

  it("stores a trimmed reference and treats a blank one as none", async () => {
    const { owner, student } = await owing();
    expect((await record(owner, student, 50000, { reference: "  UTR123456  " })).reference).toBe(
      "UTR123456",
    );
    expect((await record(owner, student, 50000, { reference: "   " })).reference).toBeNull();
  });

  it("returns the original payment for a repeated key, even past the gate and with the same reference", async () => {
    const { owner, student } = await owing();
    const sameKey = key();
    const first = await record(owner, student, 150000, { key: sameKey, reference: "UTR1" });
    const again = await record(owner, student, 150000, { key: sameKey, reference: "UTR1" });
    expect(again.id).toBe(first.id);
    const [{ count }] = await db.query<{ count: number }>(
      { user: owner },
      "SELECT count(*)::int AS count FROM public.payments WHERE student_id = $1",
      [student],
    );
    expect(count).toBe(1);
  });

  it("refuses a repeated key for a different payment", async () => {
    const { owner, student } = await owing();
    const sameKey = key();
    await record(owner, student, 50000, { key: sameKey });
    expect(await rejection(record(owner, student, 60000, { key: sameKey }))).toMatch(
      /already used for a different payment/,
    );
  });

  it("cannot record for another studio's dancer", async () => {
    const { student } = await owing();
    const stranger = await newStudio(db);
    expect(await rejection(record(stranger, student, 100))).toMatch(/student not found/);
    expect(await check(stranger, student, 100)).toMatchObject({ owed_paise: "0" });
  });

  it("is not available to anonymous callers", async () => {
    const { student } = await owing();
    expect(
      await rejection(db.query("anon", "SELECT * FROM public.payment_check($1, 100)", [student])),
    ).toMatch(/permission denied/i);
  });

  describe("student_charge_ledger", () => {
    const ledger = (owner: string, student: string, today = "2026-10-20") =>
      db.query<{
        period: string;
        amount_paise: string;
        allocated_paise: string;
        outstanding_paise: string;
        status: string;
        settled_on: string | null;
        settled_method: string | null;
      }>(
        { user: owner },
        "SELECT period::text, amount_paise::text, allocated_paise::text, outstanding_paise::text, status, settled_on::text, settled_method FROM public.student_charge_ledger($1, $2::date)",
        [student, today],
      );

    it("shows the date and method of the payment that completed each charge, oldest charge first", async () => {
      const owner = await newStudio(db);
      const student = await newStudent(db, owner, "Two months", {
        amountPaise: 100000,
        startsOn: "2026-09-01",
      });
      await db.query(
        { user: owner },
        "SELECT public.generate_monthly_charges('2026-09-01', '2026-09-05')",
      );
      await db.query(
        { user: owner },
        "SELECT public.generate_monthly_charges('2026-10-01', '2026-10-05')",
      );
      await db.query(
        { user: owner },
        "SELECT public.record_payment($1, 100000, 'cash', '2026-09-07'::date, NULL, $2)",
        [student.id, key()],
      );
      await db.query(
        { user: owner },
        "SELECT public.record_payment($1, 60000, 'upi', '2026-10-08'::date, NULL, $2)",
        [student.id, key()],
      );
      const rows = await ledger(owner, student.id);
      expect(rows).toEqual([
        {
          period: "2026-10-01",
          amount_paise: "100000",
          allocated_paise: "60000",
          outstanding_paise: "40000",
          status: "overdue",
          settled_on: null,
          settled_method: null,
        },
        {
          period: "2026-09-01",
          amount_paise: "100000",
          allocated_paise: "100000",
          outstanding_paise: "0",
          status: "paid",
          settled_on: "2026-09-07",
          settled_method: "cash",
        },
      ]);
    });

    it("lists a voided charge as voided and gives the balance back when a payment is voided", async () => {
      const { owner, student } = await owing();
      const payment = await record(owner, student, 150000);
      await db.query(
        { user: owner },
        "UPDATE public.payments SET voided_at = now(), void_reason = 'bounced' WHERE id = $1",
        [payment.id],
      );
      const [row] = await ledger(owner, student);
      expect(row).toMatchObject({
        status: "overdue",
        outstanding_paise: "150000",
        settled_on: null,
      });
      await db.query(
        { user: owner },
        "UPDATE public.charges SET voided_at = now(), void_reason = 'wrong month' WHERE student_id = $1",
        [student],
      );
      expect((await ledger(owner, student)).map((r) => r.status)).toEqual(["voided"]);
    });
  });
});
