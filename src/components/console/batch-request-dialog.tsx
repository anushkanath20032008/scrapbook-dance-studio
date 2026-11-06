import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { fieldErrors, messageOf, weekdayNames, type FieldErrors } from "@/components/console/form-utils";
import { requestBatch } from "@/lib/instructors.functions";
import { batchInput } from "@/lib/schemas";

/** A teacher suggests a new batch. The studio owner approves it before it becomes a real batch. */
export function BatchRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const request = useServerFn(requestBatch);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [room, setRoom] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const send = useMutation({
    mutationFn: (data: Parameters<typeof request>[0]["data"]) => request({ data }),
    onSuccess: () => {
      toast.success("Sent to the studio owner for approval.");
      void queryClient.invalidateQueries({ queryKey: ["my-batch-requests"] });
      setName("");
      setDays([]);
      setStartsAt("");
      setEndsAt("");
      setRoom("");
      onClose();
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const parsed = batchInput.safeParse({
      name,
      weekdays: days,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      trainerName: "",
      room,
    });
    setErrors(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    send.mutate(parsed.data);
  }

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  return (
    <ConsoleDialog open={open} onOpenChange={(value) => !value && onClose()} title="Suggest a batch">
      <form className="console-form" onSubmit={submit} noValidate>
        <p className="console-hint">The studio owner reviews it first. It becomes a batch once they approve.</p>
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
            <input className="field" type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </Field>
          <Field label="Ends" error={errors["endsAt"]}>
            <input className="field" type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </Field>
        </div>
        <Field label="Room (optional)" error={errors["room"]}>
          <input className="field" value={room} onChange={(event) => setRoom(event.target.value)} maxLength={120} />
        </Field>
        <FormAlert message={formError} />
        <div className="console-actions">
          <Button variant="retro" type="submit" disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Send for approval"}
          </Button>
          <Button variant="retroPaper" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </ConsoleDialog>
  );
}
