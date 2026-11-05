import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DancerPeek } from "@/components/console/dancer-peek";
import { formatRupees } from "@/lib/money";
import { markAttendance } from "@/lib/attendance.functions";
import { sampleMark } from "@/lib/sample-studio";
import { AttendanceGate, pendingBatches, readSkipped } from "@/components/console/attendance-gate";
import { toneOf } from "@/lib/tone";
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

/** A dancer who owes but is in no batch. Without these the board's total would miss them. */
export type LooseUnpaid = {
  studentId: string;
  name: string;
  outstandingPaise: number;
  status: PayStatus;
  /** What this month's fee is, from the charge. Without it a dancer in no batch would show no fee at all. */
  feePaise?: number;
};

/**
 * One row per dancer, whatever batches they are in. Unpaid first, so the work is at the top.
 * Dancers in no batch still appear, otherwise money owed by them would be invisible here while
 * the month totals counted it.
 */
export function toBoardRows(batches: TableBatch[], loose: LooseUnpaid[] = []): BoardRow[] {
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
  for (const row of loose) {
    if (byStudent.has(row.studentId)) continue;
    byStudent.set(row.studentId, {
      studentId: row.studentId,
      name: row.name,
      batchNames: [],
      todayBatches: [],
      feePaise: row.feePaise ?? 0,
      outstandingPaise: row.outstandingPaise,
      status: row.status,
    });
  }
  return [...byStudent.values()].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
}

/** A dancer counts as here when every one of today's batches is marked present. */
export const hereToday = (row: BoardRow) =>
  row.todayBatches.length > 0 && row.todayBatches.every((batch) => batch.present === true);

/** Today's attendance for a dancer: here, absent, or not marked yet. */
export const markOf = (row: BoardRow): "present" | "absent" | null =>
  row.todayBatches.length === 0
    ? null
    : row.todayBatches.every((batch) => batch.present === true)
      ? "present"
      : row.todayBatches.every((batch) => batch.present === false)
        ? "absent"
        : null;

export const owes = (row: BoardRow) => row.outstandingPaise > 0;

export type GroupBy = "status" | "batch";
export type BoardGroup = {
  key: string;
  label: string;
  tone: "warn" | "alert" | "good" | "plain";
  rows: BoardRow[];
};

/** Splits the rows into labelled bands. By status the unpaid band comes first; by batch each batch is a band. */
export function groupBoardRows(rows: BoardRow[], by: GroupBy): BoardGroup[] {
  if (by === "status") {
    return [
      { key: "unpaid", label: "Unpaid", tone: "warn" as const, rows: rows.filter(owes) },
      {
        key: "nofee",
        label: "No fee set",
        tone: "alert" as const,
        rows: rows.filter((row) => !owes(row) && row.status === "none"),
      },
      {
        key: "paid",
        label: "Paid",
        tone: "good" as const,
        rows: rows.filter((row) => !owes(row) && row.status !== "none"),
      },
    ].filter((group) => group.rows.length > 0);
  }
  const names: string[] = [];
  for (const row of rows)
    for (const name of row.batchNames) if (!names.includes(name)) names.push(name);
  names.sort((a, b) => a.localeCompare(b));
  const groups: BoardGroup[] = names.map((name) => ({
    key: `batch-${name}`,
    label: name,
    tone: "plain",
    rows: rows.filter((row) => row.batchNames.includes(name)),
  }));
  const none = rows.filter((row) => row.batchNames.length === 0);
  if (none.length > 0)
    groups.push({ key: "no-batch", label: "No batch", tone: "plain", rows: none });
  return groups;
}

type Tab = "unpaid" | "nofee" | "today" | "all";
type Density = "compact" | "roomy";
const DENSITY_KEY = "choreo-density";

const WhatsAppIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M2 14l1-3.3A6 6 0 1 1 5.3 13z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

export function DancerBoard({
  period,
  today,
  loose,
  reminded,
  picked,
  onPickedChange,
  onRecord,
  onWhatsApp,
  onRemindMany,
  sample,
  onSampleChange,
}: {
  period: string;
  today: string;
  loose: LooseUnpaid[];
  reminded: Set<string>;
  picked: Set<string>;
  onPickedChange: (next: Set<string>) => void;
  onRecord: (student: { id: string; name: string }) => void;
  onWhatsApp: (studentId: string) => void;
  onRemindMany: (studentIds: string[]) => void;
  /** When set, the board shows this made-up studio instead of the real one and changes it only in memory. */
  sample?: TableBatch[] | null;
  onSampleChange?: (next: TableBatch[]) => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getStudioTable);
  const attend = useServerFn(markAttendance);
  const key = useMemo(() => ["studio-table", period, today], [period, today]);
  const table = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { period, date: today } }),
    enabled: !sample,
  });
  const [tab, setTab] = useState<Tab>("unpaid");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [density, setDensity] = useState<Density>("compact");
  const [peekId, setPeekId] = useState<string | null>(null);
  // While the pointer is held on a tick, sliding across the column sets every tick it touches the same way.
  const [painting, setPainting] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DENSITY_KEY) === "roomy") setDensity("roomy");
    } catch {
      // Without storage the choice just is not remembered.
    }
  }, []);
  const chooseDensity = (next: Density) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // Not remembered; nothing else depends on it.
    }
  };
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

  const batches = sample ?? table.data;
  const rows = useMemo(
    () => toBoardRows(batches ?? [], sample ? [] : loose),
    [batches, loose, sample],
  );
  const unpaid = rows.filter(owes);
  const noFeeCount = rows.filter((row) => !owes(row) && row.status === "none").length;
  const todayCount = rows.filter((row) => row.todayBatches.length > 0).length;
  const batchNames = useMemo(
    () => [...new Set(rows.flatMap((row) => row.batchNames))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const needle = search.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (tab === "unpaid"
        ? owes(row)
        : tab === "nofee"
          ? !owes(row) && row.status === "none"
          : tab === "today"
            ? row.todayBatches.length > 0
            : true) &&
      (needle === "" || row.name.toLowerCase().includes(needle)) &&
      (batchFilter === ""
        ? true
        : batchFilter === "__none"
          ? row.batchNames.length === 0
          : row.batchNames.includes(batchFilter)),
  );
  const groups = groupBoardRows(shown, groupBy);
  const chosen = unpaid.filter((row) => picked.has(row.studentId));
  const chosenTotal = chosen.reduce((sum, row) => sum + row.outstandingPaise, 0);
  const allPicked = unpaid.length > 0 && chosen.length === unpaid.length;
  const peek = peekId ? rows.find((row) => row.studentId === peekId) : undefined;

  const setMark = (row: BoardRow, value: boolean) => {
    for (const batch of row.todayBatches) {
      if (batch.present === value) continue;
      if (sample && onSampleChange)
        onSampleChange(sampleMark(sample, batch.batchId, row.studentId, value));
      else present.mutate({ batchId: batch.batchId, studentId: row.studentId, present: value });
    }
  };
  const todayRows = shown.filter((row) => row.todayBatches.length > 0);
  // "Mark all present" fills in the dancers nobody has marked yet and leaves anyone marked absent alone.
  const [gateOpen, setGateOpen] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => setSkipped(readSkipped(today)), [today, gateOpen]);
  const waiting = pendingBatches(batches ?? [], skipped);
  const unmarkedToday = waiting.length;
  const saveGate = async (batchId: string, marks: { studentId: string; present: boolean }[]) => {
    if (sample && onSampleChange) {
      onSampleChange(
        marks.reduce((acc, mark) => sampleMark(acc, batchId, mark.studentId, mark.present), sample),
      );
      return;
    }
    await attend({ data: { batchId, date: today, marks } });
    await queryClient.invalidateQueries({ queryKey: ["studio-table"] });
  };
  const togglePick = (studentId: string) => {
    const next = new Set(picked);
    if (!next.delete(studentId)) next.add(studentId);
    onPickedChange(next);
  };
  const remind = (ids: string[]) => {
    if (sample) {
      toast.info(
        "This is the sample studio, so nothing is sent. Your own dancers get a real WhatsApp chat.",
      );
      return;
    }
    onRemindMany(ids);
  };
  const remindOne = (id: string) => {
    if (sample) remind([id]);
    else onWhatsApp(id);
  };

  if (!sample && table.isPending) return <p className="console-empty">Loading your dancers…</p>;
  if (!sample && table.isError)
    return <p role="alert">Could not load your dancers. Please refresh.</p>;
  if (rows.length === 0)
    return (
      <p className="console-empty">No dancers in a batch yet. Add a batch and put dancers in it.</p>
    );

  let firstRemind = true;
  return (
    <div className="board" data-density={density} data-tour="board">
      <div className="board-bar" data-tour="toolbar">
        <div className="seg" role="tablist" aria-label="Show">
          {(
            [
              ["unpaid", "Unpaid", unpaid.length],
              ...(noFeeCount > 0 ? ([["nofee", "No fee", noFeeCount]] as const) : []),
              ["today", "Today's class", todayCount],
              ["all", "All", rows.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className="seg-btn"
              data-active={tab === value}
              onClick={() => setTab(value)}
            >
              {label} <span className="seg-count">{count}</span>
            </button>
          ))}
        </div>
        <input
          className="board-input board-search"
          type="search"
          placeholder="Find a dancer"
          aria-label="Find a dancer"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {batchNames.length > 0 && (
          <select
            className="board-input"
            aria-label="Filter by batch"
            value={batchFilter}
            onChange={(event) => setBatchFilter(event.target.value)}
          >
            <option value="">Batch: all</option>
            {batchNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {rows.some((row) => row.batchNames.length === 0) && (
              <option value="__none">No batch</option>
            )}
          </select>
        )}
        <span className="board-bar-gap" />
        <label className="board-bar-label">
          Group by
          <select
            className="board-input"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as GroupBy)}
          >
            <option value="status">Status</option>
            <option value="batch">Batch</option>
          </select>
        </label>
      </div>

      <div className="board-scroll">
        <table className="board-table">
          <colgroup>
            <col className="c-pick" />
            <col />
            <col className="c-batch" />
            <col className="c-tick" />
            <col className="c-num" />
            <col className="c-status" />
            <col className="c-rem" />
            <col className="c-act" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="board-pick">
                <span className="sr-only">Pick</span>
              </th>
              <th scope="col">Dancer</th>
              <th scope="col">Batch</th>
              <th scope="col" className="board-center" data-tour="ticks">
                Attendance today
              </th>
              <th scope="col" className="board-num">
                Fee
              </th>
              <th scope="col">Status</th>
              <th scope="col">Last reminded</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => {
            const groupUnpaid = group.rows.filter(owes);
            const groupOwed = groupUnpaid.reduce((sum, row) => sum + row.outstandingPaise, 0);
            const showRemind = groupUnpaid.length > 0;
            const tourRemind = showRemind && firstRemind;
            if (showRemind) firstRemind = false;
            return (
              <tbody key={group.key}>
                <tr className="board-group" data-tone={group.tone}>
                  <th scope="row" className="board-pick">
                    {showRemind && (
                      <input
                        type="checkbox"
                        checked={groupUnpaid.every((row) => picked.has(row.studentId))}
                        onChange={() => {
                          const next = new Set(picked);
                          const all = groupUnpaid.every((row) => next.has(row.studentId));
                          for (const row of groupUnpaid)
                            if (all) next.delete(row.studentId);
                            else next.add(row.studentId);
                          onPickedChange(next);
                        }}
                        aria-label={`Pick every dancer in ${group.label}`}
                      />
                    )}
                  </th>
                  <th scope="colgroup" colSpan={7}>
                    <span className="board-group-row">
                      <span className="board-dot" data-tone={group.tone} aria-hidden="true" />
                      <strong>{group.label}</strong>
                      <span className="board-group-meta">
                        {group.rows.length} dancer{group.rows.length === 1 ? "" : "s"}
                        {groupOwed > 0 ? ` · ${formatRupees(groupOwed)} owed` : ""}
                      </span>
                      {group.tone === "alert" && !sample && (
                        <Link to="/app/students" className="board-link">
                          Set their fees →
                        </Link>
                      )}
                      {showRemind && (
                        <button
                          type="button"
                          className="board-link"
                          data-tour={tourRemind ? "remind" : undefined}
                          onClick={() => remind(groupUnpaid.map((row) => row.studentId))}
                        >
                          Remind {groupUnpaid.length === 1 ? "1" : `all ${groupUnpaid.length}`} on
                          WhatsApp
                        </button>
                      )}
                    </span>
                  </th>
                </tr>
                {group.rows.map((row) => {
                  const mark = markOf(row);
                  const hasClass = row.todayBatches.length > 0;
                  const isPicked = picked.has(row.studentId);
                  return (
                    <tr
                      key={row.studentId}
                      data-fee={!owes(row) && row.status === "none" ? "none" : undefined}
                      data-owes={owes(row) ? "yes" : "no"}
                      data-picked={isPicked}
                    >
                      <td className="board-pick">
                        {owes(row) && (
                          <input
                            type="checkbox"
                            checked={isPicked}
                            onChange={() => togglePick(row.studentId)}
                            aria-label={`Pick ${row.name} for reminders`}
                          />
                        )}
                      </td>
                      <td className="board-name">
                        <span className="board-name-wrap">
                          <button
                            type="button"
                            className="board-name-btn"
                            onClick={() => setPeekId(row.studentId)}
                          >
                            {row.name}
                          </button>
                        </span>
                      </td>
                      <td className="board-batch">
                        {row.batchNames.length === 0 ? (
                          <span className="bchip" data-c="none">
                            No batch
                          </span>
                        ) : (
                          row.batchNames.map((name) => (
                            <span key={name} className="bchip" data-c={toneOf(name)}>
                              {name}
                            </span>
                          ))
                        )}
                      </td>
                      <td className="board-center">
                        <button
                          type="button"
                          className="board-tick"
                          data-mark={mark}
                          disabled={!hasClass}
                          aria-label={`${row.name}: ${mark === "present" ? "here, click to mark absent" : mark === "absent" ? "absent, click to mark here" : "not marked, click to mark here"}`}
                          title={
                            !hasClass
                              ? "No class today"
                              : mark === "present"
                                ? "Here. Click for absent"
                                : mark === "absent"
                                  ? "Absent. Click for here"
                                  : "Click to mark here"
                          }
                          onPointerDown={() => {
                            if (!hasClass) return;
                            const next = mark !== "present";
                            setPainting(next);
                            setMark(row, next);
                          }}
                          onPointerEnter={() => {
                            if (hasClass && painting !== null) setMark(row, painting);
                          }}
                        >
                          {mark === "present" ? "✓" : mark === "absent" ? "✕" : ""}
                        </button>
                      </td>
                      <td className="board-num">
                        {row.feePaise > 0 ? formatRupees(row.feePaise) : "—"}
                      </td>
                      <td>
                        {owes(row) ? (
                          <span className="board-status">
                            <span
                              className="chip"
                              data-tone={row.status === "overdue" ? "overdue" : "due"}
                            >
                              {row.status === "overdue" ? "Overdue" : "Due"}
                            </span>
                            <strong>{formatRupees(row.outstandingPaise)}</strong>
                          </span>
                        ) : row.status === "paid" ? (
                          <span className="chip" data-tone="paid">
                            Paid
                          </span>
                        ) : (
                          <span className="chip" data-tone="none">
                            No fee yet
                          </span>
                        )}
                      </td>
                      <td className="board-quiet">{reminded.has(row.studentId) ? "Today" : "—"}</td>
                      <td>
                        <span className="board-row-actions">
                          {owes(row) && (
                            <>
                              <button
                                type="button"
                                className="board-ib"
                                aria-label={`Remind ${row.name} on WhatsApp`}
                                title="Remind on WhatsApp"
                                onClick={() => remindOne(row.studentId)}
                              >
                                <WhatsAppIcon />
                              </button>
                              <button
                                type="button"
                                className="board-ib"
                                aria-label={`Record payment for ${row.name}`}
                                title="Record payment"
                                onClick={() => onRecord({ id: row.studentId, name: row.name })}
                              >
                                ₹
                              </button>
                            </>
                          )}
                          {!owes(row) && row.status === "none" && !sample && (
                            <Link to="/app/students" className="board-ib board-ib-text">
                              Set fee
                            </Link>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
        {groups.length === 0 && (
          <p className="console-empty board-empty">No dancers match this view.</p>
        )}
      </div>
      <AttendanceGate
        open={gateOpen}
        onOpen={() => setGateOpen(true)}
        waiting={sample ? 0 : unmarkedToday}
        onClose={() => setGateOpen(false)}
        batches={batches ?? []}
        today={today}
        onSave={saveGate}
      />
      <p className="board-foot">
        <span>
          Click once for here (green tick), again for absent (red cross). Press and slide down the
          column to mark several, or use Take attendance for the whole day.
        </span>
        <span>Click a name to open the dancer's profile.</span>
      </p>

      {chosen.length > 0 && (
        <div className="board-bulk" role="region" aria-label="Selected dancers">
          <strong>
            {chosen.length} selected · {formatRupees(chosenTotal)}
          </strong>
          <button
            type="button"
            className="board-bulk-main"
            onClick={() => remind(chosen.map((row) => row.studentId))}
          >
            Remind on WhatsApp
          </button>
          <button
            type="button"
            className="board-bulk-clear"
            onClick={() => onPickedChange(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {peek && (
        <DancerPeek
          row={peek}
          today={today}
          reminded={reminded.has(peek.studentId)}
          sample={Boolean(sample)}
          onClose={() => setPeekId(null)}
          onRecord={() => onRecord({ id: peek.studentId, name: peek.name })}
          onWhatsApp={() => remindOne(peek.studentId)}
        />
      )}
    </div>
  );
}
