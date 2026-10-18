import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import type { getHomeReport } from "@/lib/reports.functions";

type Unpaid = Awaited<ReturnType<typeof getHomeReport>>["unpaid"][number];

function dueText(row: Unpaid) {
  if (row.status === "overdue")
    return `${row.days_overdue} day${row.days_overdue === 1 ? "" : "s"} overdue`;
  return `Due ${formatDay(row.due_on)}`;
}

/** A wa.me link with the reminder filled in, or null when the number cannot be used. */
export function whatsappLink(row: Unpaid): string | null {
  const digits = (row.phone ?? "").replace(/\D/g, "");
  const international =
    digits.length === 10 ? `91${digits}` : digits.length >= 11 && digits.length <= 15 ? digits : null;
  if (!international) return null;
  const text = `Hi ${row.student_name}, a reminder that your fee of ${formatRupees(row.outstanding_paise)} was due on ${formatDay(row.due_on)}. Thank you!`;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

/** Everyone who still owes for the month, oldest overdue first. */
export function UnpaidList({
  rows,
  onRecord,
  onRemind,
}: {
  rows: Unpaid[];
  onRecord: (row: Unpaid) => void;
  onRemind: (row: Unpaid) => void;
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
              {row.phone ?? "No phone"} · due {formatDay(row.due_on)}
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
            <Button variant="retroPaper" type="button" onClick={() => onRemind(row)}>
              Remind
            </Button>
            {whatsappLink(row) && (
              <Button asChild variant="retroPaper">
                <a href={whatsappLink(row) ?? undefined} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
