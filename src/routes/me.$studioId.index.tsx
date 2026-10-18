import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { messageOf, weekdayNames } from "@/components/console/form-utils";
import { formatDay, formatDayWithYear, formatMonthLong } from "@/lib/format";
import { getMemberView, listMemberClaims } from "@/lib/members.functions";
import { formatRupees } from "@/lib/money";

export const Route = createFileRoute("/me/$studioId/")({
  component: MemberView,
});

const clock = (value: string | null) => (value ? value.slice(0, 5) : "");
const tone = (status: string) =>
  status === "paid" ? "good" : status === "overdue" ? "warn" : "idle";

function MemberView() {
  const { studioId } = Route.useParams();
  const load = useServerFn(getMemberView);
  const loadClaims = useServerFn(listMemberClaims);
  const view = useQuery({
    queryKey: ["member-view", studioId],
    queryFn: () => load({ data: { studioId } }),
    retry: false,
  });
  const claims = useQuery({
    queryKey: ["member-claims", studioId],
    queryFn: () => loadClaims({ data: { studioId } }),
    retry: false,
    enabled: view.isSuccess,
  });

  if (view.isPending) return <p>Loading…</p>;
  if (view.isError)
    return (
      <>
        <h1 className="display login-title">Not available.</h1>
        <p className="login-error" role="alert">
          {messageOf(view.error)}
        </p>
        <p>
          <Link to="/me">Back to your studios</Link>
        </p>
      </>
    );

  const data = view.data;
  const nameOf = new Map(data.students.map((student) => [student.id, student.name]));

  return (
    <>
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
          <Button variant="retro" asChild>
            <Link to="/me/$studioId/claim" params={{ studioId }}>
              I&apos;ve paid
            </Link>
          </Button>
        </div>
      </div>

      {data.students.length === 0 && (
        <p className="console-hint">Nothing to show yet. Your studio has not set up your record.</p>
      )}

      {data.students.map((student) => (
        <section key={student.id} className="window family-card">
          <div className="window-bar chrome-font">{student.name}</div>
          <div className="window-inner">
            <h3 className="console-subhead">Classes</h3>
            {student.batches.length === 0 && <p className="console-hint">Not on a batch yet.</p>}
            {student.batches.map((batch) => (
              <p key={batch.name} className="family-line">
                <strong>{batch.name}</strong>
                <span className="console-hint">
                  {batch.weekdays.map((day) => weekdayNames[day]).join(", ")}
                  {batch.starts_at ? ` · ${clock(batch.starts_at)}` : ""}
                  {batch.trainer_name ? ` · ${batch.trainer_name}` : ""}
                  {batch.room ? ` · ${batch.room}` : ""}
                </span>
              </p>
            ))}

            {student.attendance.length > 0 && (
              <>
                <h3 className="console-subhead">Recent attendance</h3>
                {student.attendance.slice(0, 8).map((record, index) => (
                  <p key={index} className="family-line">
                    <strong>{record.date ? formatDay(record.date) : "Class"}</strong>
                    <span className="console-hint">{record.present ? "Present" : "Absent"}</span>
                  </p>
                ))}
              </>
            )}

            {student.charges.length > 0 && (
              <>
                <h3 className="console-subhead">Fees</h3>
                {student.charges.map((charge) => (
                  <p key={`${charge.period}-${charge.due_on}`} className="family-line">
                    <strong>{formatMonthLong(charge.period)}</strong>
                    <span className="console-hint">
                      {formatRupees(charge.amount_paise)} · due {formatDay(charge.due_on)}
                    </span>
                    <span className="status-pill" data-tone={tone(charge.status)}>
                      {charge.status}
                    </span>
                  </p>
                ))}
              </>
            )}

            {student.payments.length > 0 && (
              <>
                <h3 className="console-subhead">Payments</h3>
                {student.payments.slice(0, 8).map((payment, index) => (
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
                    {nameOf.size > 1 ? `${nameOf.get(claim.student_id) ?? ""} · ` : ""}
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
      <p className="console-hint">
        <Link to="/me">All my studios</Link>
      </p>
    </>
  );
}
