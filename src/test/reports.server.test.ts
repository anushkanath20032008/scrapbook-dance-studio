import { describe, expect, it } from "vitest";
import { getHomeReport, getMonthlyTrend } from "@/lib/reports.server";
import { fakeSupabase } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";

describe("getHomeReport", () => {
  it("asks both report functions for the first day of the month", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.fn === "studio_snapshot" ? { data: [{ billed_paise: 450000 }] } : { data: [] },
    );
    const report = await getHomeReport(
      { supabase: client, userId: user },
      { period: "2026-10-17" },
    );
    expect(report.period).toBe("2026-10-01");
    expect(calls.map((call) => [call.fn, call.args])).toEqual([
      ["studio_snapshot", [{ p_period: "2026-10-01" }]],
      ["unpaid_students", [{ p_period: "2026-10-01" }]],
    ]);
    expect(report.snapshot).toMatchObject({ billed_paise: 450000 });
  });

  it("returns zeros for a month with no charges", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    const report = await getHomeReport(
      { supabase: client, userId: user },
      { period: "2026-10-01" },
    );
    expect(report.snapshot).toMatchObject({
      billed_paise: 0,
      missing_paise: 0,
      charged_students: 0,
    });
    expect(report.unpaid).toEqual([]);
  });

  it("fails with a friendly message when a report errors", async () => {
    const { client } = fakeSupabase(() => ({
      error: { code: "XX000", message: "internal detail" },
    }));
    await expect(
      getHomeReport({ supabase: client, userId: user }, { period: "2026-10-01" }),
    ).rejects.toThrow("Something went wrong. Please try again.");
  });
});

describe("getMonthlyTrend", () => {
  it("asks the database for six months", async () => {
    const rows = [{ period: "2026-10-01", billed_paise: 1, collected_paise: 1, missing_paise: 0 }];
    const { client, calls } = fakeSupabase(() => ({ data: rows }));
    expect(await getMonthlyTrend({ supabase: client, userId: user })).toEqual(rows);
    expect(calls[0]?.fn).toBe("monthly_trend");
    expect(calls[0]?.args).toEqual([{ p_months: 6 }]);
  });
});
