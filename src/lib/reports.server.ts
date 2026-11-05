import { unwrap, type StudioContext } from "./studio.server";
import { collectedByMethod, overdueAging } from "./month-end";
import { firstOfMonth } from "./validators";

const emptySnapshot = {
  billed_paise: 0,
  collected_paise: 0,
  missing_paise: 0,
  overdue_paise: 0,
  not_yet_due_paise: 0,
  active_students: 0,
  charged_students: 0,
  paid_students: 0,
  ongoing_batches: 0,
};

/** Names of active dancers with no charge for the month, so the "no fee yet" banner can say who. */
async function namesAwaitingFee(supabase: StudioContext["supabase"], period: string): Promise<string[]> {
  const [students, charges] = await Promise.all([
    supabase.from("students").select("id, name").is("archived_at", null).order("name").limit(2000),
    supabase.from("charges").select("student_id").eq("period", period).is("voided_at", null).limit(5000),
  ]);
  const charged = new Set(unwrap(charges).map((row) => row.student_id));
  return unwrap(students)
    .filter((student) => !charged.has(student.id))
    .map((student) => student.name);
}

/** The Home screen's data for one month: the money totals and who still owes, from the database's report functions. */
export async function getHomeReport({ supabase }: StudioContext, input: { period: string }) {
  const period = firstOfMonth(input.period);
  const [snapshotResult, unpaidResult, arrearsResult, awaitingResult] = await Promise.all([
    supabase.rpc("studio_snapshot", { p_period: period }),
    supabase.rpc("unpaid_students", { p_period: period }),
    supabase.rpc("earlier_arrears", { p_period: period }),
    supabase.rpc("dancers_awaiting_fee", { p_period: period }),
  ]);
  const snapshots = unwrap(snapshotResult);
  const unpaidRaw = unwrap(unpaidResult);
  // The reminder is written to whoever owns the phone number, so it needs the guardian's name too.
  const studentRows =
    unpaidRaw.length === 0
      ? []
      : unwrap(
          await supabase
            .from("students")
            .select("id, guardian_id")
            .in(
              "id",
              unpaidRaw.map((row) => row.student_id),
            ),
        );
  const guardianIds = [
    ...new Set(studentRows.flatMap((row) => (row.guardian_id ? [row.guardian_id] : []))),
  ];
  const guardianRows =
    guardianIds.length === 0
      ? []
      : unwrap(await supabase.from("guardians").select("id, name").in("id", guardianIds));
  const nameOfGuardian = new Map(guardianRows.map((row) => [row.id, row.name]));
  const guardianByStudent = new Map(
    studentRows.map((row) => [
      row.id,
      row.guardian_id ? (nameOfGuardian.get(row.guardian_id) ?? null) : null,
    ]),
  );
  const unpaid = unpaidRaw.map((row) => ({
    ...row,
    guardian_name: guardianByStudent.get(row.student_id) ?? null,
  }));
  // Money still owed from months before this one, per dancer: Overview is one month, so say so out loud.
  const arrears = unwrap(arrearsResult);
  const awaitingFee = unwrap(awaitingResult);
  const awaitingNames = awaitingFee > 0 ? await namesAwaitingFee(supabase, period) : [];
  return { period, snapshot: snapshots[0] ?? emptySnapshot, unpaid, arrears, awaitingFee, awaitingNames };
}

/** Billed, collected and missing for each of the last six months, oldest first, from the database. */
export async function getMonthlyTrend({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("monthly_trend", { p_months: 6 }));
}

const nextMonth = (period: string) => {
  const [year = 0, month = 0] = period.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
};

/** The month-end close: billed against collected, how it was paid, what is waiting to be checked, and how late the rest is. */
export async function getMonthEnd({ supabase }: StudioContext, input: { period: string }) {
  const { period, snapshot, unpaid } = await getHomeReport({ supabase } as StudioContext, input);
  const [paymentsResult, claimsResult] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_paise, method")
      .gte("paid_on", period)
      .lt("paid_on", nextMonth(period))
      .is("voided_at", null),
    supabase.from("payment_claims").select("amount_paise").eq("status", "pending"),
  ]);
  const claims = unwrap(claimsResult);
  return {
    period,
    snapshot,
    byMethod: collectedByMethod(unwrap(paymentsResult)),
    aging: overdueAging(unpaid),
    pendingClaims: {
      count: claims.length,
      paise: claims.reduce((sum, claim) => sum + claim.amount_paise, 0),
    },
  };
}
