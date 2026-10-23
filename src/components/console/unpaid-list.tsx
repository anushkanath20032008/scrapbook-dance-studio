import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { whatsappLink } from "@/lib/manual-reminders";
import type { getHomeReport } from "@/lib/reports.functions";

type Unpaid = Awaited<ReturnType<typeof getHomeReport>>["unpaid"][number];

function dueText(row: Unpaid) {
  if (row.status === "overdue")
    return `${row.days_overdue} day${row.days_overdue === 1 ? "" : "s"} overdue`;
  return `Due ${formatDay(row.due_on)}`;
}

/** Everyone who still owes for the month, oldest overdue first. */
export function UnpaidList({
  rows,
  onRecord,
  onRemind,
  studioName,
  reminded,
  onOpened,
  showQueue,
}: {
  rows: Unpaid[];
  onRecord: (row: Unpaid) => void;
  onRemind: (row: Unpaid) => void;
  studioName: string;
  reminded: Set<string>;
  onOpened: (chargeId: string) => void;
  showQueue: boolean;
}) {
  if (rows.length === 0)
    return <p className="console-empty">✓ Everyone has paid for this month. Nothing to chase.</p>;
  return (
    <ul className="console-list">
      {rows.map((row) => (
        <li key={row.charge_id} className="console-row unpaid-row">
          <div>
            <Link to="/app/billing" search={{ student: row.student_id }} className="row-link">
              <strong>{row.student_name}</strong>
            </Link>
            <span className="console-hint">
              {row.phone ?? "No phone number yet"}
            </span>
          </div>
          <div className="unpaid-owed">
            <strong>{formatRupees(row.outstanding_paise)}</strong>
            <span className="status-pill" data-tone={row.status === "overdue" ? "warn" : "idle"}>
              {dueText(row)}
            </span>
            {reminded.has(row.charge_id) && (
              <span className="status-pill" data-tone="good">
                Reminded today
              </span>
            )}
          </div>
          <div className="console-row-actions">
            <Button variant="retro" type="button" onClick={() => onRecord(row)}>
              Record payment
            </Button>
            {showQueue && (
              <Button variant="retroPaper" type="button" onClick={() => onRemind(row)}>
                Remind
              </Button>
            )}
            {whatsappLink(row, studioName) && (
              <Button asChild variant="retroPaper">
                <a
                  href={whatsappLink(row, studioName) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onOpened(row.charge_id)}
                >
                  {reminded.has(row.charge_id) ? "WhatsApp again" : "WhatsApp"}
                </a>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
