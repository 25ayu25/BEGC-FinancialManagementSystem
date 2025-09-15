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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

/* -------------------------------- Types -------------------------------- */

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

/* ----------------------------- Constants ------------------------------ */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/* -------------------------------- Utils -------------------------------- */

const normCurrency = (x: any) => String(x ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();

/** Build month buckets to draw on the chart. */
function computeWindow(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  const out: { y: number; m: number }[] = [];

  // single-month modes
  if (timeRange === "month-select" || timeRange === "current-month" || timeRange === "last-month") {
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

  // fallback to whole selected year
  for (let m = 1; m <= 12; m++) out.push({ y: year, m });
  return out;
}

/** Fetch income transactions within a span (handles pagination). */
async function fetchTransactions(startISO: string, endISO: string) {
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

/* ------------------------------- Component ------------------------------ */

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

  const { data = [], isLoading } = useQuery({
    queryKey: [
      "monthly-income-split",
      timeRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      // ---------- SINGLE MONTH: trends first, fallback to transactions ----------
      if (isSingleMonth) {
        const qs = `range=custom&startDate=${format(monthStart, "yyyy-MM-dd")}&endDate=${format(monthEnd, "yyyy-MM-dd")}`;

        try {
          const { data } = await api.get(`/api/income-trends/${selectedYear}/${selectedMonth}?${qs}`);
          const rows = Array.isArray(data) ? data : data?.data || [];
          let ssp = 0, usd = 0;
          for (const r of rows) {
            ssp += Number(r.incomeSSP ?? r.amountSSP ?? r.ssp ?? r.income ?? 0);
            usd += Number(r.incomeUSD ?? r.amountUSD ?? r.usd ?? 0);
          }
          if (ssp > 0 || usd > 0) {
            return [{ label: `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`, ssp, usd }];
          }
        } catch { /* fall through */ }

        const tx = await fetchTransactions(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd"));
        let ssp = 0, usd = 0;
        for (const t of tx as any[]) {
          const amount = Number(t.amount ?? 0);
          const cur = normCurrency(t.currency);
          if (cur === "USD") usd += amount; else ssp += amount;
        }
        return [{ label: `${MONTH_SHORT[selectedMonth - 1]} ${selectedYear}`, ssp, usd }];
      }

      // ---------- MULTI-MONTH: bucket transactions + merge insurance USD ----------
      const startISO = format(spanStart, "yyyy-MM-dd");
      const endISO   = format(spanEnd, "yyyy-MM-dd");
      const rows = await fetchTransactions(startISO, endISO);

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

      // merge insurance USD per month
      let insUrl = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        insUrl += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      try {
        const res = await api.get(insUrl);
        const list: Array<{ year: number; month: number; usd: number }> | undefined = res?.data?.data || res?.data;
        if (Array.isArray(list)) {
          for (const row of list) {
            const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
            if (map.has(key)) map.get(key)!.usd += Number(row.usd || 0);
          }
        }
      } catch { /* ignore if endpoint not present */ }

      return Array.from(map.values());
    },
  });

  const totalSSP = data.reduce((s: number, r: any) => s + (r.ssp || 0), 0);
  const totalUSD = data.reduce((s: number, r: any) => s + (r.usd || 0), 0);

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Monthly Income
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-2 space-y-8">
        {/* SSP chart */}
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">SSP (Monthly)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }} barGap={6} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={0}
                  angle={data.length > 6 ? -30 : 0}
                  textAnchor={data.length > 6 ? "end" : "middle"}
                  height={data.length > 6 ? 42 : 20}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v))} />
                <Tooltip formatter={(val: any) => [nf0.format(Math.round(Number(val))), "SSP"]} />
                <Bar dataKey="ssp" name="SSP" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* USD chart */}
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">USD (Monthly)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 28 }} barGap={6} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={0}
                  angle={data.length > 6 ? -30 : 0}
                  textAnchor={data.length > 6 ? "end" : "middle"}
                  height={data.length > 6 ? 42 : 20}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v: number) => (v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v))} />
                <Tooltip formatter={(val: any) => [nf0.format(Math.round(Number(val))), "USD"]} />
                <Bar dataKey="usd" name="USD" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500">Total SSP</p>
            <p className="text-sm font-semibold tabular-nums">SSP {nf0.format(totalSSP)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Total USD</p>
            <p className="text-sm font-semibold tabular-nums">USD {nf0.format(totalUSD)}</p>
          </div>
        </div>

        {isLoading && <div className="text-center text-slate-500 text-sm">Loading monthly income…</div>}
      </CardContent>
    </Card>
  );
}
