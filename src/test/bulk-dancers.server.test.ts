import { describe, expect, it } from "vitest";
import { bulkAddDancers } from "@/lib/bulk-dancers.server";
import { fakeSupabase, stepsOf, type Call } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const inserting = (call: Call) => stepsOf(call, "insert").length > 0;

function studio(options: { limit?: number | null; count?: number } = {}) {
  return fakeSupabase((call) => {
    if (call.fn === "studio_capacity")
      return {
        data: [
          {
            student_limit: options.limit ?? null,
            student_count: options.count ?? 1,
            trial_ends_at: null,
          },
        ],
      };
    if (call.fn === "assign_fee_plan") return { data: "assignment" };
    if (call.fn === "generate_monthly_charges") return { data: 2 };
    switch (call.table) {
      case "studio_profiles":
        return {};
      case "students":
        return inserting(call)
          ? { data: [{ id: "s1" }, { id: "s2" }] }
          : { data: [{ name: "Asha Rao", guardian_id: "g0" }] };
      case "guardians":
        return inserting(call)
          ? { data: [{ id: "g1" }, { id: "g2" }] }
          : { data: [{ id: "g0", phone: "+91 98765 43210" }] };
      case "fee_plans":
        return inserting(call) ? { data: { id: "plan-new" } } : { data: [] };
      default:
        return {};
    }
  });
}

const input = {
  dancers: [
    { name: "Asha Rao", phone: "+91 98765 43210", feePaise: null },
    { name: "Bela Shah", phone: "+91 91234 56789", feePaise: null },
    { name: "Chirag", phone: null, feePaise: 180000 },
  ],
  defaultFeePaise: 150000,
  billThisMonth: true,
};

describe("bulkAddDancers", () => {
  it("skips a dancer already on the list, adds the rest with their fees, and bills the month", async () => {
    const { client, calls } = studio();
    const result = await bulkAddDancers({ supabase: client, userId: user }, input);
    expect(result).toEqual({ added: 2, skipped: 1, plansCreated: 2, charged: 2 });

    const guardianInsert = calls.find((c) => c.table === "guardians" && inserting(c));
    expect(stepsOf(guardianInsert!, "insert")[0]).toEqual([
      [
        { studio_id: user, name: "Bela Shah", phone: "+91 91234 56789" },
        { studio_id: user, name: "Chirag", phone: null },
      ],
    ]);
    // One plan per distinct amount: 1500 for Bela, 1800 for Chirag.
    const amounts = calls
      .filter((c) => c.table === "fee_plans" && inserting(c))
      .map((c) => (stepsOf(c, "insert")[0]![0] as { amount_paise: number }).amount_paise);
    expect(amounts.sort()).toEqual([150000, 180000]);
    expect(calls.filter((c) => c.fn === "assign_fee_plan")).toHaveLength(2);
    expect(calls.some((c) => c.fn === "generate_monthly_charges")).toBe(true);
  });

  it("refuses before adding anything when the plan's dancer limit would be passed", async () => {
    const { client, calls } = studio({ limit: 3, count: 2 });
    await expect(bulkAddDancers({ supabase: client, userId: user }, input)).rejects.toThrow(
      /room for 1 more/,
    );
    expect(calls.some((c) => c.table === "guardians" && inserting(c))).toBe(false);
  });

  it("does not create charges unless asked", async () => {
    const { client, calls } = studio();
    const result = await bulkAddDancers(
      { supabase: client, userId: user },
      { ...input, billThisMonth: false },
    );
    expect(result.charged).toBe(0);
    expect(calls.some((c) => c.fn === "generate_monthly_charges")).toBe(false);
  });
});
