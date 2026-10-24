import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf, weekdayNames } from "@/components/console/form-utils";
import {
  getInstructorBatchDay,
  getInstructorBatches,
  markInstructorAttendance,
} from "@/lib/instructors.functions";
import { todayInIndia } from "@/lib/validators";

// The instructor's attendance screen: pick a batch and a date, tap who missed, save. The owner's Attendance
// page is for owners; this one only talks to the instructor functions.
export const Route = createFileRoute("/app/class")({
  head: () => ({ meta: [{ title: "Attendance | ChoreoStudio" }] }),
  component: InstructorAttendance,
});

type Marks = Record<string, boolean | null>;

function InstructorAttendance() {
  const queryClient = useQueryClient();
  const batchesFn = useServerFn(getInstructorBatches);
  const dayFn = useServerFn(getInstructorBatchDay);
  const markFn = useServerFn(markInstructorAttendance);

  const today = todayInIndia();
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(today);
  const [marks, setMarks] = useState<Marks>({});
  const [error, setError] = useState("");
  const [startedAllPresent, setStartedAllPresent] = useState(false);

  const batches = useQuery({ queryKey: ["instructor-batches"], queryFn: () => batchesFn() });
  const roster = useQuery({
    queryKey: ["instructor-batch-day", batchId, date],
    queryFn: () => dayFn({ data: { batchId, date } }),
    enabled: batchId !== "" && date !== "",
  });

  // With one batch, or one that meets today, start there.
  useEffect(() => {
    if (batchId !== "" || !batches.data || batches.data.length === 0) return;
    const weekday = new Date(`${today}T00:00:00`).getDay();
    const pick =
      (batches.data.length === 1 ? batches.data[0] : undefined) ??
      batches.data.find((batch) => batch.weekdays.includes(weekday));
    if (pick) setBatchId(pick.id);
  }, [batches.data, batchId, today]);

  // Start from what is saved. A class with nothing saved starts with everyone present: tap the ones who missed.
  useEffect(() => {
    if (!roster.data) return;
    const saved = roster.data.some((row) => row.present !== null);
    setStartedAllPresent(!saved && roster.data.length > 0);
    setMarks(
      Object.fromEntries(roster.data.map((row) => [row.student_id, saved ? row.present : true])),
    );
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
      setStartedAllPresent(false);
      const absent = Object.values(marks).filter((value) => value === false).length;
      toast.success(
        `Attendance saved: ${marked - absent} present${absent > 0 ? `, ${absent} absent` : ""}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["instructor-batch-day"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const picked = batches.data?.find((batch) => batch.id === batchId);
  const pickedWeekday = date ? new Date(`${date}T00:00:00`).getDay() : -1;
  const offDay =
    picked && picked.weekdays.length > 0 && pickedWeekday >= 0 && !picked.weekdays.includes(pickedWeekday)
      ? picked.weekdays.map((day) => weekdayNames[day]).join(", ")
      : null;
  const rows = roster.data ?? [];
  const anyMarked = Object.values(marks).some((value) => value !== null && value !== undefined);
  const presentCount = Object.values(marks).filter((value) => value === true).length;
  const absentCount = Object.values(marks).filter((value) => value === false).length;
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
                  setError("");
                }}
              />
            </label>
          </div>
          {offDay && (
            <p className="console-warning" role="status">
              {picked?.name} does not meet on that day (it meets {offDay}). You can still save it.
            </p>
          )}
          {batches.isError && <p role="alert">Could not load the batches. Please refresh.</p>}
          {batches.data?.length === 0 && (
            <p className="console-empty">The studio has no batches yet. Ask the owner to add one.</p>
          )}
          {batchId && roster.isPending && <p>Loading the dancers…</p>}
          {batchId && roster.isError && <p role="alert">Could not load this class. Please refresh.</p>}
          {batchId && roster.data && rows.length === 0 && (
            <p className="console-empty">No dancers are on this batch for that date.</p>
          )}
          {rows.length > 0 && (
            <>
              {startedAllPresent && (
                <p className="console-hint">
                  Everyone starts as present. Tap Absent for anyone who missed class, then save.
                </p>
              )}
              <ul className="console-list">
                {rows.map((row) => {
                  const mark = marks[row.student_id] ?? null;
                  return (
                    <li key={row.student_id} className="console-row attend-row">
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
              <div className="attend-bar">
                <Button
                  variant="retro"
                  type="button"
                  disabled={!anyMarked || save.isPending}
                  onClick={() => save.mutate()}
                >
                  Save attendance
                </Button>
                <Button variant="retroPaper" type="button" onClick={() => setAll(true)}>
                  All present
                </Button>
                <span className="attend-count">
                  {presentCount} present · {absentCount} absent
                </span>
              </div>
            </>
          )}
          <FormAlert message={error} />
        </div>
      </div>
    </section>
  );
}
