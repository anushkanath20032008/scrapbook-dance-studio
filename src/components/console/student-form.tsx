import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { messageOf, type FieldErrors } from "@/components/console/form-utils";
import { useRefreshStudents } from "@/components/console/console-data";
import { addToBatch, type listBatches } from "@/lib/batches.functions";
import { listGuardians, saveGuardian, saveStudent } from "@/lib/directory.functions";
import { assignFeePlan, type listFeePlans } from "@/lib/fees.functions";
import { formatRupees } from "@/lib/money";
import type { listStudentOverview } from "@/lib/setup.functions";
import { isoDate, personName, phone, todayInIndia } from "@/lib/validators";

export type StudentRow = Awaited<ReturnType<typeof listStudentOverview>>[number];
export type GuardianRow = Awaited<ReturnType<typeof listGuardians>>[number];
export type BatchOption = Awaited<ReturnType<typeof listBatches>>[number];
export type PlanOption = Awaited<ReturnType<typeof listFeePlans>>[number];

const NEW_GUARDIAN = "";

// The save functions' inferred return type collapses to null, so state the row shape we rely on here.
type SavedRow = { id: string } | null;

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
  const [guardianId, setGuardianId] = useState(initial?.guardian?.id ?? NEW_GUARDIAN);
  const [guardianName, setGuardianName] = useState(initial?.guardian?.name ?? "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardian?.phone ?? "");
  const [batchId, setBatchId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState(todayInIndia());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const existing = guardians.find((guardian) => guardian.id === guardianId);

  function chooseGuardian(id: string) {
    setGuardianId(id);
    const chosen = guardians.find((guardian) => guardian.id === id);
    setGuardianName(chosen?.name ?? "");
    setGuardianPhone(chosen?.phone ?? "");
  }

  const mutation = useMutation({
    mutationFn: async (values: {
      name: string;
      guardianName: string;
      guardianPhone: string | null;
    }) => {
      const phoneValue = values.guardianPhone;
      let guardian: { id: string };
      if (existing) {
        const changed =
          existing.name !== values.guardianName || (existing.phone ?? null) !== phoneValue;
        const updated = changed
          ? ((await saveGuardianFn({
              data: {
                id: existing.id,
                name: values.guardianName,
                phone: phoneValue,
                remindersOptedOut: existing.reminders_opted_out,
              },
            })) as SavedRow)
          : existing;
        if (!updated) throw new Error("Could not save the guardian. Please try again.");
        guardian = updated;
      } else {
        const created = (await saveGuardianFn({
          data: { name: values.guardianName, phone: phoneValue },
        })) as SavedRow;
        if (!created) throw new Error("Could not save the guardian. Please try again.");
        guardian = created;
      }
      const student = (await saveStudentFn({
        data: {
          ...(initial ? { id: initial.id } : {}),
          name: values.name,
          guardianId: guardian.id,
        },
      })) as SavedRow;
      if (!student) throw new Error("Could not save the student. Please try again.");
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
          warnings.push(`could not assign the fee plan (${messageOf(error)})`);
        }
      }
      return { warnings };
    },
    onSuccess: ({ warnings }) => {
      refresh();
      if (!initial) {
        setName("");
        setGuardianId(NEW_GUARDIAN);
        setGuardianName("");
        setGuardianPhone("");
        setBatchId("");
        setPlanId("");
      }
      setErrors({});
      setFormError(
        warnings.length > 0
          ? `The student was saved, but ${warnings.join(" and ")}. Use Manage on their row to finish.`
          : "",
      );
      if (warnings.length === 0) onDone();
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const found: FieldErrors = {};
    const student = personName.safeParse(name);
    if (!student.success) found["name"] = student.error.issues[0]?.message ?? "Enter a name";
    const guardian = personName.safeParse(guardianName);
    if (!guardian.success) found["guardianName"] = "Enter the guardian's name";
    const trimmedPhone = guardianPhone.trim();
    let phoneValue: string | null = null;
    if (trimmedPhone !== "") {
      const parsedPhone = phone.safeParse(trimmedPhone);
      if (parsedPhone.success) phoneValue = parsedPhone.data;
      else
        found["guardianPhone"] =
          parsedPhone.error.issues[0]?.message ?? "Enter a valid phone number";
    }
    if (!initial && planId && !isoDate.safeParse(startsOn).success)
      found["startsOn"] = "Choose a start date";
    setErrors(found);
    if (Object.keys(found).length > 0 || !student.success || !guardian.success) return;
    mutation.mutate({ name: student.data, guardianName: guardian.data, guardianPhone: phoneValue });
  }

  return (
    <form className="console-form" onSubmit={submit} noValidate>
      <Field label="Student name" error={errors["name"]}>
        <input
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
        />
      </Field>
      <Field label="Guardian">
        <select
          className="field"
          value={guardianId}
          onChange={(event) => chooseGuardian(event.target.value)}
        >
          <option value={NEW_GUARDIAN}>New guardian</option>
          {guardians.map((guardian) => (
            <option key={guardian.id} value={guardian.id}>
              {guardian.name}
              {guardian.phone ? ` · ${guardian.phone}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="console-two">
        <Field label="Guardian name" error={errors["guardianName"]}>
          <input
            className="field"
            value={guardianName}
            onChange={(event) => setGuardianName(event.target.value)}
            maxLength={120}
          />
        </Field>
        <Field
          label="Guardian phone"
          error={errors["guardianPhone"]}
          hint={
            existing
              ? "Changes here apply to all of this guardian's children."
              : "Used for WhatsApp fee reminders."
          }
        >
          <input
            className="field"
            type="tel"
            inputMode="tel"
            value={guardianPhone}
            onChange={(event) => setGuardianPhone(event.target.value)}
            placeholder="+91 98765 43210"
          />
        </Field>
      </div>
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
            <Field label="Fee plan (optional)">
              <select
                className="field"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
              >
                <option value="">No plan yet</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {formatRupees(plan.amount_paise)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plan starts on" error={errors["startsOn"]}>
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
        <Button variant="retro" type="submit" disabled={mutation.isPending}>
          {initial ? "Save details" : "Add student"}
        </Button>
        {initial && (
          <Button variant="retroPaper" type="button" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
