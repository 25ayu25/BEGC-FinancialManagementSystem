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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // 4-digit year
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Build a list of (y,m) buckets we want to plot. */
function computeWindow(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  const out: { y: number; m: number }[] = [];

  if (timeRange === "month-select") {
    // ✅ Show ONLY the explicitly selected month
    return [{ y: year, m: month }];
  }

  if (timeRange === "year") {
    for (let m = 1; m <= 12; m++) out.push({ y: year, m });
    return out;
  }

  if (timeRange === "last-3-months") {
    const end = new Date(year, month - 1, 1);
    for (let k = 2; k >= 0; k--) {
      const d = new Date(end.getFullYear(), end.getMonth() - k, 1);
      out.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
    return out;
  }

  if (timeRange === "custom" && customStart && customEnd) {
    let d = new Date(customStart.getFullYear(), customStart.getMonth(), 1);
    const finish = new Date(customEnd.getFullYear(), customEnd.getMonth(), 1);
    while (d <= finish) {
      out.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return out;
  }

  // current-month / last-month → show only that month’s bucket
  if (timeRange === "current-month" || timeRange === "last-month") {
    return [{ y: year, m: month }];
  }

  // fallback: selected year
  for (let m = 1; m <= 12; m++) out.push({ y: year, m });
  return out;
}

/** Fetch income transactions for a span (handles pagination). */
async function fetchIncomeForWindow(startISO: string, endISO: string) {
  const pageSize = 1000;
  let page = 1;
  let hasMore = true;
  const all: any[] = [];

  while (hasMore) {
    const url = `/api/transactions?type=income&startDate=${startISO}&endDate=${endISO}&page=${page}&limit=${pageSize}`;
    const { data } = await api.get(url);
    const rows = data?.transactions || [];
    all.push(...rows);
    hasMore = Boolean(data?.hasMore);
    page += 1;
    if (!rows.length) break;
  }
  return all;
}

/** Robust date parser for various server field names. */
function getTxDate(tx: any): Date | null {
  const raw =
    tx?.dateISO || tx?.date || tx?.createdAt || tx?.created_at || tx?.timestamp;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function MonthlyIncome({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const months = useMemo(
    () => computeWindow(timeRange, selectedYear, selectedMonth, customStartDate, customEndDate),
    [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]
  );

  // Fetch a single span covering all displayed months
  const spanStart = useMemo(() => {
    const first = months[0];
    return new Date(first.y, first.m - 1, 1);
  }, [months]);

  const spanEnd = useMemo(() => {
    const last = months[months.length - 1];
    return new Date(last.y, last.m, 0); // last day of last month
  }, [months]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [
      "monthly-income",
      months.map((x) => `${x.y}-${x.m}`).join(","),
      spanStart.toISOString(),
      spanEnd.toISOString(),
    ],
    queryFn: async () => {
      const startISO = format(spanStart, "yyyy-MM-dd");
      const endISO = format(spanEnd, "yyyy-MM-dd");
      return fetchIncomeForWindow(startISO, endISO);
    },
  });

  // Aggregate to {label, ssp, usd} per month
  const series = useMemo(() => {
    const map = new Map<string, { label: string; ssp: number; usd: number }>();
    months.forEach(({ y, m }) => {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      map.set(key, { label: `${MONTH_SHORT[m - 1]} ${y}`, ssp: 0, usd: 0 });
    });

    for (const t of rows as any[]) {
      const d = getTxDate(t);
      if (!d) continue;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!map.has(key)) continue;

      const amount = Number(t.amount ?? 0);
      // normalize currency strings like 'usd', 'USD ', 'Us$', etc.
      const cur = String(t.currency ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();
      if (cur === "USD") map.get(key)!.usd += amount;
      else map.get(key)!.ssp += amount;
    }

    return Array.from(map.values());
  }, [rows, months]);

  // Totals and peaks
  const totalSSP = series.reduce((s, r) => s + r.ssp, 0);
  const totalUSD = series.reduce((s, r) => s + r.usd, 0);
  const peakSSPVal = Math.max(0, ...series.map((r) => r.ssp));
  const peakUSDVal = Math.max(0, ...series.map((r) => r.usd));
  const peakSSPLabel = series.find((r) => r.ssp === peakSSPVal)?.label ?? "—";
  const peakUSDLabel = series.find((r) => r.usd === peakUSDVal)?.label ?? "—";

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Monthly Income
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
              barGap={6}
              barCategoryGap="28%"
            >
              <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={0}
                angle={series.length > 6 ? -30 : 0}
                textAnchor={series.length > 6 ? "end" : "middle"}
                height={series.length > 6 ? 42 : 20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v))}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  nf0.format(Math.round(Number(val))),
                  name === "ssp" ? "SSP" : "USD",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* ✔ Modern colors */}
              <Bar dataKey="ssp" name="SSP" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="usd" name="USD" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* quick totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Total SSP</p>
            <p className="text-sm font-semibold tabular-nums">
              SSP {nf0.format(totalSSP)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total USD</p>
            <p className="text-sm font-semibold tabular-nums">
              USD {nf0.format(totalUSD)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Peak (SSP)</p>
            <p className="text-sm font-semibold tabular-nums">{peakSSPLabel}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Peak (USD)</p>
            <p className="text-sm font-semibold tabular-nums">{peakUSDLabel}</p>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm mt-3">
            Loading monthly income…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
