import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf, weekdayNames } from "@/components/console/form-utils";
import { getBatchDay, getAttendanceSummary, markAttendance } from "@/lib/attendance.functions";
import { rangeFor, rangeLabels, type RangeKind } from "@/lib/attendance-stats";
import { listBatches } from "@/lib/batches.functions";
import { todayInIndia } from "@/lib/validators";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({ meta: [{ title: "Attendance | Choreo Studio" }] }),
  component: Attendance,
});

type Marks = Record<string, boolean | null>;

function Attendance() {
  const queryClient = useQueryClient();
  const listBatchesFn = useServerFn(listBatches);
  const dayFn = useServerFn(getBatchDay);
  const markFn = useServerFn(markAttendance);
  const summaryFn = useServerFn(getAttendanceSummary);

  const today = todayInIndia();
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(today);
  const [marks, setMarks] = useState<Marks>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeKind>("month");

  const batches = useQuery({
    queryKey: ["batches", false],
    queryFn: () => listBatchesFn({ data: {} }),
  });
  const roster = useQuery({
    queryKey: ["batch-day", batchId, date],
    queryFn: () => dayFn({ data: { batchId, date } }),
    enabled: batchId !== "" && date !== "",
  });
  const { from, to } = rangeFor(range, today);
  const summary = useQuery({
    queryKey: ["attendance-summary", from, to],
    queryFn: () => summaryFn({ data: { from, to } }),
  });

  // Start from what is already saved for that class, so a mark can be changed.
  useEffect(() => {
    if (!roster.data) return;
    setMarks(Object.fromEntries(roster.data.map((row) => [row.student_id, row.present])));
  }, [roster.data]);

  const save = useMutation({
    mutationFn: () => {
      const chosen = Object.entries(marks).filter(
        (entry): entry is [string, boolean] => entry[1] !== null && entry[1] !== undefined,
      );
      return markFn({
        data: {
          batchId,
          date,
          marks: chosen.map(([studentId, present]) => ({ studentId, present })),
        },
      });
    },
    onSuccess: ({ marked }) => {
      setError("");
      setNotice(`Saved ${marked} mark${marked === 1 ? "" : "s"}.`);
      void queryClient.invalidateQueries({ queryKey: ["batch-day"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (e) => {
      setNotice("");
      setError(messageOf(e));
    },
  });

  const rows = roster.data ?? [];
  const anyMarked = Object.values(marks).some((value) => value !== null && value !== undefined);
  const setAll = (present: boolean) =>
    setMarks(Object.fromEntries(rows.map((row) => [row.student_id, present])));

  return (
    <section>
      <h1 className="display console-title">Attendance</h1>

      <div className="window">
        <div className="window-bar chrome-font">Mark a class</div>
        <div className="window-inner console-form">
          <div className="console-two">
            <label className="form-label console-field">
              Batch
              <select
                className="field"
                value={batchId}
                onChange={(event) => {
                  setBatchId(event.target.value);
                  setNotice("");
                  setError("");
                }}
              >
                <option value="">Choose a batch</option>
                {batches.data?.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label console-field">
              Class date
              <input
                className="field"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setNotice("");
                  setError("");
                }}
              />
            </label>
          </div>

          {batchId && roster.isPending && <p>Loading the roster…</p>}
          {batchId && roster.isError && (
            <p role="alert">Could not load this class. Please refresh.</p>
          )}
          {batchId && roster.data && rows.length === 0 && (
            <p className="console-empty">No dancers are on this batch for that date.</p>
          )}
          {rows.length > 0 && (
            <>
              <ul className="console-list">
                {rows.map((row) => {
                  const mark = marks[row.student_id] ?? null;
                  return (
                    <li key={row.student_id} className="console-row">
                      <strong>{row.student_name}</strong>
                      <div
                        className="console-row-actions"
                        role="group"
                        aria-label={`Mark ${row.student_name}`}
                      >
                        <button
                          type="button"
                          className="mark-button"
                          data-tone="good"
                          aria-pressed={mark === true}
                          onClick={() => setMarks((m) => ({ ...m, [row.student_id]: true }))}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          className="mark-button"
                          data-tone="warn"
                          aria-pressed={mark === false}
                          onClick={() => setMarks((m) => ({ ...m, [row.student_id]: false }))}
                        >
                          Absent
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="console-actions">
                <Button
                  variant="retro"
                  type="button"
                  disabled={!anyMarked || save.isPending}
                  onClick={() => save.mutate()}
                >
                  Save attendance
                </Button>
                <Button variant="retroPaper" type="button" onClick={() => setAll(true)}>
                  Mark all present
                </Button>
              </div>
            </>
          )}
          {notice && (
            <p role="status" className="console-notice">
              ✓ {notice}
            </p>
          )}
          <FormAlert message={error} />
        </div>
      </div>

      <div className="console-list-head">
        <h2>How it&apos;s going</h2>
        <select
          className="field month-field"
          aria-label="Range"
          value={range}
          onChange={(event) => setRange(event.target.value as RangeKind)}
        >
          {(Object.keys(rangeLabels) as RangeKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {rangeLabels[kind]}
            </option>
          ))}
        </select>
      </div>
      {summary.isError && <p role="alert">Could not load attendance. Please refresh.</p>}

      <ul className="console-list batch-stats">
        {summary.data?.batches.map((batch) => (
          <li key={batch.id} className="console-row">
            <div>
              <strong>{batch.name}</strong>
              <span className="console-hint">
                {batch.weekdays.map((day) => weekdayNames[day]).join(", ") || "No days set"}
              </span>
            </div>
            <div className="unpaid-owed">
              <strong>
                {batch.held} of {batch.scheduled}
              </strong>
              <span className="console-hint">classes held</span>
            </div>
          </li>
        ))}
      </ul>
      {summary.data?.batches.length === 0 && <p className="console-empty">No batches yet.</p>}

      <div className="console-list-head">
        <h2>Dancers</h2>
      </div>
      {summary.data?.students.length === 0 && <p className="console-empty">No dancers yet.</p>}
      <ul className="console-list">
        {summary.data?.students.map((student) => (
          <li key={student.id} className="console-row">
            <div>
              <strong>{student.name}</strong>
              <span className="console-hint">
                {student.marked === 0
                  ? "No classes marked"
                  : `${student.present} of ${student.marked} classes`}
              </span>
            </div>
            <span
              className="status-pill"
              data-tone={
                student.percent === null ? "idle" : student.percent >= 75 ? "good" : "warn"
              }
            >
              {student.percent === null ? "—" : `${student.percent}%`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
