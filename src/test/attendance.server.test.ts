import { describe, expect, it } from "vitest";
import { getBatchDay, getStudentAttendance, markAttendance } from "@/lib/attendance.server";
import { fakeSupabase } from "./fake-supabase";

const user = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";

describe("attendance server functions", () => {
  it("sends the marks to the database function as snake_case records and returns the count", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: 2 }));
    const result = await markAttendance(
      { supabase: client, userId: user },
      {
        batchId,
        date: "2026-10-13",
        marks: [
          { studentId, present: true },
          { studentId: "s2", present: false },
        ],
      },
    );
    expect(result).toEqual({ marked: 2 });
    expect(calls[0].fn).toBe("mark_attendance");
    expect(calls[0].args).toEqual([
      {
        p_batch: batchId,
        p_session_on: "2026-10-13",
        p_marks: [
          { student_id: studentId, present: true },
          { student_id: "s2", present: false },
        ],
      },
    ]);
  });

  it("shows the roster rule the database enforces in plain words", async () => {
    const { client } = fakeSupabase(() => ({
      error: { code: "P0001", message: "not on the roster for that date: Left" },
    }));
    await expect(
      markAttendance(
        { supabase: client, userId: user },
        { batchId, date: "2026-10-13", marks: [{ studentId, present: true }] },
      ),
    ).rejects.toThrow("not on the roster for that date: Left");
  });

  it("reads a batch's day and a student's history through the database functions", async () => {
    const { client, calls } = fakeSupabase((call) => ({
      data: call.fn === "batch_day" ? [{ student_name: "Asha", present: null }] : [],
    }));
    expect(
      await getBatchDay({ supabase: client, userId: user }, { batchId, date: "2026-10-13" }),
    ).toEqual([{ student_name: "Asha", present: null }]);
    await getStudentAttendance(
      { supabase: client, userId: user },
      { studentId, from: "2026-09-01", to: "2026-10-01" },
    );
    expect(calls.map((call) => call.fn)).toEqual(["batch_day", "student_attendance"]);
    expect(calls[1]?.args).toEqual([
      { p_student: studentId, p_from: "2026-09-01", p_to: "2026-10-01" },
    ]);
  });
});
