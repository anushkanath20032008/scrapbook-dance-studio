import { unwrap, type StudioContext } from "./studio.server";
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

/** The Home screen's data for one month: the money totals and who still owes, from the database's report functions. */
export async function getHomeReport({ supabase }: StudioContext, input: { period: string }) {
  const period = firstOfMonth(input.period);
  const [snapshotResult, unpaidResult] = await Promise.all([
    supabase.rpc("studio_snapshot", { p_period: period }),
    supabase.rpc("unpaid_students", { p_period: period }),
  ]);
  const snapshots = unwrap(snapshotResult);
  const unpaid = unwrap(unpaidResult);
  return { period, snapshot: snapshots[0] ?? emptySnapshot, unpaid };
}

/** Billed, collected and missing for each of the last six months, oldest first, from the database. */
export async function getMonthlyTrend({ supabase }: StudioContext) {
  return unwrap(await supabase.rpc("monthly_trend", { p_months: 6 }));
}
