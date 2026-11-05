import { describe, expect, it } from "vitest";
import { applyFilter, batchTotals, unpaidAcross, type TableBatch, type TableRow } from "@/lib/studio-table";
import { getTeacherTable, markBatchPaid } from "@/lib/studio-table.server";
import { fakeSupabase } from "./fake-supabase";

const row = (id: string, outstandingPaise: number): TableRow => ({
  studentId: id,
  name: id,
  feePaise: 200000,
  outstandingPaise,
  status: outstandingPaise > 0 ? "due" : "paid",
  present: null,
});
const batch = (id: string, rows: TableRow[], meetsToday = false): TableBatch => ({
  id,
  name: id,
  weekdays: [2],
  startsAt: null,
  endsAt: null,
  meetsToday,
  rows,
});

describe("studio table helpers", () => {
  const batches = [
    batch("a", [row("asha", 0), row("meera", 200000), row("ritu", 200000)], true),
    batch("b", [row("nina", 0)]),
  ];

  it("totals a batch", () => {
    expect(batchTotals(batches[0]!.rows)).toEqual({ count: 3, paid: 1, unpaid: 2, duePaise: 400000 });
  });

  it("unpaid filter keeps only batches and rows that owe", () => {
    const shown = applyFilter(batches, "unpaid");
    expect(shown.map((b) => b.id)).toEqual(["a"]);
    expect(shown[0]!.rows.map((r) => r.studentId)).toEqual(["meera", "ritu"]);
  });

  it("paid filter keeps only paid rows", () => {
    expect(applyFilter(batches, "paid").flatMap((b) => b.rows.map((r) => r.studentId))).toEqual(["asha", "nina"]);
  });

  it("today filter keeps batches that meet today", () => {
    expect(applyFilter(batches, "today").map((b) => b.id)).toEqual(["a"]);
  });

  it("lists a dancer once even when in two batches", () => {
    const twice = [...batches, batch("c", [row("meera", 200000)])];
    expect(unpaidAcross(twice).map((r) => r.studentId)).toEqual(["meera", "ritu"]);
  });
});

describe("teacher table", () => {
  it("has no money fields anywhere in the payload", async () => {
    const { client } = fakeSupabase((call) => {
      if (call.fn === "instructor_batches")
        return {
          data: [{ id: "b1", name: "Hip hop", weekdays: [2], starts_at: null, ends_at: null, room: null, trainer_name: null }],
        };
      if (call.fn === "instructor_batch_day")
        return { data: [{ student_id: "s1", student_name: "Asha", present: true }] };
      return undefined;
    });
    const table = await getTeacherTable({ supabase: client, userId: "u" }, { date: "2026-11-03" });
    expect(table[0]!.rows).toEqual([{ studentId: "s1", name: "Asha", present: true }]);
    expect(JSON.stringify(table)).not.toMatch(/fee|paise|outstanding|status/i);
  });

  it("marks paid for what this month's row shows, never the dancer's earlier arrears", async () => {
    // Bindu owes 5,500 this month and 4,500 from earlier, so balance_paise is 10,000. The table and the
    // confirm dialog both show 5,500, so that is what may be recorded.
    const { client, calls } = fakeSupabase((call) => {
      if (call.fn === "student_ledger_status")
        return {
          data: [
            {
              student_id: "bindu",
              student_name: "Bindu",
              amount_paise: 550000,
              outstanding_paise: 550000,
              balance_paise: 1000000,
            },
          ],
        };
      if (call.fn === "record_payment") return { data: [{ id: "p1" }] };
      return undefined;
    });
    const result = await markBatchPaid(
      { supabase: client, userId: "u" },
      {
        batchId: "b1",
        method: "cash",
        paidOn: "2026-11-05",
        period: "2026-11-01",
        studentIds: ["bindu"],
        idempotencyKey: "key",
      },
    );
    const payment = calls.find((call) => call.fn === "record_payment");
    expect((payment?.args?.[0] as { p_amount_paise: number }).p_amount_paise).toBe(550000);
    expect(result.totalPaise).toBe(550000);
  });
});
