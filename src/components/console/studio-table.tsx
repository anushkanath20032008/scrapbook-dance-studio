import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageOf } from "@/components/console/form-utils";
import { markAttendance } from "@/lib/attendance.functions";
import { markInstructorAttendance } from "@/lib/instructors.functions";
import { formatRupees } from "@/lib/money";
import { paymentMethods } from "@/lib/schemas";
import {
  FILTERS,
  applyFilter,
  batchTotals,
  owes,
  type TableBatch,
  type TableFilter,
  type TableRow,
  type TeacherBatch,
} from "@/lib/studio-table";
import {
  getStudioTable,
  getTeacherTable,
  markBatchPaid,
  undoBatchPaid,
} from "@/lib/studio-table.functions";

const OPEN_KEY = "choreo-table-closed";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const readClosed = (): Set<string> => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

function useClosedBatches() {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  useEffect(() => setClosed(readClosed()), []);
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        // Not remembering which batches are folded is harmless.
      }
      return next;
    });
  return { closed, toggle };
}

const schedule = (batch: { weekdays: number[]; startsAt: string | null }) =>
  [batch.weekdays.map((d) => DAYS[d]).join("/"), batch.startsAt?.slice(0, 5)]
    .filter(Boolean)
    .join(" ");

function statusText(row: TableRow) {
  if (row.status === "none") return "No fee yet";
  if (!owes(row)) return "Paid";
  return `${row.status === "overdue" ? "Overdue" : "Unpaid"} ${formatRupees(row.outstandingPaise)}`;
}

function Tick({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="table-tick"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function FilterChips({
  filter,
  onChange,
}: {
  filter: TableFilter;
  onChange: (next: TableFilter) => void;
}) {
  return (
    <div className="table-chips" role="group" aria-label="Show" data-tour="filters">
      {FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="table-chip"
          aria-pressed={filter === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** The owner's home: every batch with its dancers, what each owes, and today's attendance, with bulk actions. */
export function StudioTable({
  period,
  today,
  onRecord,
  onRemindBatch,
}: {
  period: string;
  today: string;
  onRecord: (student: { id: string; name: string }) => void;
  onRemindBatch: (studentIds: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getStudioTable);
  const attend = useServerFn(markAttendance);
  const payBatch = useServerFn(markBatchPaid);
  const undo = useServerFn(undoBatchPaid);
  const key = useMemo(() => ["studio-table", period, today], [period, today]);
  const table = useQuery({ queryKey: key, queryFn: () => load({ data: { period, date: today } }) });
  const [filter, setFilter] = useState<TableFilter>("all");
  const { closed, toggle } = useClosedBatches();
  const [paying, setPaying] = useState<string | null>(null);
  const [undoable, setUndoable] = useState<{ ids: string[]; total: number } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["studio-table"] });
    void queryClient.invalidateQueries({ queryKey: ["home-report"] });
  };

  const present = useMutation({
    mutationFn: (input: { batchId: string; marks: { studentId: string; present: boolean }[] }) =>
      attend({ data: { batchId: input.batchId, date: today, marks: input.marks } }),
    onMutate: (input) => {
      queryClient.setQueryData<TableBatch[]>(key, (current) =>
        current?.map((batch) =>
          batch.id !== input.batchId
            ? batch
            : {
                ...batch,
                rows: batch.rows.map((row) => {
                  const mark = input.marks.find((m) => m.studentId === row.studentId);
                  return mark ? { ...row, present: mark.present } : row;
                }),
              },
        ),
      );
    },
    onError: (error) => {
      toast.error(messageOf(error));
      refresh();
    },
  });

  const undoMutation = useMutation({
    mutationFn: (ids: string[]) => undo({ data: { paymentIds: ids } }),
    onSuccess: ({ undone }) => {
      toast.success(`Undone: ${undone} payment${undone === 1 ? "" : "s"} removed.`);
      setUndoable(null);
      refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const batches = applyFilter(table.data ?? [], filter);

  if (table.isPending) return <p className="console-empty">Loading your dancers…</p>;
  if (table.isError) return <p role="alert">Could not load your dancers. Please refresh.</p>;
  if (table.data.length === 0)
    return (
      <p className="console-empty">
        No batches yet. Add your first batch and your dancers will appear here, grouped by batch.
      </p>
    );

  return (
    <div className="studio-table" data-tour="table">
      <FilterChips filter={filter} onChange={setFilter} />
      {undoable && (
        <div className="console-banner" role="status">
          <span>
            Marked {formatRupees(undoable.total)} as paid ({undoable.ids.length} dancer
            {undoable.ids.length === 1 ? "" : "s"}).
          </span>
          <Button
            variant="retroPaper"
            type="button"
            disabled={undoMutation.isPending}
            onClick={() => undoMutation.mutate(undoable.ids)}
          >
            Undo
          </Button>
        </div>
      )}
      {batches.length === 0 && (
        <p className="console-empty">
          {filter === "unpaid"
            ? "Everyone has paid. Nothing to chase."
            : "Nothing matches this filter."}
        </p>
      )}
      {batches.map((batch, position) => {
        const totals = batchTotals(batch.rows);
        const open = !closed.has(batch.id);
        const unpaidRows = batch.rows.filter(owes);
        return (
          <section key={batch.id} className="table-batch" aria-label={batch.name}>
            <header className="table-batch-head">
              <button
                type="button"
                className="table-batch-toggle"
                aria-expanded={open}
                onClick={() => toggle(batch.id)}
              >
                {open ? "▾" : "▸"} <strong>{batch.name}</strong>
              </button>
              <span className="table-batch-meta">
                {schedule(batch)} · {totals.count} dancer{totals.count === 1 ? "" : "s"} ·{" "}
                {totals.unpaid === 0
                  ? "all paid ✓"
                  : `${totals.paid} paid · ${formatRupees(totals.duePaise)} due`}
              </span>
              <span
                className="table-batch-actions"
                data-tour={position === 0 ? "batch-actions" : undefined}
              >
                {totals.unpaid > 0 && (
                  <Button
                    variant="retro"
                    type="button"
                    onClick={() => setPaying(paying === batch.id ? null : batch.id)}
                  >
                    Mark all paid
                  </Button>
                )}
                {batch.meetsToday && batch.rows.length > 0 && (
                  <Button
                    variant="retro"
                    type="button"
                    disabled={present.isPending}
                    onClick={() =>
                      present.mutate({
                        batchId: batch.id,
                        marks: batch.rows.map((row) => ({
                          studentId: row.studentId,
                          present: true,
                        })),
                      })
                    }
                  >
                    All present today
                  </Button>
                )}
                {totals.unpaid > 0 && (
                  <Button
                    variant="retroPaper"
                    type="button"
                    onClick={() => onRemindBatch(unpaidRows.map((row) => row.studentId))}
                  >
                    Remind unpaid ({totals.unpaid})
                  </Button>
                )}
              </span>
            </header>
            {paying === batch.id && (
              <ConfirmPaid
                batch={batch}
                period={period}
                today={today}
                onCancel={() => setPaying(null)}
                onDone={(ids, total) => {
                  setPaying(null);
                  if (ids.length > 0) setUndoable({ ids, total });
                  refresh();
                }}
                pay={payBatch}
              />
            )}
            {open && (
              <div className="table-scroll">
                <table className="table-rows table-rows-money">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Fee</th>
                      <th scope="col">Status</th>
                      <th scope="col">{batch.meetsToday ? "Here today" : "Next class"}</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rows.map((row) => (
                      <tr key={row.studentId}>
                        <td>{row.name}</td>
                        <td>{row.feePaise > 0 ? formatRupees(row.feePaise) : "—"}</td>
                        <td>
                          <span
                            className="table-pill"
                            data-status={
                              owes(row) ? row.status : row.status === "none" ? "none" : "paid"
                            }
                          >
                            {statusText(row)}
                          </span>
                        </td>
                        <td>
                          {batch.meetsToday ? (
                            <Tick
                              checked={row.present === true}
                              label={`${row.name} is here today`}
                              onChange={(next) =>
                                present.mutate({
                                  batchId: batch.id,
                                  marks: [{ studentId: row.studentId, present: next }],
                                })
                              }
                            />
                          ) : (
                            <span className="console-hint">
                              {schedule(batch).split(" ")[0] ?? ""}
                            </span>
                          )}
                        </td>
                        <td>
                          {owes(row) && (
                            <Button
                              variant="retroPaper"
                              type="button"
                              onClick={() => onRecord({ id: row.studentId, name: row.name })}
                            >
                              Record payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {batch.rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="console-hint">
                          No dancers in this batch yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ConfirmPaid({
  batch,
  period,
  today,
  pay,
  onCancel,
  onDone,
}: {
  batch: TableBatch;
  period: string;
  today: string;
  pay: ReturnType<typeof useServerFn<typeof markBatchPaid>>;
  onCancel: () => void;
  onDone: (paymentIds: string[], totalPaise: number) => void;
}) {
  const owing = batch.rows.filter(owes);
  const [chosen, setChosen] = useState<Set<string>>(new Set(owing.map((row) => row.studentId)));
  const [method, setMethod] = useState<(typeof paymentMethods)[number]>("upi");
  const [attempt] = useState(() => crypto.randomUUID());
  const total = owing
    .filter((row) => chosen.has(row.studentId))
    .reduce((sum, row) => sum + row.outstandingPaise, 0);
  const save = useMutation({
    mutationFn: () =>
      pay({
        data: {
          batchId: batch.id,
          method,
          paidOn: today,
          period,
          studentIds: [...chosen],
          idempotencyKey: attempt,
        },
      }),
    onSuccess: (result) => {
      if (result.failed.length > 0)
        toast.error(`${result.failed.length} could not be recorded. The rest are saved.`);
      onDone(result.paymentIds, result.totalPaise);
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <div className="table-confirm" role="group" aria-label={`Mark ${batch.name} paid`}>
      <p>
        <strong>
          {chosen.size} dancer{chosen.size === 1 ? "" : "s"} · {formatRupees(total)}
        </strong>{" "}
        will be marked paid. Untick anyone who has not paid.
      </p>
      <ul className="table-confirm-list">
        {owing.map((row) => (
          <li key={row.studentId}>
            <label>
              <input
                type="checkbox"
                checked={chosen.has(row.studentId)}
                onChange={(event) =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(row.studentId);
                    else next.delete(row.studentId);
                    return next;
                  })
                }
              />{" "}
              {row.name} · {formatRupees(row.outstandingPaise)}
            </label>
          </li>
        ))}
      </ul>
      <div className="console-actions">
        <label className="console-inline-label">
          Paid by
          <select
            className="field"
            value={method}
            onChange={(event) => setMethod(event.target.value as typeof method)}
          >
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Button
          variant="retro"
          type="button"
          disabled={chosen.size === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : `Confirm ${formatRupees(total)} paid`}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The teacher's home: their batches and dancers with one tick for attendance. No money appears here. */
export function TeacherTable({ today }: { today: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getTeacherTable);
  const attend = useServerFn(markInstructorAttendance);
  const key = useMemo(() => ["teacher-table", today], [today]);
  const table = useQuery({ queryKey: key, queryFn: () => load({ data: { date: today } }) });
  const [filter, setFilter] = useState<"all" | "today">("all");
  const { closed, toggle } = useClosedBatches();

  const present = useMutation({
    mutationFn: (input: { batchId: string; marks: { studentId: string; present: boolean }[] }) =>
      attend({ data: { batchId: input.batchId, date: today, marks: input.marks } }),
    onMutate: (input) => {
      queryClient.setQueryData<TeacherBatch[]>(key, (current) =>
        current?.map((batch) =>
          batch.id !== input.batchId
            ? batch
            : {
                ...batch,
                rows: batch.rows.map((row) => {
                  const mark = input.marks.find((m) => m.studentId === row.studentId);
                  return mark ? { ...row, present: mark.present } : row;
                }),
              },
        ),
      );
    },
    onError: (error) => {
      toast.error(messageOf(error));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (table.isPending) return <p className="console-empty">Loading your batches…</p>;
  if (table.isError) return <p role="alert">Could not load your batches. Please refresh.</p>;
  if (table.data.length === 0)
    return (
      <p className="console-empty">
        You have no batches yet. Ask the studio owner to add you to one.
      </p>
    );
  const batches = filter === "today" ? table.data.filter((batch) => batch.meetsToday) : table.data;

  return (
    <div className="studio-table" data-tour="table">
      <div className="table-chips" role="group" aria-label="Show">
        {(["all", "today"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className="table-chip"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {id === "all" ? "All" : "Today's classes"}
          </button>
        ))}
      </div>
      {batches.length === 0 && <p className="console-empty">No class today.</p>}
      {batches.map((batch, position) => {
        const open = !closed.has(batch.id);
        return (
          <section key={batch.id} className="table-batch" aria-label={batch.name}>
            <header className="table-batch-head">
              <button
                type="button"
                className="table-batch-toggle"
                aria-expanded={open}
                onClick={() => toggle(batch.id)}
              >
                {open ? "▾" : "▸"} <strong>{batch.name}</strong>
              </button>
              <span className="table-batch-meta">
                {schedule(batch)} · {batch.rows.length} dancer{batch.rows.length === 1 ? "" : "s"}
              </span>
              <span
                className="table-batch-actions"
                data-tour={position === 0 ? "batch-actions" : undefined}
              >
                {batch.meetsToday && batch.rows.length > 0 && (
                  <Button
                    variant="retro"
                    type="button"
                    disabled={present.isPending}
                    onClick={() =>
                      present.mutate({
                        batchId: batch.id,
                        marks: batch.rows.map((row) => ({
                          studentId: row.studentId,
                          present: true,
                        })),
                      })
                    }
                  >
                    All present today
                  </Button>
                )}
              </span>
            </header>
            {open && (
              <div className="table-scroll">
                <table className="table-rows">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">{batch.meetsToday ? "Here today" : "Next class"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rows.map((row) => (
                      <tr key={row.studentId}>
                        <td>{row.name}</td>
                        <td>
                          {batch.meetsToday ? (
                            <Tick
                              checked={row.present === true}
                              label={`${row.name} is here today`}
                              onChange={(next) =>
                                present.mutate({
                                  batchId: batch.id,
                                  marks: [{ studentId: row.studentId, present: next }],
                                })
                              }
                            />
                          ) : (
                            <span className="console-hint">
                              {schedule(batch).split(" ")[0] ?? ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
