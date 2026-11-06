import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStudentAttendance } from "@/lib/attendance.functions";
import { confirmClaim, listClaimQueue, rejectClaim } from "@/lib/claims.functions";
import { Button } from "@/components/ui/button";
import { formatDayWithYear, formatMonthLong, maskPhone, paymentMethodLabel } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import { getStudentLedger } from "@/lib/ledger.functions";
import { listStudentOverview } from "@/lib/setup.functions";
import { toneOf } from "@/lib/tone";
import type { BoardRow } from "@/components/console/dancer-board";

const dayBefore = (today: string, days: number) => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/**
 * A dancer's whole card, opened from their name, like a contact record: who they are, how to reach them, what
 * they owe and have paid, and how often they come. It slides in from the right so the list keeps its place.
 */
export function DancerPeek({
  row,
  today,
  reminded,
  sample,
  onClose,
  onRecord,
  onWhatsApp,
}: {
  row: BoardRow;
  today: string;
  reminded: boolean;
  sample: boolean;
  onClose: () => void;
  onRecord: () => void;
  onWhatsApp: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showPhone, setShowPhone] = useState(false);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const listStudents = useServerFn(listStudentOverview);
  const loadLedger = useServerFn(getStudentLedger);
  const loadAttendance = useServerFn(getStudentAttendance);
  const loadClaims = useServerFn(listClaimQueue);
  const confirmFn = useServerFn(confirmClaim);
  const rejectFn = useServerFn(rejectClaim);
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["students-overview", false],
    queryFn: () => listStudents({ data: {} }),
    enabled: !sample,
  });
  const ledger = useQuery({
    queryKey: ["student-payments", row.studentId],
    queryFn: () => loadLedger({ data: { studentId: row.studentId } }),
    enabled: !sample,
  });
  const attendance = useQuery({
    queryKey: ["student-attendance", row.studentId, today],
    queryFn: () =>
      loadAttendance({ data: { studentId: row.studentId, from: dayBefore(today, 90), to: today } }),
    enabled: !sample,
  });

  // Payments this dancer says they have made, waiting to be checked. They belong on the dancer, not a page of
  // their own, so the owner confirms them while looking at the rest of that dancer's month.
  const claimQueue = useQuery({
    queryKey: ["claim-queue"],
    queryFn: () => loadClaims(),
    enabled: !sample,
  });
  const claims = (claimQueue.data ?? []).filter((claim) => claim.student_id === row.studentId);
  const afterClaim = () => {
    void queryClient.invalidateQueries({ queryKey: ["claim-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["studio-table"] });
    void queryClient.invalidateQueries({ queryKey: ["home-report"] });
    void queryClient.invalidateQueries({ queryKey: ["student-payments", row.studentId] });
  };
  const accept = useMutation({
    mutationFn: (claimId: string) => confirmFn({ data: { claimId, acknowledgeExcess: true } }),
    onSuccess: afterClaim,
  });
  const decline = useMutation({
    mutationFn: (claimId: string) =>
      rejectFn({ data: { claimId, reason: "Could not find this payment" } }),
    onSuccess: afterClaim,
  });

  const person = overview.data?.find((student) => student.id === row.studentId);
  const guardian = person?.guardian ?? null;
  const owed = row.outstandingPaise > 0;
  const classes = row.todayBatches.length;
  const here = classes > 0 && row.todayBatches.every((batch) => batch.present === true);

  const payments = useMemo(
    () => (ledger.data?.payments ?? []).filter((payment) => payment.voided_at === null).slice(0, 5),
    [ledger.data],
  );
  const charges = useMemo(
    () => (ledger.data?.charges ?? []).filter((charge) => charge.voided_at === null).slice(0, 4),
    [ledger.data],
  );
  const sessions = attendance.data ?? [];
  const came = sessions.filter((session) => session.present).length;
  const recent = [...sessions]
    .sort((a, b) => b.session_on.localeCompare(a.session_on))
    .slice(0, 14);
  const phone = guardian?.phone ?? null;

  return (
    <aside className="peek" role="dialog" aria-label={`${row.name}, profile`}>
      <div className="peek-head">
        <div className="peek-title">
          <h2>{row.name}</h2>
          <span className="peek-sub">
            {owed ? (
              <span className="chip" data-tone={row.status === "overdue" ? "overdue" : "due"}>
                {row.status === "overdue" ? "Overdue" : "Due"} {formatRupees(row.outstandingPaise)}
              </span>
            ) : row.status === "paid" ? (
              <span className="chip" data-tone="paid">
                Paid this month
              </span>
            ) : (
              <span className="chip" data-tone="none">
                No fee set
              </span>
            )}
            {guardian && guardian.name.toLowerCase() !== row.name.toLowerCase() && (
              <span>Parent: {guardian.name}</span>
            )}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="board-ib"
          aria-label="Close profile"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="peek-actions-row">
        {owed && (
          <button type="button" className="board-primary" onClick={onRecord}>
            Record payment
          </button>
        )}
        {owed && (
          <button type="button" className="board-secondary" onClick={onWhatsApp}>
            Remind on WhatsApp
          </button>
        )}
        {phone && !sample && (
          <a className="board-secondary" href={telLink(phone)}>
            Call
          </a>
        )}
        {!sample && (
          <Link to="/app/students" className="board-secondary">
            Edit
          </Link>
        )}
      </div>

      {claims.length > 0 && (
        <section className="peek-card peek-claims">
          <h3>Payment to check</h3>
          {claims.map((claim) => (
            <div key={claim.claim_id} className="peek-claim">
              <p>
                <strong>{formatRupees(claim.amount_paise)}</strong> said to be paid on{" "}
                {formatDayWithYear(claim.paid_on)} by {paymentMethodLabel(claim.method)}
                {claim.reference ? ` · ${claim.reference}` : ""}.
              </p>
              <div className="peek-actions-row">
                <Button
                  variant="retro"
                  type="button"
                  disabled={accept.isPending || decline.isPending}
                  onClick={() => accept.mutate(claim.claim_id)}
                >
                  Yes, I got it
                </Button>
                <Button
                  variant="retroPaper"
                  type="button"
                  disabled={accept.isPending || decline.isPending}
                  onClick={() => decline.mutate(claim.claim_id)}
                >
                  Not received
                </Button>
              </div>
            </div>
          ))}
          {(accept.isError || decline.isError) && (
            <p role="alert">That did not go through. Please try again.</p>
          )}
        </section>
      )}

      <div className="peek-tiles">
        <div className="peek-tile" data-c="0">
          <span>This month</span>
          <strong>
            {owed
              ? `${formatRupees(row.outstandingPaise)} owed`
              : row.status === "paid"
                ? "Paid"
                : "—"}
          </strong>
        </div>
        <div className="peek-tile" data-c="1">
          <span>Monthly fee</span>
          <strong>
            {row.feePaise > 0
              ? formatRupees(row.feePaise)
              : person?.plan
                ? formatRupees(person.plan.amount_paise)
                : "Not set"}
          </strong>
        </div>
        <div className="peek-tile" data-c="2">
          <span>Account balance</span>
          <strong>
            {sample
              ? formatRupees(row.outstandingPaise)
              : ledger.data
                ? formatRupees(Math.max(0, ledger.data.balance_paise))
                : "…"}
          </strong>
        </div>
      </div>

      <section className="peek-card">
        <h3>Contact</h3>
        {sample ? (
          <p className="board-quiet">Sample dancer. Nothing here is saved.</p>
        ) : overview.isPending ? (
          <p className="board-quiet">Loading…</p>
        ) : overview.isError ? (
          <p role="alert">Could not load the details.</p>
        ) : (
          <dl className="peek-list">
            <div>
              <dt>
                {guardian && guardian.name.toLowerCase() !== row.name.toLowerCase()
                  ? "Parent"
                  : "Name"}
              </dt>
              <dd>{guardian?.name ?? row.name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                {phone ? (showPhone ? phone : maskPhone(phone)) : "Not added"}
                {phone && (
                  <button
                    type="button"
                    className="board-link"
                    onClick={() => setShowPhone((v) => !v)}
                  >
                    {showPhone ? "Hide" : "Show"}
                  </button>
                )}
              </dd>
            </div>
            {person?.details.email && (
              <div>
                <dt>Email</dt>
                <dd>{person.details.email}</dd>
              </div>
            )}
            {person?.details.emergencyPhone && (
              <div>
                <dt>Emergency</dt>
                <dd>
                  {person.details.emergencyName ? `${person.details.emergencyName} · ` : ""}
                  {showPhone
                    ? person.details.emergencyPhone
                    : maskPhone(person.details.emergencyPhone)}
                </dd>
              </div>
            )}
            {person?.details.joinedOn && (
              <div>
                <dt>Joined</dt>
                <dd>{formatDayWithYear(person.details.joinedOn)}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section className="peek-card">
        <h3>Classes</h3>
        <div className="peek-chips">
          {row.batchNames.length === 0 ? (
            <span className="bchip" data-c="none">
              No batch
            </span>
          ) : (
            row.batchNames.map((name) => (
              <span key={name} className="bchip" data-c={toneOf(name)}>
                {name}
              </span>
            ))
          )}
        </div>
        <p className="board-quiet">
          Today: {classes === 0 ? "no class" : here ? "here" : "not marked yet"} ·{" "}
          {reminded ? "reminded today" : "not reminded today"}
        </p>
        {!sample && (
          <>
            {attendance.isPending ? (
              <p className="board-quiet">Loading attendance…</p>
            ) : attendance.isError ? (
              <p role="alert">Could not load attendance.</p>
            ) : sessions.length === 0 ? (
              <p className="board-quiet">No classes marked in the last 90 days.</p>
            ) : (
              <>
                <p className="peek-line">
                  <strong>
                    {came} of {sessions.length}
                  </strong>{" "}
                  classes attended in the last 90 days
                </p>
                <div className="peek-squares" aria-label="Most recent classes, newest first">
                  {recent.map((session) => (
                    <span
                      key={`${session.batch_id}-${session.session_on}`}
                      className="peek-sq"
                      data-on={session.present}
                      title={`${formatDayWithYear(session.session_on)} · ${session.batch_name} · ${session.present ? "here" : "absent"}`}
                    >
                      {session.present ? "✓" : "✕"}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {!sample && (
        <section className="peek-card">
          <h3>Payments</h3>
          {ledger.isPending ? (
            <p className="board-quiet">Loading…</p>
          ) : ledger.isError ? (
            <p role="alert">Could not load payments.</p>
          ) : payments.length === 0 ? (
            <p className="board-quiet">No payments recorded yet.</p>
          ) : (
            <ul className="peek-rows">
              {payments.map((payment) => (
                <li key={payment.id}>
                  <span>{formatDayWithYear(payment.paid_on)}</span>
                  <span className="board-quiet">{paymentMethodLabel(payment.method)}</span>
                  <strong>{formatRupees(payment.amount_paise)}</strong>
                </li>
              ))}
            </ul>
          )}
          {charges.length > 0 && (
            <>
              <h3 className="peek-sub-h">Fees billed</h3>
              <ul className="peek-rows">
                {charges.map((charge) => (
                  <li key={charge.id}>
                    <span>{formatMonthLong(charge.period)}</span>
                    <span className="board-quiet">{charge.fee_plan_name ?? ""}</span>
                    <strong>{formatRupees(charge.amount_paise)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            to="/app/billing"
            search={{ student: row.studentId }}
            className="board-link peek-more"
          >
            Full billing history →
          </Link>
        </section>
      )}

      {person?.details.note && (
        <section className="peek-card">
          <h3>Notes</h3>
          <p className="peek-note">{person.details.note}</p>
        </section>
      )}
    </aside>
  );
}
