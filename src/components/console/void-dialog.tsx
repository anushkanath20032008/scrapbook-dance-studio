import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useRefreshMoney } from "@/components/console/console-data";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import { voidCharge, voidPayment } from "@/lib/ledger.functions";
import { voidReason } from "@/lib/validators";

export type VoidTarget = { kind: "payment" | "charge"; id: string; label: string };

/** Nothing is ever deleted from the ledger: an entry is voided once, with a reason that stays on record. */
export function VoidDialog({
  target,
  onClose,
  onDone,
}: {
  target: VoidTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <ConsoleDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target ? `Void ${target.kind}` : "Void"}
    >
      {target && <VoidForm target={target} onClose={onClose} onDone={onDone} />}
    </ConsoleDialog>
  );
}

function VoidForm({
  target,
  onClose,
  onDone,
}: {
  target: VoidTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const refresh = useRefreshMoney();
  const voidPaymentFn = useServerFn(voidPayment);
  const voidChargeFn = useServerFn(voidCharge);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: (value: string) =>
      target.kind === "payment"
        ? voidPaymentFn({ data: { id: target.id, reason: value } })
        : voidChargeFn({ data: { id: target.id, reason: value } }),
    onSuccess: () => {
      refresh();
      onDone(`Voided ${target.label}.`);
      onClose();
    },
    onError: (e) => setFormError(messageOf(e)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const parsed = voidReason.safeParse(reason);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Give a reason");
      return;
    }
    setError("");
    mutation.mutate(parsed.data);
  }

  return (
    <form className="console-form" onSubmit={submit} noValidate>
      <p>
        Void <strong>{target.label}</strong>? It stays on record, marked as voided, and the balance
        is worked out without it. This can&apos;t be undone.
      </p>
      <Field label="Reason" error={error}>
        <input
          className="field"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Entered by mistake"
          autoFocus
        />
      </Field>
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button variant="retro" type="submit" disabled={mutation.isPending}>
          Void {target.kind}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Keep it
        </Button>
      </div>
    </form>
  );
}
