import { friendlyError, unwrap, type StudioContext } from "./studio.server";

// Make-up classes for the owner and for a Dance teacher. The database functions start from the caller's own
// studio, so this layer only chooses between the owner's and the teacher's way of listing batches and absences.

/** Batches the caller may plan a make-up in: a teacher's own batches, or all of the owner's active ones. */
export async function listMakeupBatches({ supabase }: StudioContext) {
  const teacher = await supabase.rpc("instructor_batches");
  if (!teacher.error) return teacher.data.map((batch) => ({ id: batch.id, name: batch.name }));
  const owner = unwrap(
    await supabase.from("batches").select("id, name").is("archived_at", null).order("name").limit(200),
  );
  return owner.map((batch) => ({ id: batch.id, name: batch.name }));
}

/** Dancers recorded absent from one batch on one date: names only. */
export async function listAbsentees(
  { supabase }: StudioContext,
  input: { batchId: string; date: string },
) {
  const teacher = await supabase.rpc("instructor_batch_day", { p_batch: input.batchId, p_on: input.date });
  if (!teacher.error) {
    return teacher.data
      .filter((row) => row.present === false)
      .map((row) => ({ studentId: row.student_id, name: row.student_name }));
  }
  const session = await supabase
    .from("class_sessions")
    .select("id")
    .eq("batch_id", input.batchId)
    .eq("session_on", input.date)
    .maybeSingle();
  if (session.error) throw friendlyError(session.error);
  if (!session.data) return [];
  const records = unwrap(
    await supabase.from("attendance_records").select("student_id").eq("session_id", session.data.id).eq("present", false),
  );
  if (records.length === 0) return [];
  const students = unwrap(
    await supabase.from("students").select("id, name").in("id", records.map((row) => row.student_id)),
  );
  return students.map((student) => ({ studentId: student.id, name: student.name }));
}

export async function planMakeup(
  { supabase }: StudioContext,
  input: { batchId: string; missedOn: string; studentIds: string[]; makeupBatchId: string; makeupOn: string },
) {
  const planned = unwrap(
    await supabase.rpc("plan_makeup", {
      p_batch: input.batchId,
      p_missed_on: input.missedOn,
      p_students: input.studentIds,
      p_makeup_batch: input.makeupBatchId,
      p_makeup_on: input.makeupOn,
    }),
  );
  return { planned };
}

export async function listMakeups({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("list_makeups"));
}

export async function finishMakeup({ supabase }: StudioContext, input: { id: string }) {
  unwrap(await supabase.rpc("finish_makeup", { p_id: input.id }));
  return { ok: true };
}
