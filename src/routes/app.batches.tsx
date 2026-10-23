import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { setupCountsKey } from "@/components/console/console-data";
import { Field, FormAlert } from "@/components/console/form-helpers";
import {
  fieldErrors,
  messageOf,
  weekdayNames,
  type FieldErrors,
} from "@/components/console/form-utils";
import { listBatches, saveBatch, setBatchArchived } from "@/lib/batches.functions";
import { batchInput } from "@/lib/schemas";

export const Route = createFileRoute("/app/batches")({
  head: () => ({ meta: [{ title: "Batches | ChoreoStudio" }] }),
  component: Batches,
});

type Batch = Awaited<ReturnType<typeof listBatches>>[number];

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

/** "18:30" read the way it is said in a studio: "6:30 pm". */
const spoken = (value: string) => {
  const [h = "0", m = "00"] = value.slice(0, 5).split(":");
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}${m === "00" ? "" : `:${m}`} ${hour >= 12 ? "pm" : "am"}`;
};

function describe(batch: Batch) {
  const days = batch.weekdays.map((day) => weekdayNames[day]).join(", ");
  const time = batch.starts_at
    ? `${spoken(batch.starts_at)}${batch.ends_at ? ` to ${spoken(batch.ends_at)}` : ""}`
    : "";
  return [days, time, batch.trainer_name, batch.room].filter(Boolean).join(" · ");
}

function Batches() {
  const queryClient = useQueryClient();
  const list = useServerFn(listBatches);
  const save = useServerFn(saveBatch);
  const archive = useServerFn(setBatchArchived);

  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [trainer, setTrainer] = useState("");
  const [room, setRoom] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const batches = useQuery({
    queryKey: ["batches", showArchived],
    queryFn: () => list({ data: { includeArchived: showArchived } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["batches"] });
    void queryClient.invalidateQueries({ queryKey: ["students-overview"] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };

  function openForm(batch: Batch | null) {
    setEditing(batch);
    setName(batch?.name ?? "");
    setDays(batch?.weekdays ?? []);
    setStartsAt(clock(batch?.starts_at ?? null));
    setEndsAt(clock(batch?.ends_at ?? null));
    setTrainer(batch?.trainer_name ?? "");
    setRoom(batch?.room ?? "");
    setErrors({});
    setFormError("");
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof save>[0]["data"]) => save({ data }),
    onSuccess: (_row, variables) => {
      setOpen(false);
      toast.success(variables.id ? "Batch updated." : "Batch added.");
      refresh();
    },
    onError: (error) => setFormError(messageOf(error)),
  });
  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archive({ data: input }),
    onSuccess: refresh,
    onError: (error) => setNotice(messageOf(error)),
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

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <section>
      <h1 className="display console-title">Batches</h1>
      <div className="console-toolbar">
        <Button variant="retro" type="button" onClick={() => openForm(null)}>
          + Add batch
        </Button>
        <label className="console-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      {notice && (
        <p role="status" className="console-notice">
          ✓ {notice}
        </p>
      )}
      {batches.isPending && <p className="console-empty">Loading your batches…</p>}
      {batches.isError && <p role="alert">Could not load your batches. Please refresh.</p>}
      {batches.data?.length === 0 && (
        <div className="console-empty-card">
          <p className="console-empty">No batches yet.</p>
          <p className="console-hint">
            A batch is one regular class, like &quot;Hip Hop evenings&quot;. Add the days and time, then put
            dancers in it to mark attendance.
          </p>
          <Button variant="retro" type="button" onClick={() => openForm(null)}>
            + Add your first batch
          </Button>
        </div>
      )}
      <ul className="console-list">
        {batches.data?.map((batch) => (
          <li key={batch.id} className="console-row" data-archived={batch.archived_at !== null}>
            <div>
              <strong>{batch.name}</strong>
              <span className="console-hint">
                {describe(batch) || "No schedule yet"} · {batch.member_count} dancer
                {batch.member_count === 1 ? "" : "s"}
                {batch.archived_at ? " · archived" : ""}
              </span>
            </div>
            <div className="console-row-actions">
              {!batch.archived_at && (
                <Button variant="retroPaper" type="button" onClick={() => openForm(batch)}>
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

      <ConsoleDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit batch" : "New batch"}
      >
        <form className="console-form" onSubmit={submit} noValidate>
          <Field label="Batch name" error={errors["name"]}>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Hip Hop evenings"
              autoFocus
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
            <Button variant="retroPaper" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </ConsoleDialog>
    </section>
  );
}
