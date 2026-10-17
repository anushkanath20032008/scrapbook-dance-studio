import { attendancePercent, countScheduledSessions } from "./attendance-stats";
import { unwrap, type StudioContext } from "./studio.server";

/** Per-dancer attendance and per-batch classes (scheduled from the weekdays, held from the marks) for a range. */
export async function getAttendanceSummary(
  { supabase }: StudioContext,
  input: { from: string; to: string },
) {
  const args = { p_from: input.from, p_to: input.to };
  const students = unwrap(await supabase.rpc("attendance_by_student", args));
  const batches = unwrap(await supabase.rpc("attendance_by_batch", args));
  return {
    students: students.map((row) => ({
      id: row.student_id,
      name: row.student_name,
      marked: row.marked,
      present: row.present,
      percent: attendancePercent(row.present, row.marked),
    })),
    batches: batches.map((row) => ({
      id: row.batch_id,
      name: row.batch_name,
      weekdays: row.weekdays,
      scheduled: countScheduledSessions(row.weekdays, input.from, input.to),
      held: row.held,
    })),
  };
}
