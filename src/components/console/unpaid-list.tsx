import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { getReminderLinks } from "@/lib/family.functions";
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
  const fetchLinks = useServerFn(getReminderLinks);
  // Open the chat at once (so the browser allows it), then point it at the message with the dancer's link.
  async function openWhatsApp(row: Unpaid) {
    const plain = whatsappLink(row, studioName);
    if (!plain) return;
    const tab = window.open("about:blank", "_blank");
    let target = plain;
    try {
      const links = await fetchLinks({ data: { studentIds: [row.student_id] } });
      target = whatsappLink(row, studioName, links[row.student_id] ?? null) ?? plain;
    } catch {
      // Without the link the plain reminder still opens.
    }
    if (tab) tab.location.href = target;
    else window.location.href = target;
    onOpened(row.charge_id);
  }

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
            {!row.phone && <span className="console-hint">No phone number yet</span>}
          </div>
          <div className="unpaid-owed">
            <strong>{formatRupees(row.outstanding_paise)}</strong>
            <span
              className="status-pill"
              style={{ textTransform: "none" }}
              data-tone={row.status === "overdue" ? "warn" : "idle"}
            >
              {dueText(row)}
            </span>
            {reminded.has(row.charge_id) && (
              <span className="status-pill" style={{ textTransform: "none" }} data-tone="good">
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
                <button type="button" onClick={() => void openWhatsApp(row)}>
                  {reminded.has(row.charge_id) ? "WhatsApp again" : "WhatsApp"}
                </button>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
