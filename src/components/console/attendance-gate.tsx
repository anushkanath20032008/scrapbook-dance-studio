import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import type { TableBatch } from "@/lib/studio-table";

const skipKey = (today: string) => `choreo-no-class-${today}`;

export function readSkipped(today: string): string[] {
  try {
    const raw = window.localStorage.getItem(skipKey(today));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSkipped(today: string, ids: string[]) {
  try {
    window.localStorage.setItem(skipKey(today), JSON.stringify(ids));
  } catch {
    // Not remembered on this device; the pop-up just asks again.
  }
}

/** Today's batches that still need attendance: no one marked yet, and not called off for the day. */
export const pendingBatches = (batches: TableBatch[], skipped: string[]) =>
  batches.filter(
    (batch) =>
      batch.meetsToday &&
      batch.rows.length > 0 &&
      !skipped.includes(batch.id) &&
      batch.rows.every((row) => row.present === null),
  );

/**
 * The daily gate: every batch that meets today, everyone already set to "here". If all came, the owner presses
 * Mark attendance and is done; absentees are tapped to turn red first. A batch that did not meet (holiday, teacher
 * away) is ticked "No class today" and nothing is recorded for it.
 */
export function AttendanceGate({
  open,
  onClose,
  batches,
  today,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  batches: TableBatch[];
  today: string;
  onSave: (batchId: string, marks: { studentId: string; present: boolean }[]) => Promise<void>;
}) {
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setAbsent(new Set());
      setOff(new Set());
      setError("");
    }
  }, [open]);

  const todays = batches.filter((batch) => batch.meetsToday && batch.rows.length > 0);
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };

  async function save() {
    setBusy(true);
    setError("");
    try {
      const skipped = new Set(readSkipped(today));
      for (const batch of todays) {
        if (off.has(batch.id)) {
          skipped.add(batch.id);
          continue;
        }
        skipped.delete(batch.id);
        await onSave(
          batch.id,
          batch.rows.map((row) => ({
            studentId: row.studentId,
            present: !absent.has(row.studentId),
          })),
        );
      }
      writeSkipped(today, [...skipped]);
      onClose();
    } catch {
      setError(
        "Could not save attendance for every batch. Nothing was lost, press the button again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const counting = todays.filter((b) => !off.has(b.id));
  const presentCount = counting.reduce(
    (sum, b) => sum + b.rows.filter((r) => !absent.has(r.studentId)).length,
    0,
  );

  return (
    <ConsoleDialog open={open} onOpenChange={(next) => !next && onClose()} title="Attendance today">
      <div className="console-form gate">
        <p className="console-hint">
          Everyone starts as here. Tap a name only if they were absent, then press Mark attendance.
        </p>
        {todays.length === 0 && <p className="console-empty">No batch meets today.</p>}
        {todays.map((batch) => {
          const called = off.has(batch.id);
          return (
            <section key={batch.id} className="gate-batch" data-off={called}>
              <div className="gate-head">
                <strong>{batch.name}</strong>
                <label className="console-check">
                  <input
                    type="checkbox"
                    checked={called}
                    onChange={() => setOff(toggle(off, batch.id))}
                  />
                  No class today / holiday
                </label>
              </div>
              {!called && (
                <ul className="gate-people">
                  {batch.rows.map((row) => {
                    const gone = absent.has(row.studentId);
                    return (
                      <li key={row.studentId}>
                        <button
                          type="button"
                          className="gate-person"
                          data-absent={gone}
                          aria-pressed={gone}
                          aria-label={`${row.name}: ${gone ? "absent" : "here"}, click to change`}
                          onClick={() => setAbsent(toggle(absent, row.studentId))}
                        >
                          <span className="gate-mark" aria-hidden="true">
                            {gone ? "✕" : "✓"}
                          </span>
                          {row.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {error && <p role="alert">{error}</p>}
        <div className="console-actions">
          <Button
            variant="retro"
            type="button"
            disabled={busy || todays.length === 0}
            onClick={() => void save()}
          >
            {busy
              ? "Saving…"
              : counting.length === 0
                ? "Save"
                : `Mark attendance (${presentCount} here, ${counting.reduce((s, b) => s + b.rows.length, 0) - presentCount} absent)`}
          </Button>
          <Button variant="retroPaper" type="button" onClick={onClose}>
            Later
          </Button>
        </div>
      </div>
    </ConsoleDialog>
  );
}
