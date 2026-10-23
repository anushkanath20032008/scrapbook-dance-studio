import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { formatMonthLong, paymentMethodLabel } from "@/lib/format";
import { collectedPercent } from "@/lib/month-end";
import { formatRupees } from "@/lib/money";
import { getMonthEnd } from "@/lib/reports.functions";
import { firstOfMonth, todayInIndia } from "@/lib/validators";

export const Route = createFileRoute("/app/month-end")({
  head: () => ({ meta: [{ title: "Month end | ChoreoStudio" }] }),
  component: MonthEnd,
});

function Bar({ label, paise, max, detail }: { label: string; paise: number; max: number; detail?: string }) {
  const width = max > 0 ? Math.max(paise > 0 ? 3 : 0, Math.round((paise / max) * 100)) : 0;
  return (
    <li className="me-row">
      <span className="me-label">{label}</span>
      <span className="me-track" aria-hidden="true">
        <span className="me-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="me-value">
        {formatRupees(paise)}
        {detail && <span className="console-hint"> · {detail}</span>}
      </span>
    </li>
  );
}

function MonthEnd() {
  const load = useServerFn(getMonthEnd);
  const [month, setMonth] = useState(todayInIndia().slice(0, 7));
  const period = firstOfMonth(`${month}-01`);
  const report = useQuery({ queryKey: ["month-end", period], queryFn: () => load({ data: { period } }) });
  const data = report.data;
  const snapshot = data?.snapshot;
  const methodMax = Math.max(0, ...(data?.byMethod.map((row) => row.paise) ?? []));
  const agingMax = Math.max(0, ...(data?.aging.map((row) => row.paise) ?? []));
  const percent = snapshot ? collectedPercent(snapshot.billed_paise, snapshot.collected_paise) : 0;
  const noCharges = snapshot !== undefined && snapshot.charged_students === 0;

  return (
    <section>
      <h1 className="display console-title">Month end</h1>
      <label className="console-inline-label" style={{ marginBottom: 16 }}>
        Month
        <input className="field" style={{ width: "auto" }} type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
      </label>

      {report.isError && <p role="alert">Could not load this month. Please refresh.</p>}
      {report.isLoading && <p className="console-empty">Loading this month…</p>}
      {noCharges && (
        <p className="console-empty">
          {formatMonthLong(period)} has no charges yet. Generate them from <Link to="/app">Overview</Link>.
        </p>
      )}

      {data && snapshot && !noCharges && (
        <>
          <div className="window">
            <div className="window-bar chrome-font">{formatMonthLong(period)}: billed vs collected</div>
            <div className="window-inner">
              <div
                className="me-meter"
                role="img"
                aria-label={`${percent} percent of ${formatRupees(snapshot.billed_paise)} billed has been collected`}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
              <dl className="totals-grid">
                <div><dt>Billed</dt><dd>{formatRupees(snapshot.billed_paise)}</dd></div>
                <div><dt>Collected</dt><dd>{formatRupees(snapshot.collected_paise)}</dd></div>
                <div><dt>Still owed</dt><dd>{formatRupees(snapshot.missing_paise)}</dd></div>
                <div><dt>Share collected</dt><dd>{percent}%</dd></div>
              </dl>
              {data.pendingClaims.count > 0 && (
                <p className="console-banner">
                  {data.pendingClaims.count} payment{data.pendingClaims.count === 1 ? "" : "s"} (
                  {formatRupees(data.pendingClaims.paise)}) waiting to be checked against your statement.{" "}
                  <Link to="/app/verify">Check them</Link>
                </p>
              )}
            </div>
          </div>

          <div className="window">
            <div className="window-bar chrome-font">How it was paid</div>
            <div className="window-inner">
              {data.byMethod.length === 0 && (
                <p className="console-empty">No payments recorded for {formatMonthLong(period)} yet.</p>
              )}
              <ul className="me-list">
                {data.byMethod.map((row) => (
                  <Bar key={row.method} label={paymentMethodLabel(row.method)} paise={row.paise} max={methodMax} />
                ))}
              </ul>
              <p className="console-hint">Payments recorded with a date in {formatMonthLong(period)}. Match each line to your cash book, UPI app and bank statement.</p>
            </div>
          </div>

          <div className="window">
            <div className="window-bar chrome-font">Who is late</div>
            <div className="window-inner">
              <ul className="me-list">
                {data.aging.map((row) => (
                  <Bar
                    key={row.label}
                    label={row.label}
                    paise={row.paise}
                    max={agingMax}
                    detail={`${row.dancers} dancer${row.dancers === 1 ? "" : "s"}`}
                  />
                ))}
              </ul>
              <p className="console-hint">
                Not yet due: {formatRupees(snapshot.not_yet_due_paise)}. <Link to="/app">Remind the late ones</Link>
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
