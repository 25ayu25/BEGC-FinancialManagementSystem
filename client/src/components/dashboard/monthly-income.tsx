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

/* -------------------- helpers -------------------- */

function computeWindow(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  // which month buckets we want to show
  const out: { y: number; m: number }[] = [];

  if (timeRange === "month-select" || timeRange === "current-month" || timeRange === "last-month") {
    return [{ y: year, m: month }]; // single month on the chart
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

  // fallback: whole selected year
  for (let m = 1; m <= 12; m++) out.push({ y: year, m });
  return out;
}

async function fetchTransactions(startISO: string, endISO: string) {
  // generic income fetch with pagination
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

const normCurrency = (x: any) => String(x ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();

/* -------------------- component -------------------- */

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

  // overall span for non-single-month windows
  const spanStart = useMemo(() => {
    const first = months[0];
    return new Date(first.y, first.m - 1, 1);
  }, [months]);

  const spanEnd = useMemo(() => {
    const last = months[months.length - 1];
    return new Date(last.y, last.m, 0);
  }, [months]);

  const isSingleMonth =
    timeRange === "month-select" || timeRange === "current-month" || timeRange === "last-month";

  const monthStart = useMemo(() => new Date(selectedYear, selectedMonth - 1, 1), [selectedYear, selectedMonth]);
  const monthEnd   = useMemo(() => new Date(selectedYear, selectedMonth, 0), [selectedYear, selectedMonth]);

  // ---- data queries ----
  const { data = [], isLoading } = useQuery({
    queryKey: [
      "monthly-income",
      timeRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      // SINGLE MONTH → try trends first; if empty/zero, fallback to transactions
      if (isSingleMonth) {
        const qs = `range=custom&startDate=${format(monthStart, "yyyy-MM-dd")}&endDate=${format(monthEnd, "yyyy-MM-dd")}`;
        const { data } = await api.get(`/api/income-trends/${selectedYear}/${selectedMonth}?${qs}`);
        const rows = Array.isArray(data) ? data : data?.data || [];

        // aggregate rows defensively (server fields vary)
        let ssp = 0, usd = 0;
        for (const r of rows) {
          ssp += Number(r.incomeSSP ?? r.amountSSP ?? r.ssp ?? r.income ?? 0);
          usd += Number(r.incomeUSD ?? r.amountUSD ?? r.usd ?? 0);
        }

        if (ssp > 0 || usd > 0) {
          return [{ label: `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`, ssp, usd }];
        }

        // fallback: compute from transactions
        const startISO = format(monthStart, "yyyy-MM-dd");
        const endISO   = format(monthEnd, "yyyy-MM-dd");
        const tx = await fetchTransactions(startISO, endISO);
        for (const t of tx as any[]) {
          const amount = Number(t.amount ?? 0);
          const cur = normCurrency(t.currency);
          if (cur === "USD") usd += amount; else ssp += amount;
        }
        return [{ label: `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`, ssp, usd }];
      }

      // MULTI-MONTH → fetch once and bucket by month
      const startISO = format(spanStart, "yyyy-MM-dd");
      const endISO   = format(spanEnd, "yyyy-MM-dd");
      const rows = await fetchTransactions(startISO, endISO);

      // initialize map with all requested buckets (keeps empty months visible)
      const map = new Map<string, { label: string; ssp: number; usd: number }>();
      months.forEach(({ y, m }) => {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        map.set(key, { label: `${MONTH_SHORT[m - 1]} ${y}`, ssp: 0, usd: 0 });
      });

      for (const t of rows as any[]) {
        const rawDate = t.dateISO || t.date || t.createdAt || t.created_at || t.timestamp;
        const d = rawDate ? new Date(rawDate) : null;
        if (!d || Number.isNaN(d.getTime())) continue;
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!map.has(key)) continue;

        const amount = Number(t.amount ?? 0);
        const cur = normCurrency(t.currency);
        if (cur === "USD") map.get(key)!.usd += amount;
        else map.get(key)!.ssp += amount;
      }

      return Array.from(map.values());
    },
  });

  const totalSSP = data.reduce((s: number, r: any) => s + (r.ssp || 0), 0);
  const totalUSD = data.reduce((s: number, r: any) => s + (r.usd || 0), 0);
  const peakSSP = Math.max(0, ...data.map((r: any) => r.ssp || 0));
  const peakUSD = Math.max(0, ...data.map((r: any) => r.usd || 0));
  const peakSSPLabel = data.find((r: any) => (r.ssp || 0) === peakSSP)?.label ?? "—";
  const peakUSDLabel = data.find((r: any) => (r.usd || 0) === peakUSD)?.label ?? "—";

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
              data={data}
              margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
              barGap={6}
              barCategoryGap="28%"
            >
              <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                interval={0}
                angle={data.length > 6 ? -30 : 0}
                textAnchor={data.length > 6 ? "end" : "middle"}
                height={data.length > 6 ? 42 : 20}
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
              <Bar dataKey="ssp" name="SSP" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="usd" name="USD" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* quick totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Total SSP</p>
            <p className="text-sm font-semibold tabular-nums">SSP {nf0.format(totalSSP)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total USD</p>
            <p className="text-sm font-semibold tabular-nums">USD {nf0.format(totalUSD)}</p>
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
