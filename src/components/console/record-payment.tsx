import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useRefreshMoney } from "@/components/console/console-data";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { fieldErrors, messageOf, type FieldErrors } from "@/components/console/form-utils";
import { checkPayment, recordPayment } from "@/lib/ledger.functions";
import { formatRupees, parseRupees } from "@/lib/money";
import { paymentInput } from "@/lib/schemas";
import { todayInIndia } from "@/lib/validators";

export type PayingStudent = { id: string; name: string };

const methods = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

export function RecordPaymentDialog({
  student,
  onClose,
  onSaved,
}: {
  student: PayingStudent | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  return (
    <ConsoleDialog
      open={student !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={student ? `Record payment · ${student.name}` : "Record payment"}
    >
      {student && <PaymentForm student={student} onClose={onClose} onSaved={onSaved} />}
    </ConsoleDialog>
  );
}

function PaymentForm({
  student,
  onClose,
  onSaved,
}: {
  student: PayingStudent;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const refresh = useRefreshMoney();
  const check = useServerFn(checkPayment);
  const record = useServerFn(recordPayment);

  // One key per opened form: a double click or a retry records the payment once.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("cash");
  const [paidOn, setPaidOn] = useState(todayInIndia());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const paise = parseRupees(amount);
  const typed = paise !== null && paise > 0;
  // One lookup per dancer: what they owe. The excess and the balance left are worked out here as the owner types,
  // so typing never waits on the server (the server still checks it all again when the payment is saved).
  const comparison = useQuery({
    queryKey: ["payment-check", student.id],
    queryFn: () => check({ data: { studentId: student.id, amountPaise: 1 } }),
  });
  const owed = comparison.data?.owed_paise;
  const excess = typed && paise !== null && owed !== undefined ? Math.max(0, paise - owed) : 0;
  const remaining = typed && paise !== null && owed !== undefined ? Math.max(0, owed - paise) : 0;

  // Most payments settle what is owed, so start with that amount selected: Enter records it, typing replaces it.
  const amountInput = useRef<HTMLInputElement>(null);
  const edited = useRef(false);
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (owed === undefined || owed <= 0 || edited.current) return;
    setAmount(String(owed / 100));
    setPrefilled(true);
  }, [owed]);
  // Select after the value is on screen, so typing replaces it.
  useEffect(() => {
    if (prefilled && !edited.current) amountInput.current?.select();
  }, [prefilled]);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof record>[0]["data"]) => record({ data }),
    onSuccess: (_row, variables) => {
      refresh();
      const message = `Recorded ${formatRupees(variables.amountPaise)} from ${student.name}.`;
      toast.success(message);
      onSaved(message);
      onClose();
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const found: FieldErrors = {};
    if (!typed) found["amountPaise"] = "Enter an amount like 1,500";
    if (paidOn > todayInIndia()) found["paidOn"] = "The payment date cannot be in the future";
    const parsed = paymentInput.safeParse({
      studentId: student.id,
      amountPaise: paise ?? 0,
      method,
      paidOn,
      note,
      reference: method === "cash" ? "" : reference,
      acknowledgeExcess: acknowledged,
      idempotencyKey,
    });
    if (!parsed.success) Object.assign(found, { ...fieldErrors(parsed.error), ...found });
    setErrors(found);
    if (found["amountPaise"]) amountInput.current?.focus();
    if (Object.keys(found).length > 0 || !parsed.success) return;
    if (excess > 0 && !acknowledged) return;
    mutation.mutate(parsed.data);
  }

  return (
    <form className="console-form" onSubmit={submit} noValidate>
      <p className="pay-owed">
        Owed now <strong>{owed === undefined ? "…" : formatRupees(owed)}</strong>
        {owed === 0 && <span className="console-hint">Nothing is due. A payment now is kept as credit.</span>}
      </p>
      <Field label="Amount received (₹)" error={errors["amountPaise"]}>
        <input
          className="field"
          inputMode="decimal"
          value={amount}
          ref={amountInput}
          onChange={(event) => {
            edited.current = true;
            setAmount(event.target.value);
            setAcknowledged(false);
          }}
          onFocus={(event) => event.target.select()}
          placeholder="1,500"
          autoFocus
        />
      </Field>
      {typed && comparison.data && (
        <div
          className="pay-result"
          role="status"
          data-tone={excess > 0 ? "warn" : remaining > 0 ? "idle" : "good"}
        >
          {excess > 0 ? (
            <>
              <strong>{formatRupees(excess)} more than owed</strong>
              <label className="console-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                Record the excess as credit
              </label>
            </>
          ) : remaining > 0 ? (
            <strong>{formatRupees(remaining)} still owed after this</strong>
          ) : (
            <strong>Settles it in full ✓</strong>
          )}
        </div>
      )}
      <div className="console-two">
        <Field label="Method">
          <select
            className="field"
            value={method}
            onChange={(event) => setMethod(event.target.value as typeof method)}
          >
            {methods.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Paid on" error={errors["paidOn"]}>
          <input
            className="field"
            type="date"
            value={paidOn}
            max={todayInIndia()}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </Field>
      </div>
      {method !== "cash" && (
        <Field
          label="Reference number (optional)"
          error={errors["reference"]}
          hint="UPI transaction or UTR number, to match your statement."
        >
          <input
            className="field"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
          />
        </Field>
      )}
      <Field label="Note (optional)" error={errors["note"]}>
        <input
          className="field"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
        />
      </Field>
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button
          variant="retro"
          type="submit"
          disabled={mutation.isPending || (excess > 0 && !acknowledged)}
        >
          {typed && paise !== null ? `Record ${formatRupees(paise)}` : "Record payment"}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
