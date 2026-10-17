import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { useRefreshMoney } from "@/components/console/console-data";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { messageOf } from "@/components/console/form-utils";
import {
  confirmClaim,
  getClaimScreenshotUrl,
  listClaimQueue,
  rejectClaim,
} from "@/lib/claims.functions";
import { formatRupees, parseRupees } from "@/lib/money";

export const Route = createFileRoute("/app/verify")({
  head: () => ({ meta: [{ title: "To verify | Choreo Studio" }] }),
  component: Verify,
});

type Claim = Awaited<ReturnType<typeof listClaimQueue>>[number];
type Mode = "confirm" | "adjust" | "reject";

const methodLabel: Record<string, string> = {
  cash: "cash",
  upi: "UPI",
  bank: "bank transfer",
  other: "other",
};
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Verify() {
  const queryClient = useQueryClient();
  const loadQueue = useServerFn(listClaimQueue);
  const screenshotFn = useServerFn(getClaimScreenshotUrl);
  const [deciding, setDeciding] = useState<{ claim: Claim; mode: Mode } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const queue = useQuery({ queryKey: ["claim-queue"], queryFn: () => loadQueue() });

  const screenshot = useMutation({
    mutationFn: (claimId: string) => screenshotFn({ data: { claimId } }),
    onSuccess: ({ url }) => {
      setError("");
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => setError(messageOf(e)),
  });

  const rows = queue.data ?? [];

  return (
    <section>
      <h1 className="display console-title">To verify</h1>
      <p className="console-hint verify-intro">
        A dancer says they paid. Nothing changes until you confirm it. Check the reference number
        against your own bank or UPI statement.
      </p>
      {notice && (
        <p role="status" className="console-notice">
          ✓ {notice}
        </p>
      )}
      <FormAlert message={error} />
      {queue.isError && <p role="alert">Could not load the claims. Please refresh.</p>}
      {queue.data && rows.length === 0 && (
        <p className="console-empty">Nothing is waiting to be checked.</p>
      )}
      <ul className="console-list">
        {rows.map((claim) => (
          <li key={claim.claim_id} className="claim-card">
            <div className="claim-head">
              <div>
                <strong>{claim.student_name}</strong>
                <span className="console-hint">
                  {dayLabel(claim.paid_on)} · {methodLabel[claim.method] ?? claim.method}
                  {claim.reference ? ` · ref ${claim.reference}` : ""}
                </span>
              </div>
              {claim.possible_duplicate && (
                <span className="status-pill" data-tone="warn">
                  Possible duplicate reference
                </span>
              )}
            </div>
            <dl className="claim-numbers">
              <div>
                <dt>Claimed</dt>
                <dd>{formatRupees(claim.amount_paise)}</dd>
              </div>
              <div>
                <dt>Owed</dt>
                <dd>{formatRupees(claim.owed_paise)}</dd>
              </div>
              <div>
                <dt>{claim.excess_paise > 0 ? "Excess" : "Left after"}</dt>
                <dd>
                  {formatRupees(
                    claim.excess_paise > 0 ? claim.excess_paise : claim.remaining_paise,
                  )}
                </dd>
              </div>
            </dl>
            <div className="console-actions">
              <Button
                variant="retro"
                type="button"
                onClick={() => setDeciding({ claim, mode: "confirm" })}
              >
                Confirm
              </Button>
              <Button
                variant="retroPaper"
                type="button"
                onClick={() => setDeciding({ claim, mode: "adjust" })}
              >
                Adjust amount
              </Button>
              <Button
                variant="retroPaper"
                type="button"
                onClick={() => setDeciding({ claim, mode: "reject" })}
              >
                Reject
              </Button>
              {claim.has_screenshot && (
                <Button
                  variant="retroPaper"
                  type="button"
                  disabled={screenshot.isPending}
                  onClick={() => screenshot.mutate(claim.claim_id)}
                >
                  View screenshot
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConsoleDialog
        open={deciding !== null}
        onOpenChange={(open) => {
          if (!open) setDeciding(null);
        }}
        title={
          deciding
            ? `${deciding.mode === "reject" ? "Reject" : deciding.mode === "adjust" ? "Adjust and confirm" : "Confirm"} · ${deciding.claim.student_name}`
            : "Decide"
        }
      >
        {deciding && (
          <Decision
            key={`${deciding.claim.claim_id}-${deciding.mode}`}
            claim={deciding.claim}
            mode={deciding.mode}
            onClose={() => setDeciding(null)}
            onDone={(message) => {
              setError("");
              setNotice(message);
              void queryClient.invalidateQueries({ queryKey: ["claim-queue"] });
            }}
          />
        )}
      </ConsoleDialog>
    </section>
  );
}

function Decision({
  claim,
  mode,
  onClose,
  onDone,
}: {
  claim: Claim;
  mode: Mode;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const refresh = useRefreshMoney();
  const confirmFn = useServerFn(confirmClaim);
  const rejectFn = useServerFn(rejectClaim);
  const [amount, setAmount] = useState(String(claim.amount_paise / 100));
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");

  const chosen = mode === "adjust" ? parseRupees(amount) : claim.amount_paise;
  const excess = chosen === null ? 0 : Math.max(0, chosen - claim.owed_paise);
  const remaining = chosen === null ? 0 : Math.max(0, claim.owed_paise - chosen);

  const confirm = useMutation({
    mutationFn: () =>
      confirmFn({
        data: {
          claimId: claim.claim_id,
          ...(mode === "adjust" && chosen ? { amountPaise: chosen } : {}),
          acknowledgeExcess: acknowledged,
        },
      }),
    onSuccess: () => {
      refresh();
      onDone(`Confirmed ${formatRupees(chosen ?? claim.amount_paise)} for ${claim.student_name}.`);
      onClose();
    },
    onError: (e) => setFormError(messageOf(e)),
  });
  const reject = useMutation({
    mutationFn: () => rejectFn({ data: { claimId: claim.claim_id, reason } }),
    onSuccess: () => {
      onDone(`Rejected the claim from ${claim.student_name}.`);
      onClose();
    },
    onError: (e) => setFormError(messageOf(e)),
  });

  function submit() {
    setFormError("");
    if (mode === "reject") {
      if (reason.trim() === "") return setFieldError("Give a reason");
      setFieldError("");
      return reject.mutate();
    }
    if (chosen === null || chosen <= 0) return setFieldError("Enter an amount like 1,500");
    setFieldError("");
    if (excess > 0 && !acknowledged) return;
    confirm.mutate();
  }

  return (
    <div className="console-form">
      <dl className="claim-numbers">
        <div>
          <dt>Claimed</dt>
          <dd>{formatRupees(claim.amount_paise)}</dd>
        </div>
        <div>
          <dt>Owed</dt>
          <dd>{formatRupees(claim.owed_paise)}</dd>
        </div>
      </dl>
      {claim.possible_duplicate && (
        <p className="console-warning" role="alert">
          This reference number is already on another payment or claim. Check your statement before
          confirming.
        </p>
      )}
      {mode === "adjust" && (
        <Field label="Amount to confirm (₹)" error={fieldError}>
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setAcknowledged(false);
            }}
            autoFocus
          />
        </Field>
      )}
      {mode !== "reject" && chosen !== null && chosen > 0 && (
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
      {mode === "reject" && (
        <Field label="Reason (the dancer sees this)" error={fieldError}>
          <input
            className="field"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="I can't find this on my statement"
            autoFocus
          />
        </Field>
      )}
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button
          variant="retro"
          type="button"
          disabled={
            confirm.isPending ||
            reject.isPending ||
            (mode !== "reject" && excess > 0 && !acknowledged)
          }
          onClick={submit}
        >
          {mode === "reject" ? "Reject claim" : "Confirm payment"}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
