import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { Field, FormAlert } from "@/components/console/form-helpers";
import {
  fieldErrors,
  messageOf,
  weekdayNames,
  type FieldErrors,
} from "@/components/console/form-utils";
import { supabase } from "@/integrations/supabase/client";
import { listMyClaims, submitClaim } from "@/lib/claims.functions";
import { getFamilyView } from "@/lib/family.functions";
import { formatDayWithYear } from "@/lib/format";
import { formatRupees, parseRupees } from "@/lib/money";
import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_BUCKET,
  claimInput,
  screenshotMimeTypes,
} from "@/lib/schemas";
import { todayInIndia } from "@/lib/validators";

export const Route = createFileRoute("/family/$token")({
  head: () => ({
    meta: [
      { title: "Your classes and fees | Choreo Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FamilyPage,
});

const methods = [
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

function FamilyPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getFamilyView);
  const loadClaims = useServerFn(listMyClaims);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const view = useQuery({
    queryKey: ["family-view", token],
    queryFn: () => load({ data: { token } }),
    retry: false,
  });
  const claims = useQuery({
    queryKey: ["my-claims", token],
    queryFn: () => loadClaims({ data: { token } }),
    retry: false,
    enabled: view.isSuccess,
  });

  if (view.isPending)
    return (
      <main className="section login-page">
        <div className="wrap login-wrap">
          <p>Loading…</p>
        </div>
      </main>
    );
  if (view.isError)
    return (
      <main className="section login-page">
        <div className="wrap login-wrap">
          <h1 className="display login-title">Link not valid.</h1>
          <p className="login-error" role="alert">
            {messageOf(view.error)}
          </p>
        </div>
      </main>
    );

  const data = view.data;
  const students = data.students;

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <p className="console-hint">{data.studio_name ?? "Your studio"}</p>
        <h1 className="display login-title">
          Hello{data.guardian_name ? `, ${data.guardian_name}` : ""}.
        </h1>

        <div className="totals">
          <div className="totals-headline" data-tone={data.balance_paise > 0 ? "warn" : "good"}>
            <span className="totals-label">{data.balance_paise < 0 ? "Credit" : "You owe"}</span>
            <strong>{formatRupees(Math.abs(data.balance_paise))}</strong>
          </div>
          <div className="console-actions">
            <Button
              variant="retro"
              type="button"
              onClick={() => setOpen(true)}
              disabled={students.length === 0}
            >
              I&apos;ve paid
            </Button>
          </div>
        </div>
        {notice && (
          <p role="status" className="console-notice">
            ✓ {notice}
          </p>
        )}

        {students.map((student) => (
          <section key={student.id} className="window family-card">
            <div className="window-bar chrome-font">{student.name}</div>
            <div className="window-inner">
              {student.batches.length === 0 && <p className="console-hint">Not on a batch yet.</p>}
              {student.batches.map((batch) => (
                <p key={batch.name} className="family-line">
                  <strong>{batch.name}</strong>
                  <span className="console-hint">
                    {batch.weekdays.map((day) => weekdayNames[day]).join(", ")}
                    {batch.starts_at ? ` · ${clock(batch.starts_at)}` : ""}
                    {batch.room ? ` · ${batch.room}` : ""}
                  </span>
                </p>
              ))}
              {student.payments.length > 0 && (
                <>
                  <h3 className="console-subhead">Payments</h3>
                  {student.payments.slice(0, 5).map((payment, index) => (
                    <p key={index} className="family-line">
                      <strong>{formatRupees(payment.amount_paise)}</strong>
                      <span className="console-hint">
                        {formatDayWithYear(payment.paid_on)} · {payment.method}
                      </span>
                    </p>
                  ))}
                </>
              )}
            </div>
          </section>
        ))}

        {claims.data && claims.data.length > 0 && (
          <>
            <h2 className="console-subhead">Payments you reported</h2>
            <ul className="console-list">
              {claims.data.map((claim) => (
                <li key={claim.id} className="console-row">
                  <div>
                    <strong>{formatRupees(claim.amount_paise)}</strong>
                    <span className="console-hint">
                      {formatDayWithYear(claim.paid_on)} · {claim.method}
                      {claim.status === "rejected" && claim.decision_reason
                        ? ` · ${claim.decision_reason}`
                        : ""}
                    </span>
                  </div>
                  <span
                    className="status-pill"
                    data-tone={
                      claim.status === "confirmed"
                        ? "good"
                        : claim.status === "rejected"
                          ? "warn"
                          : "idle"
                    }
                  >
                    {claim.status === "pending" ? "waiting for the studio" : claim.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConsoleDialog open={open} onOpenChange={setOpen} title="I've paid">
        {open && (
          <ClaimForm
            token={token}
            students={students.map((s) => ({ id: s.id, name: s.name }))}
            onDone={(message) => {
              setOpen(false);
              setNotice(message);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </ConsoleDialog>
    </main>
  );
}

function ClaimForm({
  token,
  students,
  onDone,
  onCancel,
}: {
  token: string;
  students: { id: string; name: string }[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const submit = useServerFn(submitClaim);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]["value"]>("upi");
  const [paidOn, setPaidOn] = useState(todayInIndia());
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: Parameters<typeof submit>[0]["data"]) => {
      const result = await submit({ data });
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
      void queryClient.invalidateQueries({ queryKey: ["my-claims", token] });
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
    const parsed = claimInput.safeParse({
      token,
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

  return (
    <form className="console-form" onSubmit={onSubmit} noValidate>
      {students.length > 1 && (
        <Field label="Who is this for?">
          <select
            className="field"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Amount you paid (₹)" error={errors["amountPaise"]}>
        <input
          className="field"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="1,500"
        />
      </Field>
      <div className="console-two">
        <Field label="How did you pay?">
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
      {(method === "upi" || method === "bank") && (
        <Field
          label="Reference number"
          error={errors["reference"]}
          hint="The UPI transaction or UTR number."
        >
          <input
            className="field"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
          />
        </Field>
      )}
      <Field label="Screenshot (optional)" error={errors["file"]}>
        <input
          className="field"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <p className="console-hint privacy-note">
        A screenshot can show your name, UPI ID and phone number. Your studio uses it only to check
        this payment, and it is deleted once they decide. You can leave it out.
      </p>
      <FormAlert message={formError} />
      <div className="console-actions">
        <Button variant="retro" type="submit" disabled={mutation.isPending}>
          Send to my studio
        </Button>
        <Button variant="retroPaper" type="button" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
