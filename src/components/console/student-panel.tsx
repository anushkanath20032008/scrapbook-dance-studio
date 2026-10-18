import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FamilyLinkSection } from "@/components/console/family-link-section";
import { MemberAccessSection } from "@/components/console/member-access-section";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { feeLabel, messageOf } from "@/components/console/form-utils";
import { useRefreshStudents } from "@/components/console/console-data";
import {
  StudentForm,
  type BatchOption,
  type GuardianRow,
  type PlanOption,
  type StudentRow,
} from "@/components/console/student-form";
import { addToBatch, removeFromBatch } from "@/lib/batches.functions";
import { assignFeePlan } from "@/lib/fees.functions";
import { formatRupees } from "@/lib/money";
import { isoDate, todayInIndia } from "@/lib/validators";

/** Everything about one dancer in one place: details, batches and monthly fee. Each section saves on its own. */
export function StudentPanel({
  student,
  guardians,
  batches,
  plans,
  onClose,
}: {
  student: StudentRow;
  guardians: GuardianRow[];
  batches: BatchOption[];
  plans: PlanOption[];
  onClose: () => void;
}) {
  const refresh = useRefreshStudents();
  const addFn = useServerFn(addToBatch);
  const removeFn = useServerFn(removeFromBatch);
  const assignFn = useServerFn(assignFeePlan);

  const [batchId, setBatchId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startsOn, setStartsOn] = useState(todayInIndia());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const onBatchIds = new Set(student.batches.map((batch) => batch.id));
  const available = batches.filter((batch) => !onBatchIds.has(batch.id));

  const add = useMutation({
    mutationFn: () => addFn({ data: { batchId, studentId: student.id } }),
    onSuccess: () => {
      setBatchId("");
      setError("");
      setNotice("Added to the batch.");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { batchId: id, studentId: student.id } }),
    onSuccess: () => {
      setError("");
      setNotice("Removed from the batch.");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const assign = useMutation({
    mutationFn: () => assignFn({ data: { studentId: student.id, planId, startsOn } }),
    onSuccess: () => {
      setPlanId("");
      setError("");
      setNotice("Monthly fee updated.");
      refresh();
    },
    onError: (e) => setError(messageOf(e)),
  });

  return (
    <div className="console-panel">
      <h3>Details</h3>
      <StudentForm
        initial={student}
        guardians={guardians}
        batches={batches}
        plans={plans}
        onDone={onClose}
      />

      <h3>Batches</h3>
      {student.batches.length === 0 ? (
        <p className="console-hint">Not on any batch yet.</p>
      ) : (
        <ul className="console-chips">
          {student.batches.map((batch) => (
            <li key={batch.id}>
              {batch.name}
              <button
                type="button"
                aria-label={`Remove from ${batch.name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(batch.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <div className="console-inline">
          <select
            className="field"
            aria-label="Batch to add"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
          >
            <option value="">Choose a batch</option>
            {available.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <Button
            variant="retroPaper"
            type="button"
            disabled={!batchId || add.isPending}
            onClick={() => add.mutate()}
          >
            Add to batch
          </Button>
        </div>
      ) : (
        <p className="console-hint">
          {batches.length === 0
            ? "No batches yet. Add one under Batches."
            : "Already on every batch. Add another under Batches."}
        </p>
      )}

      <h3>Monthly fee</h3>
      <p className="console-hint">
        {student.plan
          ? `${formatRupees(student.plan.amount_paise)} a month since ${student.plan.starts_on}`
          : "No monthly fee yet."}
      </p>
      <div className="console-inline">
        <Field label="Change to">
          <select
            className="field"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
          >
            <option value="">Choose a fee</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {feeLabel(plan)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts on">
          <input
            className="field"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </Field>
        <Button
          variant="retroPaper"
          type="button"
          disabled={!planId || !isoDate.safeParse(startsOn).success || assign.isPending}
          onClick={() => assign.mutate()}
        >
          Set fee
        </Button>
      </div>
      {student.guardian && <MemberAccessSection guardianId={student.guardian.id} />}
      {student.guardian && <FamilyLinkSection guardianId={student.guardian.id} />}
      {notice && !error && (
        <p role="status" className="console-notice">
          ✓ {notice}
        </p>
      )}
      <FormAlert message={error} />
      <div className="console-actions">
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
