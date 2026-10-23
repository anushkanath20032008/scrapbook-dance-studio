import { describe, expect, it } from "vitest";
import { collectedByMethod, collectedPercent, overdueAging } from "@/lib/month-end";
import { getMonthEnd } from "@/lib/reports.server";
import { fakeSupabase } from "./fake-supabase";

describe("overdueAging", () => {
  it("groups outstanding money by days late and counts each dancer once", () => {
    const aging = overdueAging([
      { student_id: "a", outstanding_paise: 100, days_overdue: 3 },
      { student_id: "a", outstanding_paise: 50, days_overdue: 7 },
      { student_id: "b", outstanding_paise: 200, days_overdue: 8 },
      { student_id: "c", outstanding_paise: 300, days_overdue: 90 },
      { student_id: "d", outstanding_paise: 999, days_overdue: 0 },
      { student_id: "e", outstanding_paise: 0, days_overdue: 40 },
    ]);
    expect(aging.map((b) => [b.paise, b.dancers])).toEqual([[150, 1], [200, 1], [0, 0], [300, 1]]);
  });
});

describe("collectedByMethod", () => {
  it("lists all four methods and folds unknown ones into other", () => {
    expect(
      collectedByMethod([
        { amount_paise: 100, method: "upi" },
        { amount_paise: 50, method: "upi" },
        { amount_paise: 7, method: "cheque" },
      ]),
    ).toEqual([
      { method: "cash", paise: 0 },
      { method: "upi", paise: 150 },
      { method: "bank", paise: 0 },
      { method: "other", paise: 7 },
    ]);
  });
});

describe("collectedPercent", () => {
  it("is zero with nothing billed and capped at 100", () => {
    expect(collectedPercent(0, 500)).toBe(0);
    expect(collectedPercent(1000, 250)).toBe(25);
    expect(collectedPercent(1000, 1500)).toBe(100);
  });
});

describe("getMonthEnd", () => {
  it("reads the month's live payments and pending claims", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "payments") return { data: [{ amount_paise: 250000, method: "upi" }] };
      if (call.table === "payment_claims") return { data: [{ amount_paise: 100 }, { amount_paise: 50 }] };
      if (call.fn === "unpaid_students")
        return { data: [{ student_id: "a", outstanding_paise: 900, days_overdue: 12 }] };
      return { data: [] };
    });
    const result = await getMonthEnd({ supabase: client, userId: "u" }, { period: "2026-12-09" });
    expect(result.period).toBe("2026-12-01");
    expect(result.pendingClaims).toEqual({ count: 2, paise: 150 });
    expect(result.aging[1]).toMatchObject({ paise: 900, dancers: 1 });
    const payments = calls.find((c) => c.table === "payments")!;
    expect(payments.steps.find(([n]) => n === "lt")![1]).toEqual(["paid_on", "2027-01-01"]);
  });
});
