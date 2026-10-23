import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/console/form-helpers";
import { fieldErrors, messageOf, type FieldErrors } from "@/components/console/form-utils";
import { supabase } from "@/integrations/supabase/client";
import { formatRupees, parseRupees } from "@/lib/money";
import { MAX_SCREENSHOT_BYTES, SCREENSHOT_BUCKET, screenshotMimeTypes } from "@/lib/schemas";
import { todayInIndia } from "@/lib/validators";

const methods = [
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

/** What the form collects. Each door adds its own identifying part (a link token or a studio) when parsing. */
export type ClaimFields = {
  studentId: string;
  amountPaise: number;
  method: (typeof methods)[number]["value"];
  paidOn: string;
  reference: string;
  screenshotType?: string;
};

type Parsed<T> = { success: true; data: T } | { success: false; error: ZodError };

/**
 * The "I've paid" form, shared by the private family link and the signed-in member area. `parse` validates the
 * fields with the door's own schema; `send` submits what it produced and returns the signed upload for the
 * optional screenshot. A claim is only a claim: the studio confirms it before any balance changes.
 */
export function ClaimForm<T>({
  students,
  owed,
  parse,
  send,
  onSent,
  onDone,
  onCancel,
}: {
  students: { id: string; name: string }[];
  /** What each dancer owes, in paise, by dancer id. The amount starts at this, so most dancers only tap Send. */
  owed?: Record<string, number>;
  parse: (fields: ClaimFields) => Parsed<T>;
  send: (data: T) => Promise<{ upload: { path: string; token: string } | null }>;
  onSent?: () => void;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const owedFor = (id: string) => {
    const paise = owed?.[id] ?? 0;
    return paise > 0 ? String(paise / 100) : "";
  };
  const [amount, setAmount] = useState(() => owedFor(students[0]?.id ?? ""));
  const [amountEdited, setAmountEdited] = useState(false);
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("upi");
  const [paidOn, setPaidOn] = useState(todayInIndia());
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: T) => {
      const result = await send(data);
      let uploadFailed = false;
      if (file && result.upload) {
        const { error } = await supabase.storage
          .from(SCREENSHOT_BUCKET)
          .uploadToSignedUrl(result.upload.path, result.upload.token, file, {
            contentType: file.type,
          });
        uploadFailed = Boolean(error);
      } else if (file) uploadFailed = true;
      return { uploadFailed };
    },
    onSuccess: ({ uploadFailed }) => {
      onSent?.();
      onDone(
        uploadFailed
          ? "Sent to your studio, but the screenshot didn't upload. They can still check your reference number."
          : "Sent to your studio. They will check it against their records.",
      );
    },
    onError: (error) => setFormError(messageOf(error)),
  });

  function pickFile(next: File | null) {
    setErrors((current) => ({ ...current, file: "" }));
    if (!next) return setFile(null);
    if (!(screenshotMimeTypes as readonly string[]).includes(next.type)) {
      setFile(null);
      return setErrors((current) => ({ ...current, file: "Use a PNG, JPEG or WebP image" }));
    }
    if (next.size > MAX_SCREENSHOT_BYTES) {
      setFile(null);
      return setErrors((current) => ({ ...current, file: "The image must be under 5 MB" }));
    }
    setFile(next);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const rupees = parseRupees(amount);
    const found: FieldErrors = {};
    if (rupees === null || rupees <= 0) found["amountPaise"] = "Enter an amount like 1,500";
    if (paidOn > todayInIndia()) found["paidOn"] = "The date cannot be in the future";
    const parsed = parse({
      studentId,
      amountPaise: rupees ?? 0,
      method,
      paidOn,
      reference,
      ...(file ? { screenshotType: file.type } : {}),
    });
    if (!parsed.success) Object.assign(found, { ...fieldErrors(parsed.error), ...found });
    if (errors["file"]) found["file"] = errors["file"];
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsed.success) return;
    mutation.mutate(parsed.data);
  }

  const rupees = parseRupees(amount);
  const owedNow = owed?.[studentId] ?? 0;
  const needsReference = method === "upi" || method === "bank";

  return (
    <form className="console-form claim-form" onSubmit={onSubmit} noValidate>
      {students.length > 1 && (
        <Field label="Who is this for?">
          <select
            className="field"
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              if (!amountEdited) setAmount(owedFor(event.target.value));
            }}
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field
        label="Amount you paid (₹)"
        error={errors["amountPaise"]}
        hint={
          owedNow > 0
            ? `You owe ${formatRupees(owedNow)}. Change it if you paid a different amount.`
            : undefined
        }
      >
        <input
          className="field claim-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setAmountEdited(true);
          }}
          placeholder="1,500"
        />
      </Field>
      <div className="field-group">
        <span className="form-label">How did you pay?</span>
        <div className="claim-methods" role="radiogroup" aria-label="How did you pay?">
          {methods.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={method === item.value}
              data-on={method === item.value}
              onClick={() => setMethod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {needsReference && (
        <Field
          label={method === "upi" ? "UPI transaction ID" : "Bank reference (UTR)"}
          error={errors["reference"]}
          hint="Your studio uses this to find the payment. In your UPI or bank app, open the payment and copy the transaction ID."
        >
          <input
            className="field"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
          />
        </Field>
      )}
      <details className="claim-more" open={Boolean(errors["paidOn"] || errors["file"])}>
        <summary>Paid on another day, or add a screenshot (optional)</summary>
        <Field label="Paid on" error={errors["paidOn"]}>
          <input
            className="field"
            type="date"
            value={paidOn}
            max={todayInIndia()}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </Field>
        <Field label="Screenshot" error={errors["file"]}>
          <input
            className="field"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <p className="console-hint privacy-note">
          A screenshot can show your name, UPI ID and phone number. Your studio uses it only to
          check this payment, and it is deleted once they decide. You can leave it out.
        </p>
      </details>
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button variant="retro" type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Sending…"
            : rupees !== null && rupees > 0
              ? `Send: I paid ${formatRupees(rupees)}`
              : "Send to my studio"}
        </Button>
        <Button variant="retroPaper" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
