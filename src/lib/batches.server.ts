import { ensureStudio, unwrap, type StudioContext } from "./studio.server";
import { todayInIndia } from "./validators";

const batchColumns =
  "id, name, weekdays, starts_at, ends_at, trainer_name, room, archived_at, created_at";

export async function listBatches(
  { supabase }: StudioContext,
  input: { includeArchived: boolean; limit: number },
) {
  let query = supabase.from("batches").select(batchColumns).order("name").limit(input.limit);
  if (!input.includeArchived) query = query.is("archived_at", null);
  const batches = unwrap(await query);
  if (batches.length === 0) return [];

  const open = unwrap(
    await supabase
      .from("batch_members")
      .select("batch_id")
      .in(
        "batch_id",
        batches.map((batch) => batch.id),
      )
      .is("left_on", null),
  );
  const counts = new Map<string, number>();
  for (const member of open) counts.set(member.batch_id, (counts.get(member.batch_id) ?? 0) + 1);
  return batches.map((batch) => ({ ...batch, member_count: counts.get(batch.id) ?? 0 }));
}

export type BatchInput = {
  id?: string | undefined;
  name: string;
  weekdays: number[];
  startsAt: string | null;
  endsAt: string | null;
  trainerName: string | null;
  room: string | null;
};

export async function saveBatch(context: StudioContext, input: BatchInput) {
  const { supabase, studioId } = await ensureStudio(context);
  const values = {
    name: input.name,
    weekdays: input.weekdays,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    trainer_name: input.trainerName,
    room: input.room,
  };
  if (input.id) {
    return unwrap(
      await supabase
        .from("batches")
        .update(values)
        .eq("id", input.id)
        .select(batchColumns)
        .maybeSingle(),
      "Batch not found.",
    );
  }
  return unwrap(
    await supabase
      .from("batches")
      .insert({ studio_id: studioId, ...values })
      .select(batchColumns)
      .single(),
  );
}

export async function setBatchArchived(
  context: StudioContext,
  input: { id: string; archived: boolean },
) {
  const { supabase } = await ensureStudio(context);
  const archivedAt = input.archived ? new Date().toISOString() : null;
  return unwrap(
    await supabase
      .from("batches")
      .update({ archived_at: archivedAt })
      .eq("id", input.id)
      .select(batchColumns)
      .maybeSingle(),
    "Batch not found.",
  );
}

export async function addToBatch(
  context: StudioContext,
  input: { batchId: string; studentId: string; joinedOn?: string | undefined },
) {
  const { supabase, studioId } = await ensureStudio(context);
  const row = {
    studio_id: studioId,
    batch_id: input.batchId,
    student_id: input.studentId,
    ...(input.joinedOn ? { joined_on: input.joinedOn } : {}),
  };
  const { data, error } = await supabase
    .from("batch_members")
    .insert(row)
    .select("id, batch_id, student_id, joined_on, left_on")
    .single();
  if (error?.code === "23505") throw new Error("That student is already on this batch's roster.");
  return unwrap({ data, error });
}

export async function removeFromBatch(
  context: StudioContext,
  input: { batchId: string; studentId: string; leftOn?: string | undefined },
) {
  const { supabase } = await ensureStudio(context);
  const rows = unwrap(
    await supabase
      .from("batch_members")
      .update({ left_on: input.leftOn ?? todayInIndia() })
      .eq("batch_id", input.batchId)
      .eq("student_id", input.studentId)
      .is("left_on", null)
      .select("id, batch_id, student_id, joined_on, left_on"),
  );
  const [member] = rows;
  if (!member) throw new Error("That student is not on this batch's roster.");
  return member;
}

/** The roster on a date (default today in India): members who had joined and not yet left. */
export async function getRoster(
  { supabase }: StudioContext,
  input: { batchId: string; asOf?: string | undefined },
) {
  const asOf = input.asOf ?? todayInIndia();
  const members = unwrap(
    await supabase
      .from("batch_members")
      .select("student_id, joined_on, left_on")
      .eq("batch_id", input.batchId)
      .lte("joined_on", asOf)
      .or(`left_on.is.null,left_on.gte.${asOf}`),
  );
  if (members.length === 0) return [];
  const students = unwrap(
    await supabase
      .from("students")
      .select("id, name")
      .in(
        "id",
        members.map((member) => member.student_id),
      ),
  );
  const names = new Map(students.map((student) => [student.id, student.name]));
  return members
    .map((member) => ({ ...member, student_name: names.get(member.student_id) ?? "" }))
    .sort((a, b) => a.student_name.localeCompare(b.student_name));
}
