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
import { getConsoleContext } from "@/lib/console.functions";
import { getReminderLinks } from "@/lib/family.functions";
import { whatsappLink } from "@/lib/manual-reminders";

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

  const loadContext = useServerFn(getConsoleContext);
  const context = useQuery({ queryKey: ["console-context"], queryFn: () => loadContext() });
  const fetchLinks = useServerFn(getReminderLinks);
  // The oldest fee still unpaid sets the date in the reminder; the amount is everything this dancer owes.
  const oldestOpen = (charges.data ?? [])
    .filter((charge) => charge.status !== "voided" && !charge.settled_on && charge.outstanding_paise > 0)
    .sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
  const reminder =
    student && oldestOpen && balance !== undefined && balance > 0
      ? {
          charge_id: oldestOpen.charge_id,
          student_name: student.name,
          phone: student.guardian?.phone ?? null,
          outstanding_paise: balance,
          due_on: oldestOpen.due_on,
        }
      : null;
  const studioName = context.data?.studioName ?? "";
  async function remindOnWhatsApp() {
    if (!reminder || !student) return;
    const plain = whatsappLink(reminder, studioName);
    if (!plain) return;
    // Open the chat at once so the browser allows it, then point it at the message with the dancer's private link.
    const tab = window.open("about:blank", "_blank");
    let target = plain;
    try {
      const links = await fetchLinks({ data: { studentIds: [student.id] } });
      target = whatsappLink(reminder, studioName, links[student.id] ?? null) ?? plain;
    } catch {
      // Without the link the plain reminder still opens.
    }
    if (tab) tab.location.href = target;
    else window.location.href = target;
  }

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
            : "Choose a dancer to see their fees and payments."}
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
              {reminder && (
                <Button
                  variant="retroPaper"
                  type="button"
                  disabled={!whatsappLink(reminder, studioName)}
                  title={whatsappLink(reminder, studioName) ? undefined : "Add a phone number for this dancer first"}
                  onClick={() => void remindOnWhatsApp()}
                >
                  Remind on WhatsApp
                </Button>
              )}
            </div>
            {reminder && !whatsappLink(reminder, studioName) && (
              <p className="console-hint">Add a phone number for {student.name} on the Dancers page to send a reminder.</p>
            )}
          </div>

          <div className="console-list-head">
            <h2>Fees</h2>
          </div>
          {charges.isPending && <p className="console-hint">Loading…</p>}
          {charges.data?.length === 0 && (
            <p className="console-empty">
              No fees yet. Add this month&apos;s fees from Overview.
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
                          label: `the ${formatMonthLong(charge.period)} fee`,
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
