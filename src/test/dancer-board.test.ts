import { describe, expect, it } from "vitest";
import { hereToday, owes, toBoardRows } from "@/components/console/dancer-board";
import type { TableBatch, TableRow } from "@/lib/studio-table";

const row = (id: string, over: Partial<TableRow> = {}): TableRow => ({
  studentId: id,
  name: id,
  feePaise: 500000,
  outstandingPaise: 0,
  status: "paid",
  present: null,
  ...over,
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

describe("dancer board", () => {
  it("puts one row per dancer and lists every batch they are in", () => {
    const rows = toBoardRows([
      batch("Adults", [row("asha"), row("meera")]),
      batch("Under 10", [row("asha")]),
    ]);
    expect(rows.map((r) => r.studentId)).toEqual(["asha", "meera"]);
    expect(rows[0]!.batchNames).toEqual(["Adults", "Under 10"]);
  });

  it("sorts overdue first, then due, then no fee, then paid", () => {
    const rows = toBoardRows([
      batch("a", [
        row("paid-one"),
        row("no-fee", { feePaise: 0, status: "none" }),
        row("due-one", { outstandingPaise: 100000, status: "due" }),
        row("overdue-one", { outstandingPaise: 180000, status: "overdue" }),
      ]),
    ]);
    expect(rows.map((r) => r.studentId)).toEqual(["overdue-one", "due-one", "no-fee", "paid-one"]);
  });

  it("collects only the batches that meet today, with their marks", () => {
    const rows = toBoardRows([
      batch("Adults", [row("asha", { present: true })], true),
      batch("Monday", [row("asha", { present: null })], false),
    ]);
    expect(rows[0]!.todayBatches).toEqual([{ batchId: "Adults", present: true }]);
  });

  it("counts a dancer here only when every class today is marked present", () => {
    const both = toBoardRows([
      batch("Morning", [row("asha", { present: true })], true),
      batch("Evening", [row("asha", { present: true })], true),
    ]);
    expect(hereToday(both[0]!)).toBe(true);

    const half = toBoardRows([
      batch("Morning", [row("asha", { present: true })], true),
      batch("Evening", [row("asha", { present: null })], true),
    ]);
    expect(hereToday(half[0]!)).toBe(false);
  });

  it("is never 'here' when there is no class today", () => {
    const rows = toBoardRows([batch("Adults", [row("asha", { present: true })], false)]);
    expect(hereToday(rows[0]!)).toBe(false);
  });

  it("knows who owes", () => {
    const rows = toBoardRows([
      batch("a", [row("asha", { outstandingPaise: 120000, status: "due" }), row("meera")]),
    ]);
    expect(rows.filter(owes).map((r) => r.studentId)).toEqual(["asha"]);
  });
});
