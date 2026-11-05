import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/money";
import { markAttendance } from "@/lib/attendance.functions";
import { getStudioTable } from "@/lib/studio-table.functions";
import type { PayStatus, TableBatch } from "@/lib/studio-table";

export type BoardRow = {
  studentId: string;
  name: string;
  batchNames: string[];
  /** The batches this dancer is in that meet today, with today's mark. Empty means no class today. */
  todayBatches: { batchId: string; present: boolean | null }[];
  feePaise: number;
  outstandingPaise: number;
  status: PayStatus;
};

const ORDER: Record<PayStatus, number> = { overdue: 0, due: 1, none: 2, paid: 3 };

/** One row per dancer, whatever batches they are in. Unpaid first, so the work is at the top. */
export function toBoardRows(batches: TableBatch[]): BoardRow[] {
  const byStudent = new Map<string, BoardRow>();
  for (const batch of batches) {
    for (const row of batch.rows) {
      const found = byStudent.get(row.studentId);
      const entry = found ?? {
        studentId: row.studentId,
        name: row.name,
        batchNames: [],
        todayBatches: [],
        feePaise: row.feePaise,
        outstandingPaise: row.outstandingPaise,
        status: row.status,
      };
      if (!entry.batchNames.includes(batch.name)) entry.batchNames.push(batch.name);
      if (batch.meetsToday) entry.todayBatches.push({ batchId: batch.id, present: row.present });
      if (!found) byStudent.set(row.studentId, entry);
    }
  }
  return [...byStudent.values()].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
}

/** A dancer counts as here when every one of today's batches is marked present. */
export const hereToday = (row: BoardRow) =>
  row.todayBatches.length > 0 && row.todayBatches.every((batch) => batch.present === true);

export const owes = (row: BoardRow) => row.outstandingPaise > 0;

type Filter = "all" | "unpaid" | "today";

export function DancerBoard({
  period,
  today,
  reminded,
  picked,
  onPickedChange,
  onRecord,
  onWhatsApp,
  onRemindMany,
}: {
  period: string;
  today: string;
  reminded: Set<string>;
  picked: Set<string>;
  onPickedChange: (next: Set<string>) => void;
  onRecord: (student: { id: string; name: string }) => void;
  onWhatsApp: (studentId: string) => void;
  onRemindMany: (studentIds: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getStudioTable);
  const attend = useServerFn(markAttendance);
  const key = useMemo(() => ["studio-table", period, today], [period, today]);
  const table = useQuery({ queryKey: key, queryFn: () => load({ data: { period, date: today } }) });
  const [filter, setFilter] = useState<Filter>("all");
  // While the pointer is held on a tick, sliding across the column sets every tick it touches the same way.
  const [painting, setPainting] = useState<boolean | null>(null);
  useEffect(() => {
    const stop = () => setPainting(null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const present = useMutation({
    mutationFn: (input: { batchId: string; studentId: string; present: boolean }) =>
      attend({
        data: {
          batchId: input.batchId,
          date: today,
          marks: [{ studentId: input.studentId, present: input.present }],
        },
      }),
    onMutate: (input) => {
      queryClient.setQueryData<TableBatch[]>(key, (current) =>
        current?.map((batch) =>
          batch.id !== input.batchId
            ? batch
            : {
                ...batch,
                rows: batch.rows.map((row) =>
                  row.studentId === input.studentId ? { ...row, present: input.present } : row,
                ),
              },
        ),
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["studio-table"] }),
  });

  const rows = useMemo(() => toBoardRows(table.data ?? []), [table.data]);
  const shown = rows.filter((row) =>
    filter === "unpaid" ? owes(row) : filter === "today" ? row.todayBatches.length > 0 : true,
  );
  const unpaid = rows.filter(owes);
  const owedTotal = unpaid.reduce((sum, row) => sum + row.outstandingPaise, 0);
  const chosen = unpaid.filter((row) => picked.has(row.studentId));
  const allPicked = unpaid.length > 0 && chosen.length === unpaid.length;

  const setMark = (row: BoardRow, value: boolean) => {
    for (const batch of row.todayBatches)
      if (batch.present !== value)
        present.mutate({ batchId: batch.batchId, studentId: row.studentId, present: value });
  };
  const togglePick = (studentId: string) => {
    const next = new Set(picked);
    if (!next.delete(studentId)) next.add(studentId);
    onPickedChange(next);
  };

  if (table.isPending) return <p className="console-empty">Loading your dancers…</p>;
  if (table.isError) return <p role="alert">Could not load your dancers. Please refresh.</p>;
  if (rows.length === 0)
    return (
      <p className="console-empty">No dancers in a batch yet. Add a batch and put dancers in it.</p>
    );

  return (
    <div className="board" data-tour="board">
      <div className="board-head">
        <div className="board-sum">
          {unpaid.length > 0 ? (
            <>
              <strong>{unpaid.length} unpaid</strong> · {formatRupees(owedTotal)} owed
            </>
          ) : (
            <strong>✓ Everyone has paid this month</strong>
          )}
        </div>
        <div className="board-actions">
          <div className="group-tabs" role="tablist" aria-label="Show">
            {(["all", "unpaid", "today"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className="group-tab"
                data-active={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : value === "unpaid" ? "Unpaid only" : "Today's classes"}
              </button>
            ))}
          </div>
          {unpaid.length > 0 && (
            <Button
              variant="retro"
              type="button"
              onClick={() =>
                onRemindMany((chosen.length > 0 ? chosen : unpaid).map((row) => row.studentId))
              }
            >
              {chosen.length > 0
                ? `Remind ${chosen.length} on WhatsApp`
                : `Remind all ${unpaid.length} on WhatsApp`}
            </Button>
          )}
        </div>
      </div>
      <div className="board-scroll">
        <table className="board-table">
          <thead>
            <tr>
              <th scope="col" className="board-pick">
                <input
                  type="checkbox"
                  checked={allPicked}
                  disabled={unpaid.length === 0}
                  onChange={() =>
                    onPickedChange(
                      allPicked ? new Set() : new Set(unpaid.map((row) => row.studentId)),
                    )
                  }
                  aria-label="Pick every unpaid dancer"
                />
              </th>
              <th scope="col">Dancer</th>
              <th scope="col">Batch</th>
              <th scope="col" className="board-tick-head">
                Here today
              </th>
              <th scope="col" className="board-num">
                Fee
              </th>
              <th scope="col" className="board-num">
                Unpaid
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const here = hereToday(row);
              const hasClass = row.todayBatches.length > 0;
              return (
                <tr key={row.studentId} data-owes={owes(row) ? "yes" : "no"}>
                  <td className="board-pick">
                    {owes(row) && (
                      <input
                        type="checkbox"
                        checked={picked.has(row.studentId)}
                        onChange={() => togglePick(row.studentId)}
                        aria-label={`Pick ${row.name} for reminders`}
                      />
                    )}
                  </td>
                  <td>
                    <Link
                      to="/app/billing"
                      search={{ student: row.studentId }}
                      className="row-link"
                    >
                      {row.name}
                    </Link>
                    {reminded.has(row.studentId) && (
                      <span className="board-note">Reminded today</span>
                    )}
                  </td>
                  <td className="board-batch">{row.batchNames.join(", ") || "—"}</td>
                  <td className="board-tick-cell">
                    <button
                      type="button"
                      className="board-tick"
                      data-on={here}
                      disabled={!hasClass}
                      aria-pressed={here}
                      aria-label={`${row.name} is here today`}
                      title={hasClass ? "Here today" : "No class today"}
                      onPointerDown={() => {
                        if (!hasClass) return;
                        setPainting(!here);
                        setMark(row, !here);
                      }}
                      onPointerEnter={() => {
                        if (hasClass && painting !== null) setMark(row, painting);
                      }}
                    >
                      {here ? "✓" : ""}
                    </button>
                  </td>
                  <td className="board-num">
                    {row.feePaise > 0 ? formatRupees(row.feePaise) : "—"}
                  </td>
                  <td className="board-num">
                    {owes(row) ? (
                      <strong data-tone={row.status === "overdue" ? "warn" : undefined}>
                        {formatRupees(row.outstandingPaise)}
                      </strong>
                    ) : row.status === "paid" ? (
                      <span className="board-paid">Paid</span>
                    ) : (
                      <span className="board-note">No fee yet</span>
                    )}
                  </td>
                  <td className="board-row-actions">
                    {owes(row) && (
                      <>
                        <Button
                          variant="retro"
                          type="button"
                          onClick={() => onRecord({ id: row.studentId, name: row.name })}
                        >
                          Record payment
                        </Button>
                        <Button
                          variant="retroPaper"
                          type="button"
                          onClick={() => onWhatsApp(row.studentId)}
                        >
                          WhatsApp
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="console-hint board-foot">
        Tick who is here today — hold and slide down the column to mark several.
      </p>
    </div>
  );
}
