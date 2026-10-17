import { describe, expect, it } from "vitest";
import { attendancePercent, countScheduledSessions, rangeFor } from "@/lib/attendance-stats";
import { getAttendanceSummary } from "@/lib/attendance-summary.server";
import { fakeSupabase } from "./fake-supabase";

describe("attendance percentage", () => {
  it("is present marks over marked sessions", () => {
    expect(attendancePercent(3, 4)).toBe(75);
    expect(attendancePercent(4, 4)).toBe(100);
    expect(attendancePercent(0, 5)).toBe(0);
    expect(attendancePercent(1, 3)).toBe(33);
  });

  it("shows no percentage, not 0%, when nothing was marked", () => {
    expect(attendancePercent(0, 0)).toBeNull();
  });
});

describe("scheduled sessions", () => {
  it("counts the batch weekdays inside the range, Sunday as 0", () => {
    // October 2026 has Tuesdays on the 6th, 13th, 20th and 27th and Thursdays on the 1st, 8th, 15th, 22nd and 29th.
    expect(countScheduledSessions([2, 4], "2026-10-01", "2026-10-31")).toBe(9);
    expect(countScheduledSessions([0], "2026-10-01", "2026-10-31")).toBe(4);
  });

  it("is zero for no weekdays or an empty range", () => {
    expect(countScheduledSessions([], "2026-10-01", "2026-10-31")).toBe(0);
    expect(countScheduledSessions([2], "2026-10-10", "2026-10-01")).toBe(0);
  });
});

describe("date ranges", () => {
  it("covers the whole month, including a 30-day month and February", () => {
    expect(rangeFor("month", "2026-10-17")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("month", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(rangeFor("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("counts back from today inclusive", () => {
    expect(rangeFor("last30", "2026-10-30")).toEqual({ from: "2026-10-01", to: "2026-10-30" });
    expect(rangeFor("last90", "2026-10-17")).toEqual({ from: "2026-07-20", to: "2026-10-17" });
  });
});

const user = "11111111-1111-4111-8111-111111111111";

describe("getAttendanceSummary", () => {
  it("combines the database summaries with scheduled classes and percentages", async () => {
    const { client, calls } = fakeSupabase((call) => {
      if (call.fn === "attendance_by_student")
        return {
          data: [
            { student_id: "s1", student_name: "Asha", marked: 4, present: 3 },
            { student_id: "s2", student_name: "Ben", marked: 0, present: 0 },
          ],
        };
      if (call.fn === "attendance_by_batch")
        return { data: [{ batch_id: "b1", batch_name: "Hip Hop", weekdays: [2, 4], held: 6 }] };
      return {};
    });
    const summary = await getAttendanceSummary(
      { supabase: client, userId: user },
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(calls.map((call) => [call.fn, call.args])).toEqual([
      ["attendance_by_student", [{ p_from: "2026-10-01", p_to: "2026-10-31" }]],
      ["attendance_by_batch", [{ p_from: "2026-10-01", p_to: "2026-10-31" }]],
    ]);
    expect(summary.students).toEqual([
      { id: "s1", name: "Asha", marked: 4, present: 3, percent: 75 },
      { id: "s2", name: "Ben", marked: 0, present: 0, percent: null },
    ]);
    expect(summary.batches).toEqual([
      { id: "b1", name: "Hip Hop", weekdays: [2, 4], scheduled: 9, held: 6 },
    ]);
  });
});
