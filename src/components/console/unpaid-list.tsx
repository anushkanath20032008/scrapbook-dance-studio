import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/money";
import type { getHomeReport } from "@/lib/reports.functions";

type Unpaid = Awaited<ReturnType<typeof getHomeReport>>["unpaid"][number];

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function dueText(row: Unpaid) {
  if (row.status === "overdue")
    return `${row.days_overdue} day${row.days_overdue === 1 ? "" : "s"} overdue`;
  return `Due ${shortDate(row.due_on)}`;
}

/** Everyone who still owes for the month, oldest overdue first. Reminders arrive with the messages screen. */
export function UnpaidList({
  rows,
  onRecord,
}: {
  rows: Unpaid[];
  onRecord: (row: Unpaid) => void;
}) {
  if (rows.length === 0)
    return <p className="console-empty">Nobody owes anything for this month.</p>;
  return (
    <ul className="console-list">
      {rows.map((row) => (
        <li key={row.charge_id} className="console-row unpaid-row">
          <div>
            <strong>{row.student_name}</strong>
            <span className="console-hint">
              {row.phone ?? "No phone"} · due {shortDate(row.due_on)}
            </span>
          </div>
          <div className="unpaid-owed">
            <strong>{formatRupees(row.outstanding_paise)}</strong>
            <span className="status-pill" data-tone={row.status === "overdue" ? "warn" : "idle"}>
              {dueText(row)}
            </span>
          </div>
          <div className="console-row-actions">
            <Button variant="retro" type="button" onClick={() => onRecord(row)}>
              Record payment
            </Button>
            <Button variant="retroPaper" type="button" disabled title="Arrives with reminders">
              Remind
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
