import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

type TimeRange =
  | "current-month"
  | "last-month"
  | "month-select"
  | "last-3-months"
  | "year"
  | "custom";

type Props = {
  // We will render the focused month (selectedYear/selectedMonth).
  // If the top-level date filter is not a single month, we still
  // show the chosen month on Exec Dashboard to keep it simple.
  timeRange: TimeRange;
  selectedYear: number;   // 2025
  selectedMonth: number;  // 1..12
};

// number formatter: integers, no decimals
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/* ----------------------------- Helpers ----------------------------- */

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1..12
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1);
}
function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0);
}

function currencyNorm(x: any) {
  return String(x ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();
}

// simple 7-day rolling avg
function rollingAvg(series: Array<{ day: number; value: number }>, window = 7) {
  return series.map((p, i) => {
    const s = Math.max(0, i - (window - 1));
    const slice = series.slice(s, i + 1);
    const sum = slice.reduce((acc, r) => acc + (r.value || 0), 0);
    return { day: p.day, avg: slice.length ? sum / slice.length : 0 };
  });
}

/* ------------------------------ Fetch ------------------------------ */

async function fetchIncomeDaily(year: number, month: number) {
  const startISO = format(startOfMonth(year, month), "yyyy-MM-dd");
  const endISO   = format(endOfMonth(year, month), "yyyy-MM-dd");

  // paginate in case there are many rows
  const pageSize = 1000;
  let page = 1;
  let hasMore = true;
  const all: any[] = [];

  while (hasMore) {
    const { data } = await api.get(
      `/api/transactions?type=income&startDate=${startISO}&endDate=${endISO}&page=${page}&limit=${pageSize}`
    );
    const rows = data?.transactions || [];
    all.push(...rows);
    hasMore = Boolean(data?.hasMore);
    page += 1;
    if (!rows.length) break;
  }
  return all;
}

/* ---------------------------- Component ---------------------------- */

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
}: Props) {
  // We always focus on the chosen month to keep Exec view predictable.
  const year  = selectedYear;
  const month = selectedMonth;
  const days  = daysInMonth(year, month);

  // Prebuild 1..days with zeros so X-axis includes the full month
  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data = [], isLoading } = useQuery({
    queryKey: ["exec-daily-income", year, month],
    queryFn: async () => {
      const rows = await fetchIncomeDaily(year, month);

      // Aggregate by day and currency
      const sspBucket: Record<number, number> = {};
      const usdBucket: Record<number, number> = {};

      for (const t of rows as any[]) {
        const raw = t.dateISO || t.date || t.createdAt || t.created_at || t.timestamp;
        const d = raw ? new Date(raw) : null;
        if (!d || Number.isNaN(d.getTime())) continue;

        const day = d.getDate();
        const amt = Number(t.amount ?? 0);
        const cur = currencyNorm(t.currency);

        if (cur === "USD") usdBucket[day] = (usdBucket[day] || 0) + amt;
        else               sspBucket[day] = (sspBucket[day] || 0) + amt;
      }

      // Build continuous series for the whole month
      const ssp = baseDays.map((day) => ({ day, value: Number(sspBucket[day] || 0) }));
      const usd = baseDays.map((day) => ({ day, value: Number(usdBucket[day] || 0) }));

      return { ssp, usd };
    },
  });

  const sspSeries = data?.ssp ?? baseDays.map((day) => ({ day, value: 0 }));
  const usdSeries = data?.usd ?? baseDays.map((day) => ({ day, value: 0 }));

  // Summaries
  const totalSSP = sspSeries.reduce((s, r) => s + r.value, 0);
  const totalUSD = usdSeries.reduce((s, r) => s + r.value, 0);

  // dynamic headroom so labels won't clip if added later
  const yMaxSSP = Math.ceil(Math.max(0, ...sspSeries.map(d => d.value)) * 1.15);
  const yMaxUSD = Math.ceil(Math.max(0, ...usdSeries.map(d => d.value)) * 1.20);

  // 7-day moving average
  const sspAvg = rollingAvg(sspSeries, 7);
  const usdAvg = rollingAvg(usdSeries, 7);

  // Make day ticks readable (show roughly 8–10 ticks)
  const approxTicks = 8;
  const tickInterval = Math.max(1, Math.floor(days / approxTicks));

  const tooltipFmt = (v: any) => nf0.format(Math.round(Number(v)));

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {format(startOfMonth(year, month), "MMM yyyy")} ·{" "}
          <span className="font-medium">SSP {nf0.format(totalSSP)}</span> ·{" "}
          <span className="font-medium">USD {nf0.format(totalUSD)}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP daily */}
        <div aria-label="SSP daily chart">
          <p className="text-sm font-medium text-slate-700 mb-2">SSP (Daily)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sspSeries}
                margin={{ top: 6, right: 12, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={tickInterval - 1} // show ~8–10 ticks
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v/1000)}k` : nf0.format(v))}
                />
                <Tooltip
                  formatter={(v) => [`SSP ${tooltipFmt(v as number)}`, ""]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line
                  type="monotone"
                  data={sspAvg}
                  dataKey="avg"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  name="7-day avg"
                />
                <Bar
                  dataKey="value"
                  name="SSP"
                  fill="#14b8a6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* USD daily */}
        <div aria-label="USD daily chart">
          <p className="text-sm font-medium text-slate-700 mb-2">USD (Daily)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usdSeries}
                margin={{ top: 6, right: 12, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={tickInterval - 1}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v/1000)}k` : nf0.format(v))}
                />
                <Tooltip
                  formatter={(v) => [`USD ${tooltipFmt(v as number)}`, ""]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line
                  type="monotone"
                  data={usdAvg}
                  dataKey="avg"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="7-day avg"
                />
                <Bar
                  dataKey="value"
                  name="USD"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading daily revenue…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
