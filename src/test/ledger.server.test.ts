import { describe, expect, it } from "vitest";
import {
  checkPayment,
  generateCharges,
  getOverview,
  getStudentLedger,
  recordPayment,
  voidPayment,
} from "@/lib/ledger.server";
import { generateChargesInput, paymentInput } from "@/lib/schemas";
import { fakeSupabase, stepsOf } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const studentId = "33333333-3333-4333-8333-333333333333";
const base = {
  studentId,
  amountPaise: 90000,
  method: "upi",
  paidOn: "2026-10-06",
  idempotencyKey: "payment-0001",
};

describe("payment and charge input rules", () => {
  it("accepts whole positive paise, a known method and a real date", () => {
    expect(paymentInput.safeParse(base).success).toBe(true);
    expect(paymentInput.parse({ ...base, note: "  " }).note).toBeNull();
  });

  it("rejects fractional, zero and negative amounts, unknown methods, bad dates and short keys", () => {
    const cases = [
      { amountPaise: 10.5 },
      { amountPaise: 0 },
      { amountPaise: -1 },
      { method: "bitcoin" },
      { paidOn: "2026-02-30" },
      { idempotencyKey: "short" },
    ];
    for (const bad of cases) {
      expect(paymentInput.safeParse({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("refuses a due date before the month being billed", () => {
    expect(
      generateChargesInput.safeParse({ period: "2026-10-17", dueOn: "2026-09-30" }).success,
    ).toBe(false);
    expect(
      generateChargesInput.safeParse({ period: "2026-10-17", dueOn: "2026-10-10" }).success,
    ).toBe(true);
  });
});

describe("ledger server functions", () => {
  it("bills the first of the month and sends a due date only when given", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: 3 }));
    expect(
      await generateCharges({ supabase: client, userId: user }, { period: "2026-10-17" }),
    ).toEqual({ created: 3 });
    await generateCharges(
      { supabase: client, userId: user },
      { period: "2026-10-17", dueOn: "2026-10-10" },
    );
    expect(calls[0].args).toEqual([{ p_period: "2026-10-01" }]);
    expect(calls[1]?.args).toEqual([{ p_period: "2026-10-01", p_due_on: "2026-10-10" }]);
  });

  it("records a payment through the idempotent database function", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "p1", amount_paise: 90000 } }));
    const row = await recordPayment({ supabase: client, userId: user }, { ...base, note: null });
    expect(row).toMatchObject({ id: "p1" });
    expect(calls[0].fn).toBe("record_payment");
    expect(calls[0].args).toEqual([
      {
        p_student: studentId,
        p_amount_paise: 90000,
        p_method: "upi",
        p_paid_on: "2026-10-06",
        p_note: null,
        p_idempotency_key: "payment-0001",
        p_reference: null,
        p_acknowledge_excess: false,
      },
    ]);
  });

  it("passes through the readable reason when a key is reused for a different payment", async () => {
    const { client } = fakeSupabase(() => ({
      error: {
        code: "P0001",
        message: "that payment key was already used for a different payment",
      },
    }));
    await expect(
      recordPayment({ supabase: client, userId: user }, { ...base, note: null }),
    ).rejects.toThrow("different payment");
  });

  it("voids with a reason and a timestamp, and says so when the entry is not visible", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    await expect(
      voidPayment({ supabase: client, userId: user }, { id: "p1", reason: "typo" }),
    ).rejects.toThrow("That payment was not found.");
    const update = stepsOf(calls[0], "update")[0]?.[0] as {
      voided_at: string;
      void_reason: string;
    };
    expect(update.void_reason).toBe("typo");
    expect(update.voided_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(calls[0].table).toBe("payments");
  });

  it("returns zeros for a month with no charges", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    expect(await getOverview({ supabase: client, userId: user }, { period: "2026-10-01" })).toEqual(
      {
        billed_paise: 0,
        collected_paise: 0,
        outstanding_paise: 0,
        pending_students: 0,
        overdue_students: 0,
        total_students: 0,
      },
    );
  });

  it("totals a student's balance from live entries only", async () => {
    const voided = "2026-10-02T00:00:00Z";
    const { client } = fakeSupabase((call) => {
      if (call.table === "charges") {
        return {
          data: [
            { amount_paise: 900000, voided_at: null },
            { amount_paise: 500000, voided_at: voided },
            { amount_paise: 900000, voided_at: null },
          ],
        };
      }
      if (call.table === "payments") {
        return {
          data: [
            { amount_paise: 400000, voided_at: null },
            { amount_paise: 900000, voided_at: voided },
          ],
        };
      }
      return {};
    });
    const ledger = await getStudentLedger({ supabase: client, userId: user }, { studentId });
    expect(ledger.balance_paise).toBe(1400000);
    expect(ledger.charges).toHaveLength(3);
    expect(ledger.payments).toHaveLength(2);
  });
});

describe("payment gate server functions", () => {
  it("passes the reference and the excess acknowledgment to the database", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: "p1" } }));
    await recordPayment(
      { supabase: client, userId: user },
      { ...base, note: null, reference: "UTR123", acknowledgeExcess: true },
    );
    expect(calls[0].args?.[0]).toMatchObject({
      p_reference: "UTR123",
      p_acknowledge_excess: true,
    });
  });

  it("accepts a reference and defaults the acknowledgment to false", () => {
    const parsed = paymentInput.parse({ ...base, reference: "  UTR1  " });
    expect(parsed.reference).toBe("UTR1");
    expect(parsed.acknowledgeExcess).toBe(false);
    expect(paymentInput.safeParse({ ...base, reference: "x".repeat(101) }).success).toBe(false);
  });

  it("returns zeros when the check finds nothing", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    expect(
      await checkPayment({ supabase: client, userId: user }, { studentId, amountPaise: 100 }),
    ).toEqual({ owed_paise: 0, remaining_paise: 0, excess_paise: 0 });
  });
});
