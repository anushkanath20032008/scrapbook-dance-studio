import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog, type PayingStudent } from "@/components/console/record-payment";
import { VoidDialog, type VoidTarget } from "@/components/console/void-dialog";
import { getStudentCharges, getStudentLedger } from "@/lib/ledger.functions";
import { formatDayWithYear, formatMonthLong, paymentMethodLabel } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { listStudentOverview } from "@/lib/setup.functions";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Billing | ChoreoStudio" }] }),
  validateSearch: (search: Record<string, unknown>): { student?: string } =>
    typeof search["student"] === "string" ? { student: search["student"] } : {},
  component: Billing,
});

function Billing() {
  const listStudents = useServerFn(listStudentOverview);
  const loadCharges = useServerFn(getStudentCharges);
  const loadLedger = useServerFn(getStudentLedger);

  const initial = Route.useSearch();
  const [studentId, setStudentId] = useState(initial.student ?? "");
  const [paying, setPaying] = useState<PayingStudent | null>(null);
  const [voiding, setVoiding] = useState<VoidTarget | null>(null);

  const students = useQuery({
    queryKey: ["students-overview", false],
    queryFn: () => listStudents({ data: {} }),
  });
  const charges = useQuery({
    queryKey: ["student-charges", studentId],
    queryFn: () => loadCharges({ data: { studentId } }),
    enabled: studentId !== "",
  });
  const ledger = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: () => loadLedger({ data: { studentId } }),
    enabled: studentId !== "",
  });

  const student = students.data?.find((row) => row.id === studentId);
  const balance = ledger.data?.balance_paise;

  return (
    <section>
      <h1 className="display console-title">Billing</h1>
      <div className="console-toolbar">
        <label className="console-inline-label">
          Dancer
          <select
            className="field month-field"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          >
            <option value="">Choose a dancer</option>
            {students.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {students.isPending && <p className="console-empty">Loading your dancers…</p>}
      {students.isError && <p role="alert">Could not load your dancers. Please refresh.</p>}
      {!studentId && (
        <p className="console-empty">
          {students.data?.length === 0
            ? "No dancers yet. Add one on the Dancers page first."
            : "Choose a dancer to see their charges and payments."}
        </p>
      )}

      {studentId && student && (
        <>
          <div className="totals">
            <div
              className="totals-headline"
              data-tone={balance === undefined ? "idle" : balance > 0 ? "warn" : "good"}
            >
              <span className="totals-label">
                {balance !== undefined && balance < 0 ? "Credit" : "Owes"}
              </span>
              <strong>{balance === undefined ? "…" : formatRupees(Math.abs(balance))}</strong>
              <span className="console-hint">{student.name}</span>
            </div>
            <div className="console-actions">
              <Button
                variant="retro"
                type="button"
                onClick={() => setPaying({ id: student.id, name: student.name })}
              >
                Record payment
              </Button>
            </div>
          </div>

          <div className="console-list-head">
            <h2>Charges</h2>
          </div>
          {charges.isPending && <p className="console-hint">Loading…</p>}
          {charges.data?.length === 0 && (
            <p className="console-empty">
              No charges yet. Generate this month&apos;s charges from Overview.
            </p>
          )}
          <ul className="console-list">
            {charges.data?.map((charge) => (
              <li
                key={charge.charge_id}
                className="console-row"
                data-archived={charge.status === "voided"}
              >
                <div>
                  <strong>{formatMonthLong(charge.period)}</strong>
                  <span className="console-hint">
                    {formatRupees(charge.amount_paise)} · due {formatDayWithYear(charge.due_on)}
                    {charge.status === "voided"
                      ? ` · voided: ${charge.void_reason ?? ""}`
                      : charge.settled_on
                        ? ` · settled ${formatDayWithYear(charge.settled_on)} by ${paymentMethodLabel(charge.settled_method ?? "other")}`
                        : charge.allocated_paise > 0
                          ? ` · ${formatRupees(charge.allocated_paise)} paid, ${formatRupees(charge.outstanding_paise)} left`
                          : ""}
                  </span>
                </div>
                <div className="console-row-actions">
                  <span
                    className="status-pill"
                    data-tone={
                      charge.status === "paid"
                        ? "good"
                        : charge.status === "overdue"
                          ? "warn"
                          : "idle"
                    }
                  >
                    {charge.status}
                  </span>
                  {charge.status !== "voided" && (
                    <Button
                      variant="retroPaper"
                      type="button"
                      onClick={() =>
                        setVoiding({
                          kind: "charge",
                          id: charge.charge_id,
                          label: `the ${formatMonthLong(charge.period)} charge`,
                        })
                      }
                    >
                      Void
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="console-list-head">
            <h2>Payments</h2>
          </div>
          {ledger.data?.payments.length === 0 && <p className="console-empty">No payments yet.</p>}
          <ul className="console-list">
            {ledger.data?.payments.map((payment) => (
              <li
                key={payment.id}
                className="console-row"
                data-archived={payment.voided_at !== null}
              >
                <div>
                  <strong>{formatRupees(payment.amount_paise)}</strong>
                  <span className="console-hint">
                    {formatDayWithYear(payment.paid_on)} · {paymentMethodLabel(payment.method)}
                    {payment.reference ? ` · ref ${payment.reference}` : ""}
                    {payment.note ? ` · ${payment.note}` : ""}
                    {payment.voided_at ? ` · voided: ${payment.void_reason ?? ""}` : ""}
                  </span>
                </div>
                {!payment.voided_at && (
                  <div className="console-row-actions">
                    <Button
                      variant="retroPaper"
                      type="button"
                      onClick={() =>
                        setVoiding({
                          kind: "payment",
                          id: payment.id,
                          label: `the ${formatRupees(payment.amount_paise)} payment`,
                        })
                      }
                    >
                      Void
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <RecordPaymentDialog student={paying} onClose={() => setPaying(null)} onSaved={() => {}} />
      <VoidDialog
        target={voiding}
        onClose={() => setVoiding(null)}
        onDone={(message) => toast.success(message)}
      />
    </section>
  );
}
