import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { weekdayNames } from "@/components/console/form-utils";
import { getAttendanceSummary } from "@/lib/attendance.functions";
import { rangeFor } from "@/lib/attendance-stats";
import { listBatches } from "@/lib/batches.functions";
import { formatRupees } from "@/lib/money";
import { getMonthlyTrend } from "@/lib/reports.functions";
import { todayInIndia } from "@/lib/validators";

export const Route = createFileRoute("/app/insights")({
  head: () => ({ meta: [{ title: "Insights | Choreo Studio" }] }),
  component: Insights,
});

const shortMonth = (period: string) =>
  new Date(`${period}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

function Insights() {
  const trendFn = useServerFn(getMonthlyTrend);
  const summaryFn = useServerFn(getAttendanceSummary);
  const batchesFn = useServerFn(listBatches);

  const { from, to } = rangeFor("month", todayInIndia());
  const trend = useQuery({ queryKey: ["monthly-trend"], queryFn: () => trendFn() });
  const summary = useQuery({
    queryKey: ["attendance-summary", from, to],
    queryFn: () => summaryFn({ data: { from, to } }),
  });
  const batches = useQuery({
    queryKey: ["batches", false],
    queryFn: () => batchesFn({ data: {} }),
  });

  const data = (trend.data ?? []).map((row) => ({
    month: shortMonth(row.period),
    Billed: row.billed_paise / 100,
    Collected: row.collected_paise / 100,
  }));
  const memberCount = new Map(batches.data?.map((batch) => [batch.id, batch.member_count]));

  return (
    <section>
      <h1 className="display console-title">Insights</h1>

      <div className="window">
        <div className="window-bar chrome-font">Billed vs collected, last 6 months</div>
        <div className="window-inner">
          {trend.isError && <p role="alert">Could not load the trend. Please refresh.</p>}
          {trend.data && (
            <div
              className="trend-chart"
              role="img"
              aria-label="Bar chart of billed and collected rupees per month. The table below has the same numbers."
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis
                    tickFormatter={(value: number) => `₹${value.toLocaleString("en-IN")}`}
                    width={70}
                  />
                  <Tooltip formatter={(value) => formatRupees(Number(value) * 100)} />
                  <Legend />
                  <Bar dataKey="Billed" fill="#273FA3" />
                  <Bar dataKey="Collected" fill="#5E9C76" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {trend.data && (
            <table className="trend-table">
              <caption className="sr-only">Billed, collected and missing per month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Billed</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Missing</th>
                </tr>
              </thead>
              <tbody>
                {trend.data.map((row) => (
                  <tr key={row.period}>
                    <th scope="row">{shortMonth(row.period)}</th>
                    <td>{formatRupees(row.billed_paise)}</td>
                    <td>{formatRupees(row.collected_paise)}</td>
                    <td>{formatRupees(row.missing_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="console-list-head">
        <h2>Batches this month</h2>
      </div>
      {summary.data?.batches.length === 0 && <p className="console-empty">No batches yet.</p>}
      <ul className="batch-cards">
        {summary.data?.batches.map((batch) => (
          <li key={batch.id} className="batch-card">
            <strong>{batch.name}</strong>
            <span className="console-hint">
              {batch.weekdays.map((day) => weekdayNames[day]).join(", ") || "No days set"}
            </span>
            <dl>
              <div>
                <dt>Scheduled</dt>
                <dd>{batch.scheduled}</dd>
              </div>
              <div>
                <dt>Held</dt>
                <dd>{batch.held}</dd>
              </div>
              <div>
                <dt>Dancers</dt>
                <dd>{memberCount.get(batch.id) ?? 0}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
