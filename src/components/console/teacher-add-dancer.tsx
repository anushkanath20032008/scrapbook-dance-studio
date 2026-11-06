import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { messageOf, type FieldErrors } from "@/components/console/form-utils";
import { addInstructorStudent } from "@/lib/instructors.functions";
import { personName, phone } from "@/lib/validators";

/** A teacher adds a dancer to one of their batches. The studio owner sees them straight away and sets the fee. */
export function TeacherAddDancer({
  batch,
  onClose,
}: {
  batch: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const add = useServerFn(addInstructorStudent);
  const [name, setName] = useState("");
  const [dancerPhone, setDancerPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { batchId: string; name: string; phone: string | null }) => add({ data }),
    onSuccess: (_id, variables) => {
      toast.success(`Added ${variables.name}.`);
      void queryClient.invalidateQueries({ queryKey: ["instructor-roster", variables.batchId] });
      void queryClient.invalidateQueries({ queryKey: ["instructor-batch-day"] });
      setName("");
      setDancerPhone("");
      onClose();
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!batch) return;
    setFormError("");
    const found: FieldErrors = {};
    const parsedName = personName.safeParse(name);
    if (!parsedName.success) found["name"] = parsedName.error.issues[0]?.message ?? "Enter a name";
    let phoneValue: string | null = null;
    if (dancerPhone.trim() !== "") {
      const parsed = phone.safeParse(dancerPhone.trim());
      if (parsed.success) phoneValue = parsed.data;
      else found["phone"] = parsed.error.issues[0]?.message ?? "Enter a valid phone number";
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsedName.success) return;
    mutation.mutate({ batchId: batch.id, name: parsedName.data, phone: phoneValue });
  }

  return (
    <ConsoleDialog
      open={batch !== null}
      onOpenChange={(open) => !open && onClose()}
      title={batch ? `Add a dancer to ${batch.name}` : "Add a dancer"}
    >
      <form className="console-form" onSubmit={submit} noValidate>
        <Field label="Dancer name" error={errors["name"]}>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
        </Field>
        <Field label="Phone (optional)" error={errors["phone"]} hint="The studio owner uses it for fee reminders.">
          <input
            className="field"
            type="tel"
            inputMode="tel"
            value={dancerPhone}
            onChange={(event) => setDancerPhone(event.target.value)}
            placeholder="+91 98765 43210"
          />
        </Field>
        <FormAlert message={formError} />
        <div className="console-actions">
          <Button variant="retro" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Adding…" : "Add dancer"}
          </Button>
          <Button variant="retroPaper" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </ConsoleDialog>
  );
}
