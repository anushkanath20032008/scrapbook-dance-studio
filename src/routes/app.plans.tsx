import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { fieldErrors, messageOf, type FieldErrors } from "@/components/console/form-utils";
import { setupCountsKey } from "@/components/console/console-data";
import { listFeePlans, saveFeePlan, setFeePlanArchived } from "@/lib/fees.functions";
import { formatRupees, parseRupees } from "@/lib/money";
import { feePlanInput } from "@/lib/schemas";

export const Route = createFileRoute("/app/plans")({
  head: () => ({ meta: [{ title: "Fee plans | Choreo Studio" }] }),
  component: FeePlans,
});

type Plan = Awaited<ReturnType<typeof listFeePlans>>[number];

function FeePlans() {
  const queryClient = useQueryClient();
  const list = useServerFn(listFeePlans);
  const save = useServerFn(saveFeePlan);
  const archive = useServerFn(setFeePlanArchived);

  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [classes, setClasses] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const plans = useQuery({
    queryKey: ["fee-plans", showArchived],
    queryFn: () => list({ data: { includeArchived: showArchived } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["fee-plans"] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };

  function reset() {
    setEditing(null);
    setName("");
    setAmount("");
    setClasses("");
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
    const rupees = parseRupees(amount);
    const parsed = feePlanInput.safeParse({
      ...(editing ? { id: editing.id } : {}),
      name,
      amountPaise: rupees ?? 0,
      classesPerWeek: classes.trim() === "" ? null : Number(classes),
    });
    const found: FieldErrors = parsed.success ? {} : fieldErrors(parsed.error);
    if (rupees === null) found["amountPaise"] = "Enter an amount like 1,500";
    setErrors(found);
    if (!parsed.success || rupees === null) return;
    saveMutation.mutate(parsed.data);
  }

  function edit(plan: Plan) {
    setEditing(plan);
    setName(plan.name);
    setAmount(String(plan.amount_paise / 100));
    setClasses(plan.classes_per_week === null ? "" : String(plan.classes_per_week));
    setErrors({});
    setFormError("");
  }

  return (
    <section>
      <h1 className="display console-title">Fee plans</h1>
      <div className="window">
        <div className="window-bar chrome-font">{editing ? "Edit fee plan" : "New fee plan"}</div>
        <form className="window-inner console-form" onSubmit={submit} noValidate>
          <Field label="Plan name" error={errors["name"]}>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Monthly, 2 classes a week"
            />
          </Field>
          <Field
            label="Monthly fee (₹)"
            error={errors["amountPaise"]}
            hint={editing ? "A new price applies to future assignments only." : undefined}
          >
            <input
              className="field"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1,500"
            />
          </Field>
          <Field label="Classes per week (optional)" error={errors["classesPerWeek"]}>
            <input
              className="field"
              inputMode="numeric"
              value={classes}
              onChange={(event) => setClasses(event.target.value)}
              placeholder="2"
            />
          </Field>
          <FormAlert message={formError} />
          <div className="console-actions">
            <Button variant="retro" type="submit" disabled={saveMutation.isPending}>
              {editing ? "Save changes" : "Add fee plan"}
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
        <h2>Your fee plans</h2>
        <label className="console-check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      {plans.isError && <p role="alert">Could not load your fee plans. Please refresh.</p>}
      {plans.data?.length === 0 && (
        <p className="console-empty">No fee plans yet. Add your first above.</p>
      )}
      <ul className="console-list">
        {plans.data?.map((plan) => (
          <li key={plan.id} className="console-row" data-archived={plan.archived_at !== null}>
            <div>
              <strong>{plan.name}</strong>
              <span className="console-hint">
                {formatRupees(plan.amount_paise)} a month
                {plan.classes_per_week ? ` · ${plan.classes_per_week} classes a week` : ""} ·{" "}
                {plan.students_assigned} student{plan.students_assigned === 1 ? "" : "s"}
                {plan.archived_at ? " · archived" : ""}
              </span>
            </div>
            <div className="console-row-actions">
              {!plan.archived_at && (
                <Button variant="retroPaper" type="button" onClick={() => edit(plan)}>
                  Edit
                </Button>
              )}
              <Button
                variant="retroPaper"
                type="button"
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate({ id: plan.id, archived: !plan.archived_at })}
              >
                {plan.archived_at ? "Restore" : "Archive"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
