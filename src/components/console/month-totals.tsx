import { formatRupees } from "@/lib/money";
import type { getHomeReport } from "@/lib/reports.functions";

type Snapshot = Awaited<ReturnType<typeof getHomeReport>>["snapshot"];

/** The month in numbers. Overdue is the headline: it is the money the owner can chase today. */
export function MonthTotals({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="totals">
      <div className="totals-headline" data-tone={snapshot.overdue_paise > 0 ? "warn" : "good"}>
        <span className="totals-label">Overdue</span>
        <strong>{formatRupees(snapshot.overdue_paise)}</strong>
        <span className="console-hint">
          {snapshot.missing_paise > 0
            ? `${formatRupees(snapshot.missing_paise)} missing in all, ${formatRupees(snapshot.not_yet_due_paise)} not yet due`
            : snapshot.charged_students > 0
              ? "Nothing missing this month"
              : "No charges yet for this month"}
        </span>
      </div>
      <dl className="totals-grid">
        <div>
          <dt>Billed</dt>
          <dd>{formatRupees(snapshot.billed_paise)}</dd>
        </div>
        <div>
          <dt>Collected</dt>
          <dd>{formatRupees(snapshot.collected_paise)}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>
            {snapshot.paid_students} of {snapshot.charged_students}
          </dd>
        </div>
        <div>
          <dt>Dancers</dt>
          <dd>{snapshot.active_students}</dd>
        </div>
        <div>
          <dt>Batches</dt>
          <dd>{snapshot.ongoing_batches}</dd>
        </div>
      </dl>
    </div>
  );
}
