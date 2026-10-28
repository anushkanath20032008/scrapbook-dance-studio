import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { formatDay } from "@/lib/format";
import {
  completeMakeup,
  getAbsentees,
  getMakeupBatches,
  getMakeups,
  planMakeup,
} from "@/lib/makeups.functions";
import { todayInIndia } from "@/lib/validators";

// Make-up classes for the owner and for a Dance teacher: pick the class that was missed, tick who missed it,
// choose the batch and day of the make-up. It sends no message and touches no fee.
export const Route = createFileRoute("/app/makeups")({
  head: () => ({ meta: [{ title: "Make-up classes | ChoreoStudio" }] }),
  component: Makeups,
});

function Makeups() {
  const queryClient = useQueryClient();
  const batchesFn = useServerFn(getMakeupBatches);
  const absenteesFn = useServerFn(getAbsentees);
  const planFn = useServerFn(planMakeup);
  const listFn = useServerFn(getMakeups);
  const doneFn = useServerFn(completeMakeup);

  const today = todayInIndia();
  const [batchId, setBatchId] = useState("");
  const [missedOn, setMissedOn] = useState(today);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [makeupBatchId, setMakeupBatchId] = useState("");
  const [makeupOn, setMakeupOn] = useState(today);
  const [error, setError] = useState("");

  const batches = useQuery({ queryKey: ["makeup-batches"], queryFn: () => batchesFn() });
  const absentees = useQuery({
    queryKey: ["makeup-absentees", batchId, missedOn],
    queryFn: () => absenteesFn({ data: { batchId, date: missedOn } }),
    enabled: batchId !== "" && missedOn !== "",
  });
  const makeups = useQuery({ queryKey: ["makeups"], queryFn: () => listFn() });

  const chosen = (absentees.data ?? []).filter((row) => picked[row.studentId]);

  const plan = useMutation({
    mutationFn: () =>
      planFn({
        data: {
          batchId,
          missedOn,
          studentIds: chosen.map((row) => row.studentId),
          makeupBatchId: makeupBatchId || batchId,
          makeupOn,
        },
      }),
    onSuccess: ({ planned }) => {
      setError("");
      setPicked({});
      toast.success(`Make-up planned for ${planned} dancer${planned === 1 ? "" : "s"}.`);
      void queryClient.invalidateQueries({ queryKey: ["makeups"] });
    },
    onError: (e) => setError(messageOf(e)),
  });

  const finish = useMutation({
    mutationFn: (id: string) => doneFn({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["makeups"] }),
    onError: (e) => setError(messageOf(e)),
  });

  return (
    <section>
      <h1 className="display console-title">Make-up classes</h1>
      <div className="window">
        <div className="window-bar chrome-font">Plan a make-up</div>
        <form
          className="window-inner console-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            if (chosen.length === 0) return setError("Tick at least one dancer who missed the class.");
            plan.mutate();
          }}
        >
          <div className="console-two">
            <label className="form-label console-field">
              Class that was missed
              <select
                className="field"
                value={batchId}
                onChange={(event) => {
                  setBatchId(event.target.value);
                  setPicked({});
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
              Date of the missed class
              <input
                className="field"
                type="date"
                value={missedOn}
                max={today}
                onChange={(event) => {
                  setMissedOn(event.target.value);
                  setPicked({});
                }}
              />
            </label>
          </div>
          {batchId && absentees.isPending && <p>Loading…</p>}
          {batchId && absentees.data && absentees.data.length === 0 && (
            <p className="console-empty">Nobody is marked absent for that class.</p>
          )}
          {absentees.data && absentees.data.length > 0 && (
            <ul className="console-list">
              {absentees.data.map((row) => (
                <li key={row.studentId} className="console-row">
                  <label className="console-check">
                    <input
                      type="checkbox"
                      checked={picked[row.studentId] === true}
                      onChange={(event) =>
                        setPicked((current) => ({ ...current, [row.studentId]: event.target.checked }))
                      }
                    />
                    {row.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="console-two">
            <label className="form-label console-field">
              Make-up in batch
              <select
                className="field"
                value={makeupBatchId || batchId}
                onChange={(event) => setMakeupBatchId(event.target.value)}
              >
                {batches.data?.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label console-field">
              Make-up date
              <input
                className="field"
                type="date"
                value={makeupOn}
                min={missedOn}
                onChange={(event) => setMakeupOn(event.target.value)}
              />
            </label>
          </div>
          <FormAlert message={error} />
          <div className="console-actions">
            <Button variant="retro" type="submit" disabled={plan.isPending || chosen.length === 0}>
              {plan.isPending ? "Saving…" : "Plan make-up"}
            </Button>
          </div>
          <p className="console-hint">This only keeps a list. It sends no message and changes no fee.</p>
        </form>
      </div>

      <div className="window">
        <div className="window-bar chrome-font">Planned make-ups</div>
        <div className="window-inner">
          {makeups.data?.length === 0 && <p className="console-empty">No make-ups planned.</p>}
          <ul className="console-list">
            {makeups.data?.map((row) => (
              <li key={row.id} className="console-row">
                <div>
                  <strong>{row.student_name}</strong>
                  <p className="console-hint">
                    Missed {row.missed_batch_name} on {formatDay(row.missed_on)} · make-up in{" "}
                    {row.makeup_batch_name} on {formatDay(row.makeup_on)}
                  </p>
                </div>
                {row.done_at ? (
                  <span className="console-hint">Done</span>
                ) : (
                  <Button
                    variant="retroPaper"
                    type="button"
                    disabled={finish.isPending}
                    onClick={() => finish.mutate(row.id)}
                  >
                    Mark done
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
