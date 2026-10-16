import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import {
  fieldErrors,
  messageOf,
  weekdayNames,
  type FieldErrors,
} from "@/components/console/form-utils";
import { setupCountsKey } from "@/components/console/console-data";
import { listBatches, saveBatch, setBatchArchived } from "@/lib/batches.functions";
import { batchInput } from "@/lib/schemas";

export const Route = createFileRoute("/app/batches")({
  head: () => ({ meta: [{ title: "Batches | Choreo Studio" }] }),
  component: Batches,
});

type Batch = Awaited<ReturnType<typeof listBatches>>[number];

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

function describe(batch: Batch) {
  const days = batch.weekdays.map((day) => weekdayNames[day]).join(", ");
  const time = batch.starts_at
    ? `${clock(batch.starts_at)}${batch.ends_at ? `–${clock(batch.ends_at)}` : ""}`
    : "";
  return [days, time, batch.trainer_name, batch.room].filter(Boolean).join(" · ");
}

function Batches() {
  const queryClient = useQueryClient();
  const list = useServerFn(listBatches);
  const save = useServerFn(saveBatch);
  const archive = useServerFn(setBatchArchived);

  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [trainer, setTrainer] = useState("");
  const [room, setRoom] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const batches = useQuery({
    queryKey: ["batches", showArchived],
    queryFn: () => list({ data: { includeArchived: showArchived } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["batches"] });
    void queryClient.invalidateQueries({ queryKey: ["students-overview"] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };

  function reset() {
    setEditing(null);
    setName("");
    setDays([]);
    setStartsAt("");
    setEndsAt("");
    setTrainer("");
    setRoom("");
    setErrors({});
    setFormError("");
  }

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof save>[0]["data"]) => save({ data }),
    onSuccess: () => {
      reset();
      refresh();
    },
    onError: (error) => setFormError(messageOf(error)),
  });
  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archive({ data: input }),
    onSuccess: refresh,
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const parsed = batchInput.safeParse({
      ...(editing ? { id: editing.id } : {}),
      name,
      weekdays: days,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      trainerName: trainer,
      room,
    });
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    saveMutation.mutate(parsed.data);
  }

  function edit(batch: Batch) {
    setEditing(batch);
    setName(batch.name);
    setDays(batch.weekdays);
    setStartsAt(clock(batch.starts_at));
    setEndsAt(clock(batch.ends_at));
    setTrainer(batch.trainer_name ?? "");
    setRoom(batch.room ?? "");
    setErrors({});
    setFormError("");
  }

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <section>
      <h1 className="display console-title">Batches</h1>
      <div className="window">
        <div className="window-bar chrome-font">{editing ? "Edit batch" : "New batch"}</div>
        <form className="window-inner console-form" onSubmit={submit} noValidate>
          <Field label="Batch name" error={errors["name"]}>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Hip Hop Juniors"
            />
          </Field>
          <fieldset className="console-field">
            <legend className="form-label">Days</legend>
            <div className="console-days">
              {weekdayNames.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className="console-day"
                  aria-pressed={days.includes(day)}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="console-two">
            <Field label="Starts" error={errors["startsAt"]}>
              <input
                className="field"
                type="time"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </Field>
            <Field label="Ends" error={errors["endsAt"]}>
              <input
                className="field"
                type="time"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </Field>
          </div>
          <div className="console-two">
            <Field label="Trainer (optional)" error={errors["trainerName"]}>
              <input
                className="field"
                value={trainer}
                onChange={(event) => setTrainer(event.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Room (optional)" error={errors["room"]}>
              <input
                className="field"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
                maxLength={120}
              />
            </Field>
          </div>
          <FormAlert message={formError} />
          <div className="console-actions">
            <Button variant="retro" type="submit" disabled={saveMutation.isPending}>
              {editing ? "Save changes" : "Add batch"}
            </Button>
            {editing && (
              <Button variant="retroPaper" type="button" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="console-list-head">
        <h2>Your batches</h2>
        <label className="console-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      {batches.isError && <p role="alert">Could not load your batches. Please refresh.</p>}
      {batches.data?.length === 0 && (
        <p className="console-empty">No batches yet. Add your first above.</p>
      )}
      <ul className="console-list">
        {batches.data?.map((batch) => (
          <li key={batch.id} className="console-row" data-archived={batch.archived_at !== null}>
            <div>
              <strong>{batch.name}</strong>
              <span className="console-hint">
                {describe(batch) || "No schedule yet"} · {batch.member_count} student
                {batch.member_count === 1 ? "" : "s"}
                {batch.archived_at ? " · archived" : ""}
              </span>
            </div>
            <div className="console-row-actions">
              {!batch.archived_at && (
                <Button variant="retroPaper" type="button" onClick={() => edit(batch)}>
                  Edit
                </Button>
              )}
              <Button
                variant="retroPaper"
                type="button"
                disabled={archiveMutation.isPending}
                onClick={() =>
                  archiveMutation.mutate({ id: batch.id, archived: !batch.archived_at })
                }
              >
                {batch.archived_at ? "Restore" : "Archive"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
