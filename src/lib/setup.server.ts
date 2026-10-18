import { ensureStudio, unwrap, type StudioContext } from "./studio.server";
import type { SetupCounts } from "./setup-progress";

const MAX_ROWS = 1000;

/** The numbers behind the setup checklist. Archived records never count, so an archived-only studio is empty. */
export async function getSetupCounts(context: StudioContext): Promise<SetupCounts> {
  const { supabase } = await ensureStudio(context);

  const [
    plansResult,
    batchesResult,
    studentsResult,
    guardiansResult,
    membersResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase.from("fee_plans").select("id").is("archived_at", null).limit(MAX_ROWS),
    supabase.from("batches").select("id").is("archived_at", null).limit(MAX_ROWS),
    supabase.from("students").select("id, guardian_id").is("archived_at", null).limit(MAX_ROWS),
    supabase
      .from("guardians")
      .select("id")
      .is("archived_at", null)
      .not("phone", "is", null)
      .limit(MAX_ROWS),
    supabase
      .from("batch_members")
      .select("student_id, batch_id")
      .is("left_on", null)
      .limit(MAX_ROWS * 5),
    supabase
      .from("fee_plan_assignments")
      .select("student_id")
      .is("ends_on", null)
      .limit(MAX_ROWS * 5),
  ]);
  const plans = unwrap(plansResult);
  const batches = unwrap(batchesResult);
  const students = unwrap(studentsResult);
  const guardians = unwrap(guardiansResult);
  const members = unwrap(membersResult);
  const assignments = unwrap(assignmentsResult);

  const activeStudents = new Set(students.map((student) => student.id));
  const activeBatches = new Set(batches.map((batch) => batch.id));
  const guardiansWithPhone = new Set(guardians.map((guardian) => guardian.id));

  return {
    feePlans: plans.length,
    batches: batches.length,
    students: students.length,
    studentsWithContact: students.filter(
      (student) => student.guardian_id !== null && guardiansWithPhone.has(student.guardian_id),
    ).length,
    studentsOnBatch: new Set(
      members
        .filter(
          (member) => activeBatches.has(member.batch_id) && activeStudents.has(member.student_id),
        )
        .map((member) => member.student_id),
    ).size,
    studentsWithPlan: new Set(
      assignments.map((a) => a.student_id).filter((id) => activeStudents.has(id)),
    ).size,
  };
}

/** Each student with their guardian, the batches they are on now and their current fee plan, in one call. */
export async function listStudentOverview(
  { supabase }: StudioContext,
  input: { includeArchived: boolean; limit: number },
) {
  let query = supabase
    .from("students")
    .select("id, name, guardian_id, archived_at")
    .order("name")
    .limit(input.limit);
  if (!input.includeArchived) query = query.is("archived_at", null);
  const students = unwrap(await query);
  if (students.length === 0) return [];

  const studentIds = students.map((student) => student.id);
  const guardianIds = [
    ...new Set(students.map((s) => s.guardian_id).filter((id): id is string => id !== null)),
  ];
  const guardians =
    guardianIds.length === 0
      ? []
      : unwrap(await supabase.from("guardians").select("id, name, phone").in("id", guardianIds));

  const members = unwrap(
    await supabase
      .from("batch_members")
      .select("student_id, batch_id")
      .in("student_id", studentIds)
      .is("left_on", null),
  );
  const batchIds = [...new Set(members.map((member) => member.batch_id))];
  const batches =
    batchIds.length === 0
      ? []
      : unwrap(await supabase.from("batches").select("id, name").in("id", batchIds));

  const assignments = unwrap(
    await supabase
      .from("fee_plan_assignments")
      .select("student_id, fee_plan_id, amount_paise, starts_on")
      .in("student_id", studentIds)
      .is("ends_on", null),
  );
  const planIds = [...new Set(assignments.map((assignment) => assignment.fee_plan_id))];
  const plans =
    planIds.length === 0
      ? []
      : unwrap(await supabase.from("fee_plans").select("id, name").in("id", planIds));

  const guardianById = new Map(guardians.map((guardian) => [guardian.id, guardian]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const assignmentByStudent = new Map(assignments.map((a) => [a.student_id, a]));

  return students.map((student) => {
    const guardian = student.guardian_id ? guardianById.get(student.guardian_id) : undefined;
    const assignment = assignmentByStudent.get(student.id);
    return {
      id: student.id,
      name: student.name,
      archived_at: student.archived_at,
      guardian: guardian ? { id: guardian.id, name: guardian.name, phone: guardian.phone } : null,
      batches: members
        .filter((member) => member.student_id === student.id)
        .map((member) => batchById.get(member.batch_id))
        .filter((batch): batch is { id: string; name: string } => batch !== undefined)
        .map((batch) => ({ id: batch.id, name: batch.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      plan: assignment
        ? {
            id: assignment.fee_plan_id,
            name: planById.get(assignment.fee_plan_id)?.name ?? "",
            amount_paise: assignment.amount_paise,
            starts_on: assignment.starts_on,
          }
        : null,
    };
  });
}
