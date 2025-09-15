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

/** Compute the months to display, given the current range & selection. */
function computeWindow(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  // Return an array of { y, m } pairs (1..12).
  const out: { y: number; m: number }[] = [];

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
    // inclusive start..end, month by month
    let d = new Date(customStart.getFullYear(), customStart.getMonth(), 1);
    const finish = new Date(customEnd.getFullYear(), customEnd.getMonth(), 1);
    while (d <= finish) {
      out.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return out;
  }

  // current-month / last-month / month-select → show the whole selected year for a clean "monthly" view
  for (let m = 1; m <= 12; m++) out.push({ y: year, m });
  return out;
}

/** Fetch all income transactions for the date window (paginate if needed) */
async function fetchIncomeForWindow(startISO: string, endISO: string) {
  const pageSize = 1000;
  let page = 1;
  let hasMore = true;
  const all: any[] = [];

  while (hasMore) {
    const url = `/api/transactions?type=income&startDate=${startISO}&endDate=${endISO}&page=${page}&limit=${pageSize}`;
    const { data } = await api.get(url);
    all.push(...(data?.transactions || []));
    hasMore = Boolean(data?.hasMore);
    page += 1;
    if (!data?.transactions?.length) break;
  }
  return all;
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

  // Overall date span to fetch once
  const spanStart = useMemo(() => {
    const first = months[0];
    return new Date(first.y, first.m - 1, 1);
  }, [months]);

  const spanEnd = useMemo(() => {
    const last = months[months.length - 1];
    // last day of that month
    return new Date(last.y, last.m, 0);
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

  // Aggregate to {monthLabel, ssp, usd}
  const series = useMemo(() => {
    const map = new Map<string, { label: string; ssp: number; usd: number }>();
    months.forEach(({ y, m }) => {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      map.set(key, { label: `${MONTH_SHORT[m - 1]} ${y}`, ssp: 0, usd: 0 });
    });

    for (const t of rows as any[]) {
      const d = new Date(t.date || t.createdAt || t.timestamp);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!map.has(key)) continue;
      const entry = map.get(key)!;
      const amount = Number(t.amount || 0);
      const currency = (t.currency || "SSP").toUpperCase();
      if (currency === "USD") entry.usd += amount;
      else entry.ssp += amount;
    }

    return Array.from(map.values());
  }, [rows, months]);

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
              margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
              barGap={6}
              barCategoryGap="24%"
            >
              <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v))}
              />
              <Tooltip
                formatter={(val: any, name: any) =>
                  [nf0.format(Math.round(Number(val))), name === "ssp" ? "SSP" : "USD"]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {/* SSP bars (left axis default) */}
              <Bar dataKey="ssp" name="SSP" radius={[4, 4, 0, 0]} />
              {/* USD bars */}
              <Bar dataKey="usd" name="USD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* quick totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Total SSP</p>
            <p className="text-sm font-semibold tabular-nums">
              SSP {nf0.format(series.reduce((s, r) => s + r.ssp, 0))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total USD</p>
            <p className="text-sm font-semibold tabular-nums">
              USD {nf0.format(series.reduce((s, r) => s + r.usd, 0))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Peak (SSP)</p>
            <p className="text-sm font-semibold tabular-nums">
              {series.length ? `${series[series.findIndex(r => r.ssp === Math.max(...series.map(x=>x.ssp)))].label}` : "—"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Peak (USD)</p>
            <p className="text-sm font-semibold tabular-nums">
              {series.length ? `${series[series.findIndex(r => r.usd === Math.max(...series.map(x=>x.usd)))].label}` : "—"}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm mt-3">Loading monthly income…</div>
        )}
      </CardContent>
    </Card>
  );
}
