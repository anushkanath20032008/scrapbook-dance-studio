import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { feeLabel, messageOf, type FieldErrors } from "@/components/console/form-utils";
import { useRefreshStudents } from "@/components/console/console-data";
import { addToBatch, type listBatches } from "@/lib/batches.functions";
import { listGuardians, saveGuardian, saveStudent } from "@/lib/directory.functions";
import { assignFeePlan, type listFeePlans } from "@/lib/fees.functions";
import type { listStudentOverview } from "@/lib/setup.functions";
import { isoDate, personName, phone, todayInIndia } from "@/lib/validators";

export type StudentRow = Awaited<ReturnType<typeof listStudentOverview>>[number];
export type GuardianRow = Awaited<ReturnType<typeof listGuardians>>[number];
export type BatchOption = Awaited<ReturnType<typeof listBatches>>[number];
export type PlanOption = Awaited<ReturnType<typeof listFeePlans>>[number];

// The save functions' inferred return type collapses to null, so state the row shape we rely on here.
type SavedRow = { id: string } | null;

/**
 * A dancer is an adult who is their own contact. Under the hood each dancer has one contact record
 * (the database's guardian) carrying the same name and phone, so reminders and family links keep working.
 */
export function StudentForm({
  initial,
  guardians,
  batches,
  plans,
  onDone,
}: {
  initial?: StudentRow;
  guardians: GuardianRow[];
  batches: BatchOption[];
  plans: PlanOption[];
  onDone: () => void;
}) {
  const refresh = useRefreshStudents();
  const saveGuardianFn = useServerFn(saveGuardian);
  const saveStudentFn = useServerFn(saveStudent);
  const addToBatchFn = useServerFn(addToBatch);
  const assignFn = useServerFn(assignFeePlan);

  const [name, setName] = useState(initial?.name ?? "");
  const [dancerPhone, setDancerPhone] = useState(initial?.guardian?.phone ?? "");
  const [batchId, setBatchId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState(todayInIndia());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const addAnother = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const existing = initial?.guardian
    ? guardians.find((guardian) => guardian.id === initial.guardian?.id)
    : undefined;

  const mutation = useMutation({
    mutationFn: async (values: { name: string; phone: string | null }) => {
      const contact = (await saveGuardianFn({
        data: {
          ...(existing ? { id: existing.id } : {}),
          name: values.name,
          phone: values.phone,
          remindersOptedOut: existing?.reminders_opted_out ?? false,
        },
      })) as SavedRow;
      if (!contact) throw new Error("Could not save the dancer. Please try again.");
      const student = (await saveStudentFn({
        data: {
          ...(initial ? { id: initial.id } : {}),
          name: values.name,
          guardianId: contact.id,
        },
      })) as SavedRow;
      if (!student) throw new Error("Could not save the dancer. Please try again.");
      const warnings: string[] = [];
      if (!initial && batchId) {
        try {
          await addToBatchFn({ data: { batchId, studentId: student.id } });
        } catch (error) {
          warnings.push(`could not add to the batch (${messageOf(error)})`);
        }
      }
      if (!initial && planId) {
        try {
          await assignFn({ data: { studentId: student.id, planId, startsOn } });
        } catch (error) {
          warnings.push(`could not set the monthly fee (${messageOf(error)})`);
        }
      }
      return { warnings };
    },
    onSuccess: ({ warnings }, values) => {
      refresh();
      if (warnings.length === 0) {
        toast.success(initial ? `Saved ${values.name}.` : `Added ${values.name}.`);
        if (!initial && addAnother.current) {
          // Keep the batch and fee: the next dancer is usually in the same class.
          setName("");
          setDancerPhone("");
          setErrors({});
          nameInput.current?.focus();
          return;
        }
      }
      if (warnings.length > 0) {
        setName("");
        setDancerPhone("");
        setBatchId("");
        setPlanId("");
        setFormError(
          `The dancer was saved, but ${warnings.join(" and ")}. Use Edit on their row to finish.`,
        );
        return;
      }
      onDone();
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const found: FieldErrors = {};
    const dancer = personName.safeParse(name);
    if (!dancer.success) found["name"] = dancer.error.issues[0]?.message ?? "Enter a name";
    const trimmed = dancerPhone.trim();
    let phoneValue: string | null = null;
    if (trimmed !== "") {
      const parsed = phone.safeParse(trimmed);
      if (parsed.success) phoneValue = parsed.data;
      else found["phone"] = parsed.error.issues[0]?.message ?? "Enter a valid phone number";
    }
    if (!initial && planId && !isoDate.safeParse(startsOn).success)
      found["startsOn"] = "Choose a start date";
    setErrors(found);
    if (Object.keys(found).length > 0 || !dancer.success) return;
    mutation.mutate({ name: dancer.data, phone: phoneValue });
  }

  return (
    <form className="console-form" onSubmit={submit} noValidate>
      <Field label="Dancer name" error={errors["name"]}>
        <input
          className="field"
          ref={nameInput}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoFocus
        />
      </Field>
      <Field label="Phone" error={errors["phone"]} hint="For WhatsApp fee reminders.">
        <input
          className="field"
          type="tel"
          inputMode="tel"
          value={dancerPhone}
          onChange={(event) => setDancerPhone(event.target.value)}
          placeholder="+91 98765 43210"
        />
      </Field>
      {!initial && (
        <>
          <Field label="Batch (optional)">
            <select
              className="field"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
            >
              <option value="">No batch yet</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="console-two">
            <Field
              label="Monthly fee (optional)"
              hint={plans.length === 0 ? "No fee plans yet. Add one on the Fee plans page." : undefined}
            >
              <select
                className="field"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
              >
                <option value="">No fee yet</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {feeLabel(plan)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fee starts on" error={errors["startsOn"]}>
              <input
                className="field"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                disabled={!planId}
              />
            </Field>
          </div>
        </>
      )}
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button
          variant="retro"
          type="submit"
          disabled={mutation.isPending}
          onClick={() => (addAnother.current = false)}
        >
          {initial ? "Save details" : "Add dancer"}
        </Button>
        {!initial && (
          <Button
            variant="retroPaper"
            type="submit"
            disabled={mutation.isPending}
            onClick={() => (addAnother.current = true)}
          >
            Add and add another
          </Button>
        )}
        <Button variant="retroPaper" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
