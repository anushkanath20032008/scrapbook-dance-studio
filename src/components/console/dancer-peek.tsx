import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { formatRupees } from "@/lib/money";
import type { BoardRow } from "@/components/console/dancer-board";

/** A panel that slides in from the right with one dancer's month, so the list behind it keeps its place. */
export function DancerPeek({
  row,
  reminded,
  sample,
  onClose,
  onRecord,
  onWhatsApp,
}: {
  row: BoardRow;
  reminded: boolean;
  sample: boolean;
  onClose: () => void;
  onRecord: () => void;
  onWhatsApp: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const owed = row.outstandingPaise > 0;
  const classes = row.todayBatches.length;
  const here = classes > 0 && row.todayBatches.every((batch) => batch.present === true);
  return (
    <aside className="peek" role="dialog" aria-label={`${row.name}, this month`}>
      <div className="peek-head">
        <h2>{row.name}</h2>
        <button
          ref={closeRef}
          type="button"
          className="board-ib"
          aria-label="Close panel"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <dl className="peek-list">
        <div>
          <dt>This month</dt>
          <dd>
            {owed ? (
              <>
                <span className="chip" data-tone={row.status === "overdue" ? "overdue" : "due"}>
                  {row.status === "overdue" ? "Overdue" : "Due"}
                </span>{" "}
                <strong>{formatRupees(row.outstandingPaise)}</strong> owed
              </>
            ) : row.status === "paid" ? (
              <span className="chip" data-tone="paid">
                Paid
              </span>
            ) : (
              <span className="chip" data-tone="none">
                No fee yet
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Monthly fee</dt>
          <dd>{row.feePaise > 0 ? formatRupees(row.feePaise) : "Not set"}</dd>
        </div>
        <div>
          <dt>Batches</dt>
          <dd>{row.batchNames.join(", ") || "None yet"}</dd>
        </div>
        <div>
          <dt>Today</dt>
          <dd>{classes === 0 ? "No class today" : here ? "Here" : "Not marked yet"}</dd>
        </div>
        <div>
          <dt>Reminder</dt>
          <dd>{reminded ? "Reminded today" : "Not reminded today"}</dd>
        </div>
      </dl>
      <div className="peek-actions">
        {owed && (
          <>
            <button type="button" className="board-primary" onClick={onRecord}>
              Record payment
            </button>
            <button type="button" className="board-secondary" onClick={onWhatsApp}>
              Remind on WhatsApp
            </button>
          </>
        )}
        {!sample && (
          <>
            <Link to="/app/billing" search={{ student: row.studentId }} className="board-secondary">
              Full billing history
            </Link>
            <Link to="/app/students" className="board-secondary">
              Edit dancer
            </Link>
          </>
        )}
        {sample && <p className="board-quiet">Sample dancer. Nothing here is saved.</p>}
      </div>
    </aside>
  );
}
