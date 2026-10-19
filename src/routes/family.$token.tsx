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

export const Route = createFileRoute("/family/$token")({
  head: () => ({
    meta: [
      { title: "Your classes and fees | Choreo Studio" },
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

        <p className="console-hint">This is a private link from your studio. Don't share it.</p>

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
            students={students.map((s) => ({ id: s.id, name: s.name }))}
            parse={(fields) => claimInput.safeParse({ token, ...fields })}
            send={(data) => submit({ data })}
            onSent={() => void queryClient.invalidateQueries({ queryKey: ["my-claims", token] })}
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
