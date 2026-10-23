import { formatRupees } from "./money";
import { ensureStudio, unwrap, type StudioContext } from "./studio.server";
import { firstOfMonth, todayInIndia } from "./validators";

export type BulkDancer = { name: string; phone: string | null; feePaise: number | null };

const CHUNK = 8;
const digitsOf = (phone: string | null) => (phone ?? "").replace(/\D/g, "");
const keyOf = (name: string, phone: string | null) => `${name.trim().toLowerCase()}|${digitsOf(phone)}`;

/**
 * Add a pasted list of dancers in one go: each gets a contact record (the database's guardian, which carries
 * their phone), a monthly fee from a fee plan found or created for that amount, and optionally this month's
 * charge, so the unpaid list is ready to remind from. A dancer already on the list (same name and phone) is
 * skipped, so pasting the same list twice does no harm.
 */
export async function bulkAddDancers(
  context: StudioContext,
  input: {
    dancers: BulkDancer[];
    defaultFeePaise: number | null;
    billThisMonth: boolean;
    dueOn?: string | undefined;
  },
) {
  const { supabase, studioId } = await ensureStudio(context);

  const existing = unwrap(
    await supabase.from("students").select("name, guardian_id").is("archived_at", null).limit(5000),
  );
  const guardianIds = [...new Set(existing.map((s) => s.guardian_id).filter((id) => id !== null))];
  const existingPhones = new Map<string, string>();
  if (guardianIds.length > 0) {
    for (const guardian of unwrap(
      await supabase.from("guardians").select("id, phone").in("id", guardianIds as string[]),
    ))
      existingPhones.set(guardian.id, guardian.phone ?? "");
  }
  const known = new Set(
    existing.map((s) =>
      keyOf(s.name, s.guardian_id ? (existingPhones.get(s.guardian_id) ?? null) : null),
    ),
  );
  const fresh = input.dancers.filter((dancer) => !known.has(keyOf(dancer.name, dancer.phone)));
  const skipped = input.dancers.length - fresh.length;

  // Say so before adding anything if the plan's dancer limit would be passed, so nobody is left half added.
  const capacity = await supabase.rpc("studio_capacity");
  const cap = capacity.error ? undefined : capacity.data?.[0];
  if (cap && cap.student_limit !== null && cap.student_count + fresh.length > cap.student_limit) {
    const room = Math.max(0, cap.student_limit - cap.student_count);
    throw new Error(
      `Your plan allows ${cap.student_limit} dancers and you have ${cap.student_count}, so there is room for ${room} more. Remove some lines, or upgrade to Studio+ to add more.`,
    );
  }

  let charged = 0;
  let added = 0;
  let plansCreated = 0;
  if (fresh.length > 0) {
    const guardians = unwrap(
      await supabase
        .from("guardians")
        .insert(fresh.map((dancer) => ({ studio_id: studioId, name: dancer.name, phone: dancer.phone })))
        .select("id"),
    );
    if (guardians.length !== fresh.length) throw new Error("Could not add the dancers. Please try again.");

    const studentsResult = await supabase
      .from("students")
      .insert(
        fresh.map((dancer, index) => ({
          studio_id: studioId,
          name: dancer.name,
          guardian_id: guardians[index]?.id ?? null,
        })),
      )
      .select("id");
    if (studentsResult.error || !studentsResult.data) {
      // Nothing is half added: put the contact records we just made out of sight.
      await supabase
        .from("guardians")
        .update({ archived_at: new Date().toISOString() })
        .in(
          "id",
          guardians.map((guardian) => guardian.id),
        );
      unwrap({ data: null, error: studentsResult.error });
    }
    const students = unwrap(studentsResult);
    added = students.length;

    // One fee plan per distinct amount: an existing plan with that amount is reused, otherwise one is made.
    const amounts = [
      ...new Set(
        fresh
          .map((dancer) => dancer.feePaise ?? input.defaultFeePaise)
          .filter((amount): amount is number => amount !== null),
      ),
    ];
    const planByAmount = new Map<number, string>();
    if (amounts.length > 0) {
      for (const plan of unwrap(
        await supabase
          .from("fee_plans")
          .select("id, amount_paise")
          .is("archived_at", null)
          .in("amount_paise", amounts)
          .order("created_at"),
      )) {
        if (!planByAmount.has(Number(plan.amount_paise))) planByAmount.set(Number(plan.amount_paise), plan.id);
      }
      for (const amount of amounts) {
        if (planByAmount.has(amount)) continue;
        const plan = (unwrap(
          await supabase
            .from("fee_plans")
            .insert({ studio_id: studioId, name: `Monthly ${formatRupees(amount)}`, amount_paise: amount })
            .select("id")
            .single(),
        ) as { id: string } | null);
        if (!plan) throw new Error("Could not set up the monthly fee. Please try again.");
        planByAmount.set(amount, plan.id);
        plansCreated += 1;
      }
    }

    // The fee counts from the start of this month, so this month's charge covers them.
    const startsOn = firstOfMonth(todayInIndia());
    const jobs = students.flatMap((student, index) => {
      const amount = fresh[index]?.feePaise ?? input.defaultFeePaise;
      const planId = amount === null ? undefined : planByAmount.get(amount);
      return planId ? [{ studentId: student.id, planId }] : [];
    });
    try {
      for (let from = 0; from < jobs.length; from += CHUNK) {
        await Promise.all(
          jobs.slice(from, from + CHUNK).map(async (job) =>
            unwrap(
              await supabase.rpc("assign_fee_plan", {
                p_student: job.studentId,
                p_plan: job.planId,
                p_starts_on: startsOn,
              }),
            ),
          ),
        );
      }
    } catch {
      throw new Error(
        `The ${added} dancers were added, but their monthly fees could not all be set. Open Dancers to finish the rest.`,
      );
    }
  }

  if (input.billThisMonth) {
    charged = unwrap(
      await supabase.rpc("generate_monthly_charges", {
        p_period: firstOfMonth(todayInIndia()),
        ...(input.dueOn ? { p_due_on: input.dueOn } : {}),
      }),
    );
  }
  return { added, skipped, plansCreated, charged };
}
