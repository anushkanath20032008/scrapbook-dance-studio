import { describe, expect, it } from "vitest";
import { groupBoardRows, hereToday, owes, toBoardRows } from "@/components/console/dancer-board";
import { sampleBatches, sampleNumbers, samplePay, sampleMark } from "@/lib/sample-studio";
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

describe("dancers who are in no batch", () => {
  it("still appear, so money they owe is not hidden", () => {
    const rows = toBoardRows(
      [batch("Adults", [row("asha", { outstandingPaise: 100000, status: "due" })])],
      [{ studentId: "bindu", name: "Bindu", outstandingPaise: 550000, status: "overdue" }],
    );
    expect(rows.map((r) => r.studentId)).toEqual(["bindu", "asha"]);
    expect(rows.filter(owes).reduce((sum, r) => sum + r.outstandingPaise, 0)).toBe(650000);
    expect(rows[0]!.batchNames).toEqual([]);
    expect(hereToday(rows[0]!)).toBe(false);
  });

  it("shows the fee from this month's charge", () => {
    const rows = toBoardRows(
      [],
      [
        {
          studentId: "bhagavath",
          name: "Bhagavath",
          outstandingPaise: 100000,
          status: "due",
          feePaise: 500000,
        },
      ],
    );
    expect(rows[0]!.feePaise).toBe(500000);
  });

  it("does not duplicate a dancer who is already in a batch", () => {
    const rows = toBoardRows(
      [batch("Adults", [row("asha", { outstandingPaise: 100000, status: "due" })])],
      [{ studentId: "asha", name: "asha", outstandingPaise: 100000, status: "due" }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.batchNames).toEqual(["Adults"]);
  });
});

describe("grouping", () => {
  const rows = toBoardRows([
    batch("Adults", [row("asha", { outstandingPaise: 100000, status: "due" }), row("meera")]),
    batch("Kids", [row("asha")]),
  ]);

  it("puts the unpaid band first and drops empty bands", () => {
    const groups = groupBoardRows(rows, "status");
    expect(groups.map((g) => g.label)).toEqual(["Unpaid", "Paid or no fee yet"]);
    expect(groups[0]!.rows.map((r) => r.studentId)).toEqual(["asha"]);
    expect(groupBoardRows(rows.filter(owes), "status").map((g) => g.label)).toEqual(["Unpaid"]);
  });

  it("groups by batch, listing a dancer in each of her batches, and keeps no-batch dancers", () => {
    const withLoose = toBoardRows(
      [batch("Adults", [row("asha")]), batch("Kids", [row("asha")])],
      [{ studentId: "bindu", name: "Bindu", outstandingPaise: 100, status: "due" }],
    );
    const groups = groupBoardRows(withLoose, "batch");
    expect(groups.map((g) => g.label)).toEqual(["Adults", "Kids", "No batch"]);
    expect(groups[2]!.rows.map((r) => r.studentId)).toEqual(["bindu"]);
  });
});

describe("sample studio", () => {
  it("adds up the month from its rows and moves when someone pays", () => {
    const start = sampleBatches();
    const before = sampleNumbers(start);
    expect(before.active_students).toBe(8);
    expect(before.billed_paise).toBe(before.collected_paise + before.missing_paise);
    const owing = start[0]!.rows.find((r) => r.outstandingPaise > 0)!;
    const after = sampleNumbers(samplePay(start, owing.studentId));
    expect(after.missing_paise).toBe(before.missing_paise - owing.feePaise);
    expect(after.paid_students).toBe(before.paid_students + 1);
  });

  it("marks attendance only for the batch asked", () => {
    const start = sampleBatches();
    const id = start[0]!.rows[0]!.studentId;
    const next = sampleMark(start, start[0]!.id, id, true);
    expect(next[0]!.rows[0]!.present).toBe(true);
    expect(start[0]!.rows[0]!.present).toBeNull();
    expect(next[1]).toBe(start[1]);
  });
});
