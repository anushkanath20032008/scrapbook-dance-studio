import { ensureStudio, unwrap, type StudioContext } from "./studio.server";

const planColumns = "id, name, amount_paise, classes_per_week, archived_at, created_at";

export async function listFeePlans(
  { supabase }: StudioContext,
  input: { includeArchived: boolean; limit: number },
) {
  let query = supabase.from("fee_plans").select(planColumns).order("name").limit(input.limit);
  if (!input.includeArchived) query = query.is("archived_at", null);
  const plans = unwrap(await query);
  if (plans.length === 0) return [];

  const open = unwrap(
    await supabase
      .from("fee_plan_assignments")
      .select("fee_plan_id")
      .in(
        "fee_plan_id",
        plans.map((plan) => plan.id),
      )
      .is("ends_on", null),
  );
  const counts = new Map<string, number>();
  for (const assignment of open)
    counts.set(assignment.fee_plan_id, (counts.get(assignment.fee_plan_id) ?? 0) + 1);
  return plans.map((plan) => ({ ...plan, students_assigned: counts.get(plan.id) ?? 0 }));
}

/** A price change applies to future assignments only; each student's assignment keeps the amount it started with. */
export async function saveFeePlan(
  context: StudioContext,
  input: {
    id?: string | undefined;
    name: string;
    amountPaise: number;
    classesPerWeek: number | null;
  },
) {
  const { supabase, studioId } = await ensureStudio(context);
  const values = {
    name: input.name,
    amount_paise: input.amountPaise,
    classes_per_week: input.classesPerWeek,
  };
  if (input.id) {
    return unwrap(
      await supabase
        .from("fee_plans")
        .update(values)
        .eq("id", input.id)
        .select(planColumns)
        .maybeSingle(),
      "Fee plan not found.",
    );
  }
  return unwrap(
    await supabase
      .from("fee_plans")
      .insert({ studio_id: studioId, ...values })
      .select(planColumns)
      .single(),
  );
}

export async function setFeePlanArchived(
  context: StudioContext,
  input: { id: string; archived: boolean },
) {
  const { supabase } = await ensureStudio(context);
  const archivedAt = input.archived ? new Date().toISOString() : null;
  return unwrap(
    await supabase
      .from("fee_plans")
      .update({ archived_at: archivedAt })
      .eq("id", input.id)
      .select(planColumns)
      .maybeSingle(),
    "Fee plan not found.",
  );
}

/** Give a student a fee plan from a date; their current plan ends the day before. */
export async function assignFeePlan(
  context: StudioContext,
  input: { studentId: string; planId: string; startsOn: string },
) {
  const { supabase } = await ensureStudio(context);
  const id = unwrap(
    await supabase.rpc("assign_fee_plan", {
      p_student: input.studentId,
      p_plan: input.planId,
      p_starts_on: input.startsOn,
    }),
  );
  // A fee that starts in an earlier month bills those months too, so a dancer who joined on 1 Sep is not shown as owing nothing.
  const charged = unwrap(
    await supabase.rpc("generate_student_charges", {
      p_student: input.studentId,
      p_from: input.startsOn,
    }),
  );
  return { id, charged };
}

export async function listAssignments({ supabase }: StudioContext, input: { studentId: string }) {
  const assignments = unwrap(
    await supabase
      .from("fee_plan_assignments")
      .select("id, fee_plan_id, amount_paise, starts_on, ends_on")
      .eq("student_id", input.studentId)
      .order("starts_on", { ascending: false }),
  );
  if (assignments.length === 0) return [];
  const plans = unwrap(
    await supabase
      .from("fee_plans")
      .select("id, name")
      .in("id", [...new Set(assignments.map((a) => a.fee_plan_id))]),
  );
  const names = new Map(plans.map((plan) => [plan.id, plan.name]));
  return assignments.map((assignment) => ({
    ...assignment,
    plan_name: names.get(assignment.fee_plan_id) ?? "",
  }));
}
