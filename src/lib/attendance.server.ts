import { unwrap, type StudioContext } from "./studio.server";

export async function markAttendance(
  { supabase }: StudioContext,
  input: { batchId: string; date: string; marks: { studentId: string; present: boolean }[] },
) {
  const count = unwrap(
    await supabase.rpc("mark_attendance", {
      p_batch: input.batchId,
      p_session_on: input.date,
      p_marks: input.marks.map((mark) => ({ student_id: mark.studentId, present: mark.present })),
    }),
  );
  return { marked: count };
}

export async function getBatchDay(
  { supabase }: StudioContext,
  input: { batchId: string; date: string },
) {
  return unwrap(await supabase.rpc("batch_day", { p_batch: input.batchId, p_on: input.date }));
}

export async function getStudentAttendance(
  { supabase }: StudioContext,
  input: { studentId: string; from: string; to: string },
) {
  return unwrap(
    await supabase.rpc("student_attendance", {
      p_student: input.studentId,
      p_from: input.from,
      p_to: input.to,
    }),
  );
}

/** Record that a class did not happen (a festival, a holiday, the teacher away), or put it back on. */
export async function setClassHoliday(
  { supabase }: StudioContext,
  input: { batchId: string; date: string; off: boolean; reason?: string | null | undefined },
) {
  const off = unwrap(
    await supabase.rpc("set_class_holiday", {
      p_batch: input.batchId,
      p_on: input.date,
      p_off: input.off,
      p_reason: input.reason ?? null,
    }),
  );
  return { off };
}

/** The classes called off between two dates, newest first. */
export async function listClassHolidays(
  { supabase }: StudioContext,
  input: { from: string; to: string },
) {
  return unwrap(await supabase.rpc("class_holidays", { p_from: input.from, p_to: input.to }));
}
