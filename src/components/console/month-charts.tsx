import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthShort } from "@/lib/format";
import { formatRupees } from "@/lib/money";
import type { getHomeReport } from "@/lib/reports.functions";
import { getMonthlyTrend } from "@/lib/reports.functions";

type Snapshot = Awaited<ReturnType<typeof getHomeReport>>["snapshot"];

/** This month's billing split and the last six months, as pictures: where the money stands at a glance. */
export function MonthCharts({ snapshot }: { snapshot: Snapshot }) {
  const trendFn = useServerFn(getMonthlyTrend);
  const trend = useQuery({ queryKey: ["monthly-trend"], queryFn: () => trendFn() });

  const slices = [
    { name: "Collected", paise: snapshot.collected_paise, color: "#273FA3" },
    { name: "Not yet due", paise: snapshot.not_yet_due_paise, color: "#F0C24C" },
    { name: "Overdue", paise: snapshot.overdue_paise, color: "#E7AAA9" },
  ].filter((slice) => slice.paise > 0);
  const total = slices.reduce((sum, slice) => sum + slice.paise, 0);
  if (total === 0) return null;
  const unpaidPercent = Math.round(((snapshot.not_yet_due_paise + snapshot.overdue_paise) / total) * 100);

  const bars = (trend.data ?? []).map((row) => ({
    month: formatMonthShort(row.period),
    Billed: row.billed_paise / 100,
    Collected: row.collected_paise / 100,
  }));
  const hasTrend = (trend.data ?? []).some((row) => row.billed_paise > 0);

  return (
    <div className="month-charts" data-tour="charts">
      <div className="window">
        <div className="window-bar chrome-font">This month: {unpaidPercent}% unpaid</div>
        <div className="window-inner month-pie">
          <div
            role="img"
            aria-label={`Pie chart of this month's fees: ${slices
              .map((slice) => `${slice.name} ${formatRupees(slice.paise)}`)
              .join(", ")}.`}
          >
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={slices} dataKey="paise" nameKey="name" innerRadius={50} outerRadius={85} stroke="#1A1A1A" strokeWidth={2}>
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRupees(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="month-legend">
            {slices.map((slice) => (
              <li key={slice.name}>
                <span className="month-dot" style={{ background: slice.color }} aria-hidden="true" />
                {slice.name}: {formatRupees(slice.paise)} ({Math.round((slice.paise / total) * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      </div>

      {hasTrend && (
        <div className="window">
          <div className="window-bar chrome-font">Billed vs collected, 6 months</div>
          <div className="window-inner">
            <div
              role="img"
              aria-label="Bar chart of billed and collected rupees for each of the last six months."
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value: number) => `₹${value.toLocaleString("en-IN")}`} width={70} />
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                  <Bar dataKey="Billed" fill="#273FA3" stroke="#1A1A1A" strokeWidth={2} />
                  <Bar dataKey="Collected" fill="#F0C24C" stroke="#1A1A1A" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
