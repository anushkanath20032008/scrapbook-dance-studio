import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { setupCountsKey } from "@/components/console/console-data";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { fieldErrors, messageOf, type FieldErrors } from "@/components/console/form-utils";
import { listFeePlans, saveFeePlan, setFeePlanArchived } from "@/lib/fees.functions";
import { formatRupees, parseRupees } from "@/lib/money";
import { feePlanInput } from "@/lib/schemas";

export const Route = createFileRoute("/app/plans")({
  head: () => ({ meta: [{ title: "Fee plans | ChoreoStudio" }] }),
  component: FeePlans,
});

type Plan = Awaited<ReturnType<typeof listFeePlans>>[number];

const OTHER = "other";
// ₹500 to ₹10,000 in steps of ₹500; anything else goes through "Other amount".
const feeOptions = Array.from({ length: 20 }, (_, index) => (index + 1) * 50_000);
const classOptions = [0, 1, 2, 3, 4, 5, 6, 7];

const classesLabel = (classes: number | null) =>
  classes ? `${classes} class${classes === 1 ? "" : "es"} a week` : "No fixed classes";

function FeePlans() {
  const queryClient = useQueryClient();
  const list = useServerFn(listFeePlans);
  const save = useServerFn(saveFeePlan);
  const archive = useServerFn(setFeePlanArchived);

  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [name, setName] = useState("");
  const [feeChoice, setFeeChoice] = useState("");
  const [customFee, setCustomFee] = useState("");
  const [classes, setClasses] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const plans = useQuery({
    queryKey: ["fee-plans", showArchived],
    queryFn: () => list({ data: { includeArchived: showArchived } }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["fee-plans"] });
    void queryClient.invalidateQueries({ queryKey: setupCountsKey });
  };

  function openForm(plan: Plan | null) {
    setEditing(plan);
    setName(plan?.name ?? "");
    const preset = plan ? feeOptions.includes(plan.amount_paise) : false;
    setFeeChoice(!plan ? "" : preset ? String(plan.amount_paise) : OTHER);
    setCustomFee(plan && !preset ? String(plan.amount_paise / 100) : "");
    setClasses(plan ? String(plan.classes_per_week ?? 0) : "");
    setErrors({});
    setFormError("");
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof save>[0]["data"]) => save({ data }),
    onSuccess: (_row, variables) => {
      setOpen(false);
      toast.success(variables.id ? "Fee plan updated." : "Fee plan added.");
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
    const rupees =
      feeChoice === OTHER ? parseRupees(customFee) : feeChoice ? Number(feeChoice) : null;
    const found: FieldErrors = {};
    if (!feeChoice) found["amountPaise"] = "Choose a monthly fee";
    else if (rupees === null) found["amountPaise"] = "Enter an amount like 1,500";
    if (classes === "") found["classesPerWeek"] = "Choose classes per week";
    const parsed = feePlanInput.safeParse({
      ...(editing ? { id: editing.id } : {}),
      name,
      amountPaise: rupees ?? 1,
      classesPerWeek: classes === "" || classes === "0" ? null : Number(classes),
    });
    if (!parsed.success) Object.assign(found, { ...fieldErrors(parsed.error), ...found });
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsed.success) return;
    saveMutation.mutate(parsed.data);
  }

  return (
    <section>
      <h1 className="display console-title">Fee plans</h1>
      <div className="console-toolbar">
        <Button variant="retro" type="button" onClick={() => openForm(null)}>
          + Add fee plan
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
      {plans.isPending && <p className="console-empty">Loading your fee plans…</p>}
      {plans.isError && <p role="alert">Could not load your fee plans. Please refresh.</p>}
      {plans.data?.length === 0 && (
        <div className="console-empty-card">
          <p className="console-empty">No fee plans yet.</p>
          <p className="console-hint">
            A fee plan is what a dancer pays each month, for example ₹1,500 for two classes a week.
            Dancers are billed from the plan you give them.
          </p>
          <Button variant="retro" type="button" onClick={() => openForm(null)}>
            + Add your first fee plan
          </Button>
        </div>
      )}
      <ul className="console-list">
        {plans.data?.map((plan) => (
          <li key={plan.id} className="console-row" data-archived={plan.archived_at !== null}>
            <div>
              <strong>{plan.name}</strong>
              <span className="console-hint">
                {formatRupees(plan.amount_paise)} a month · {classesLabel(plan.classes_per_week)} ·{" "}
                {plan.students_assigned} dancer{plan.students_assigned === 1 ? "" : "s"}
                {plan.archived_at ? " · archived" : ""}
              </span>
            </div>
            <div className="console-row-actions">
              {!plan.archived_at && (
                <Button variant="retroPaper" type="button" onClick={() => openForm(plan)}>
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

      <ConsoleDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit fee plan" : "New fee plan"}
      >
        <form className="console-form" onSubmit={submit} noValidate>
          <Field label="Plan name (only you see this)" error={errors["name"]}>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Twice a week"
              autoFocus
            />
          </Field>
          <Field
            label="Monthly fee"
            error={errors["amountPaise"]}
            hint={editing ? "A new price applies to future dancers only." : undefined}
          >
            <select
              className="field"
              value={feeChoice}
              onChange={(event) => setFeeChoice(event.target.value)}
            >
              <option value="">Choose a fee</option>
              {feeOptions.map((paise) => (
                <option key={paise} value={paise}>
                  {formatRupees(paise)}
                </option>
              ))}
              <option value={OTHER}>Other amount…</option>
            </select>
          </Field>
          {feeChoice === OTHER && (
            <Field label="Amount (₹)">
              <input
                className="field"
                inputMode="decimal"
                value={customFee}
                onChange={(event) => setCustomFee(event.target.value)}
                placeholder="1,750"
              />
            </Field>
          )}
          <Field label="Classes per week" error={errors["classesPerWeek"]}>
            <select
              className="field"
              value={classes}
              onChange={(event) => setClasses(event.target.value)}
            >
              <option value="">Choose</option>
              {classOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
          <FormAlert message={formError} />
          <div className="console-actions">
            <Button variant="retro" type="submit" disabled={saveMutation.isPending}>
              {editing ? "Save changes" : "Add fee plan"}
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
