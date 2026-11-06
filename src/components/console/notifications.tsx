import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getStudioTable } from "@/lib/studio-table.functions";
import { getHomeReport } from "@/lib/reports.functions";
import { formatRupees } from "@/lib/money";
import { firstOfMonth, todayInIndia } from "@/lib/validators";
import type { TableBatch } from "@/lib/studio-table";

export type Note = { id: string; text: string; to: string; tone: "warn" | "info" };

type Claim = { claim_id: string; student_name: string; amount_paise: number };

/** What the studio should look at, worked out from what is already on screen elsewhere. */
export function buildNotes(input: {
  claims: Claim[];
  batches: TableBatch[];
  unpaidCount: number;
  outstandingPaise: number;
  charged: boolean;
}): Note[] {
  const notes: Note[] = [];
  for (const claim of input.claims.slice(0, 5))
    notes.push({
      id: `claim-${claim.claim_id}`,
      tone: "warn",
      text: `${claim.student_name} says they paid ${formatRupees(claim.amount_paise)}. Open their card to confirm.`,
      to: "/app",
    });
  const unmarked = input.batches.filter(
    (batch) =>
      batch.meetsToday && batch.rows.length > 0 && batch.rows.every((row) => row.present === null),
  );
  if (unmarked.length > 0)
    notes.push({
      id: "attendance",
      tone: "info",
      text: `Attendance is not marked for ${unmarked.map((batch) => batch.name).join(", ")}.`,
      to: "/app",
    });
  if (!input.charged)
    notes.push({
      id: "charges",
      tone: "warn",
      text: "This month's fees have not been added yet, so nobody shows as owing.",
      to: "/app",
    });
  else if (input.unpaidCount > 0)
    notes.push({
      id: "unpaid",
      tone: "info",
      text: `${input.unpaidCount} dancer${input.unpaidCount === 1 ? "" : "s"} still owe ${formatRupees(input.outstandingPaise)}.`,
      to: "/app",
    });
  return notes;
}

/** The bell in the top bar: what needs the owner today, in one list. */
export function Notifications({ claims }: { claims: Claim[] }) {
  const [open, setOpen] = useState(false);
  const today = todayInIndia();
  const period = firstOfMonth(`${today.slice(0, 7)}-01`);
  const loadTable = useServerFn(getStudioTable);
  const loadReport = useServerFn(getHomeReport);
  const table = useQuery({
    queryKey: ["studio-table", period, today],
    queryFn: () => loadTable({ data: { period, date: today } }),
  });
  const report = useQuery({
    queryKey: ["home-report", period],
    queryFn: () => loadReport({ data: { period } }),
  });
  const notes = buildNotes({
    claims,
    batches: table.data ?? [],
    unpaidCount: report.data?.unpaid.length ?? 0,
    outstandingPaise: (report.data?.unpaid ?? []).reduce(
      (sum, row) => sum + Number(row.outstanding_paise),
      0,
    ),
    charged: (report.data?.snapshot.charged_students ?? 0) > 0,
  });

  return (
    <div className="bell-wrap">
      <button
        type="button"
        className="bell"
        aria-label={`Notifications: ${notes.length}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {notes.length > 0 && <span className="bell-count">{notes.length}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            <button
              type="button"
              className="gate-x"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="console-hint">Nothing needs you right now.</p>
          ) : (
            <ul className="bell-list">
              {notes.map((note) => (
                <li key={note.id} data-tone={note.tone}>
                  <Link to={note.to} onClick={() => setOpen(false)}>
                    {note.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
