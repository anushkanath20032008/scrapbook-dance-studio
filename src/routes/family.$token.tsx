import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClaimForm } from "@/components/claim-form";
import { ConsoleDialog } from "@/components/console/console-dialog";
import { messageOf, weekdayNames } from "@/components/console/form-utils";
import { listMyClaims, submitClaim } from "@/lib/claims.functions";
import { getFamilyView } from "@/lib/family.functions";
import { formatDayWithYear } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { claimInput } from "@/lib/schemas";

const methodLabels: Record<string, string> = {
  upi: "UPI",
  bank: "Bank transfer",
  cash: "Cash",
  other: "Other",
};
const methodLabel = (method: string) => methodLabels[method] ?? method;

export const Route = createFileRoute("/family/$token")({
  head: () => ({
    meta: [
      { title: "Your classes and fees | ChoreoStudio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FamilyPage,
});

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");

function FamilyPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getFamilyView);
  const loadClaims = useServerFn(listMyClaims);
  const submit = useServerFn(submitClaim);
  const queryClient = useQueryClient();
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
          <p role="status">Opening your page…</p>
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
          <p>Message your studio and ask for a fresh link. Nothing is wrong with your phone.</p>
        </div>
      </main>
    );

  const data = view.data;
  const students = data.students;
  const owed = Object.fromEntries(students.map((s) => [s.id, s.balance_paise]));
  const pendingTotal = (claims.data ?? [])
    .filter((claim) => claim.status === "pending")
    .reduce((sum, claim) => sum + claim.amount_paise, 0);
  // The oldest fee not yet paid, so the dancer sees what the amount is for.
  const unpaid = students
    .flatMap((student) => student.charges)
    .filter((charge) => charge.status !== "paid")
    .sort((x, y) => x.due_on.localeCompare(y.due_on))[0];
  const dueLine = unpaid ? `Due ${formatDayWithYear(unpaid.due_on)}.` : "";

  return (
    <main className="section login-page">
      <div className="wrap login-wrap">
        <p className="console-hint">{data.studio_name || "Your studio"}</p>
        <h1 className="display login-title">
          Hello{data.guardian_name ? `, ${data.guardian_name}` : ""}.
        </h1>

        <div className="family-owe" data-tone={data.balance_paise > 0 ? "warn" : "good"}>
          <span className="totals-label">
            {data.balance_paise > 0
              ? "You owe"
              : data.balance_paise < 0
                ? "Credit with your studio"
                : "You are all paid up"}
          </span>
          {data.balance_paise !== 0 && (
            <strong>{formatRupees(Math.abs(data.balance_paise))}</strong>
          )}
          {data.balance_paise > 0 && (
            <span className="console-hint">
              Pay your studio the way you usually do, then tell them here.
              {dueLine ? ` ${dueLine}` : ""}
            </span>
          )}
          {pendingTotal > 0 && (
            <span className="family-pending" role="status">
              You told your studio about {formatRupees(pendingTotal)}. They have not confirmed it
              yet.
            </span>
          )}
        </div>
        <Button
          variant="retro"
          type="button"
          className="family-pay"
          onClick={() => setOpen(true)}
          disabled={students.length === 0}
        >
          {data.balance_paise > 0
            ? `I’ve paid ${formatRupees(data.balance_paise)}`
            : "I’ve paid something"}
        </Button>
        {notice && (
          <p role="status" className="family-success">
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
                        {formatDayWithYear(payment.paid_on)} · {methodLabel(payment.method)}
                      </span>
                    </p>
                  ))}
                </>
              )}
            </div>
          </section>
        ))}

        <p className="console-hint">
          This is your own private link from your studio. Keep it to yourself.
        </p>

        {claims.data && claims.data.length > 0 && (
          <>
            <h2 className="console-subhead">Payments you reported</h2>
            <ul className="console-list">
              {claims.data.map((claim) => (
                <li key={claim.id} className="console-row">
                  <div>
                    <strong>{formatRupees(claim.amount_paise)}</strong>
                    <span className="console-hint">
                      {formatDayWithYear(claim.paid_on)} · {methodLabel(claim.method)}
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
                    {claim.status === "pending"
                      ? "Waiting for the studio"
                      : claim.status === "confirmed"
                        ? "Confirmed"
                        : "Not accepted"}
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
            students={students.map((s) => ({ id: s.id, name: s.name }))}
            owed={owed}
            parse={(fields) => claimInput.safeParse({ token, ...fields })}
            send={(data) => submit({ data })}
            onSent={() => void queryClient.invalidateQueries({ queryKey: ["my-claims", token] })}
            onDone={(message) => {
              setOpen(false);
              setNotice(message);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </ConsoleDialog>
    </main>
  );
}
