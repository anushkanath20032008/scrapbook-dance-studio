import { ensureStudio, unwrap, type StudioContext } from "./studio.server";
import { likePattern } from "./validators";

const guardianColumns = "id, name, phone, reminders_opted_out, archived_at, created_at";
const studentColumns = "id, name, guardian_id, archived_at, created_at";

type ListInput = { search?: string | undefined; includeArchived: boolean; limit: number };

export async function listGuardians({ supabase }: StudioContext, input: ListInput) {
  let query = supabase.from("guardians").select(guardianColumns).order("name").limit(input.limit);
  if (!input.includeArchived) query = query.is("archived_at", null);
  if (input.search) query = query.ilike("name", likePattern(input.search));
  return unwrap(await query);
}

export async function saveGuardian(
  context: StudioContext,
  input: {
    id?: string | undefined;
    name: string;
    phone: string | null;
    remindersOptedOut: boolean;
  },
) {
  const { supabase, studioId } = await ensureStudio(context);
  const values = {
    name: input.name,
    phone: input.phone,
    reminders_opted_out: input.remindersOptedOut,
  };
  if (input.id) {
    return unwrap(
      await supabase
        .from("guardians")
        .update(values)
        .eq("id", input.id)
        .select(guardianColumns)
        .maybeSingle(),
      "Guardian not found.",
    );
  }
  return unwrap(
    await supabase
      .from("guardians")
      .insert({ studio_id: studioId, ...values })
      .select(guardianColumns)
      .single(),
  );
}

export async function setGuardianArchived(
  context: StudioContext,
  input: { id: string; archived: boolean },
) {
  const { supabase } = await ensureStudio(context);
  const archivedAt = input.archived ? new Date().toISOString() : null;
  return unwrap(
    await supabase
      .from("guardians")
      .update({ archived_at: archivedAt })
      .eq("id", input.id)
      .select(guardianColumns)
      .maybeSingle(),
    "Guardian not found.",
  );
}

export async function listStudents(
  { supabase }: StudioContext,
  input: ListInput & { guardianId?: string | undefined },
) {
  let query = supabase.from("students").select(studentColumns).order("name").limit(input.limit);
  if (!input.includeArchived) query = query.is("archived_at", null);
  if (input.search) query = query.ilike("name", likePattern(input.search));
  if (input.guardianId) query = query.eq("guardian_id", input.guardianId);
  const students = unwrap(await query);

  const guardianIds = [
    ...new Set(
      students.map((student) => student.guardian_id).filter((id): id is string => id !== null),
    ),
  ];
  const names = new Map<string, string>();
  if (guardianIds.length > 0) {
    for (const guardian of unwrap(
      await supabase.from("guardians").select("id, name").in("id", guardianIds),
    ))
      names.set(guardian.id, guardian.name);
  }
  return students.map((student) => ({
    ...student,
    guardian_name: student.guardian_id ? (names.get(student.guardian_id) ?? null) : null,
  }));
}

export async function saveStudent(
  context: StudioContext,
  input: { id?: string | undefined; name: string; guardianId: string | null },
) {
  const { supabase, studioId } = await ensureStudio(context);
  const values = { name: input.name, guardian_id: input.guardianId };
  if (input.id) {
    return unwrap(
      await supabase
        .from("students")
        .update(values)
        .eq("id", input.id)
        .select(studentColumns)
        .maybeSingle(),
      "Student not found.",
    );
  }
  return unwrap(
    await supabase
      .from("students")
      .insert({ studio_id: studioId, ...values })
      .select(studentColumns)
      .single(),
  );
}

export async function setStudentArchived(
  context: StudioContext,
  input: { id: string; archived: boolean },
) {
  const { supabase } = await ensureStudio(context);
  const archivedAt = input.archived ? new Date().toISOString() : null;
  return unwrap(
    await supabase
      .from("students")
      .update({ archived_at: archivedAt })
      .eq("id", input.id)
      .select(studentColumns)
      .maybeSingle(),
    "Student not found.",
  );
}
