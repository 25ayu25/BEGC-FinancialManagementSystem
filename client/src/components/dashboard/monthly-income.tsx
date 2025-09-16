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
  LabelList,
  Line,
  ReferenceLine,
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

  /** Optional: draw a goal/reference line on the SSP chart (per-month target). */
  monthlySSPTarget?: number;

  /**
   * Optional: bar click handler for drill-down.
   * If provided, clicking a bar will pass (year, month, currency).
   */
  onBarClick?: (year: number, month: number, currency: "SSP" | "USD") => void;
};

/* ----------------------------- Constants ------------------------------ */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/* -------------------------------- Utils -------------------------------- */

const normCurrency = (x: any) =>
  String(x ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();

/** Build the list of {y,m} buckets to show. */
function computeWindow(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  const out: { y: number; m: number }[] = [];

  if (timeRange === "month-select" || timeRange === "current-month" || timeRange === "last-month") {
    return [{ y: year, m: month }];
  }

  if (timeRange === "year") {
    for (let m = 1; m <= 12; m++) out.push({ y, m });
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

  for (let m = 1; m <= 12; m++) out.push({ y, m });
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

/** Fetch insurance USD totals per month for current window. */
async function fetchInsuranceMonthlyUSD(
  timeRange: TimeRange,
  selectedYear: number,
  selectedMonth: number,
  start?: Date,
  end?: Date
) {
  let url = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
  if (timeRange === "custom" && start && end) {
    url += `&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(end, "yyyy-MM-dd")}`;
  }
  if (timeRange === "month-select" || timeRange === "current-month" || timeRange === "last-month") {
    const s = start ?? new Date(selectedYear, selectedMonth - 1, 1);
    const e = end ?? new Date(selectedYear, selectedMonth, 0);
    url = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=custom&startDate=${format(
      s,
      "yyyy-MM-dd"
    )}&endDate=${format(e, "yyyy-MM-dd")}`;
  }

  try {
    const res = await api.get(url);
    const list = (res?.data?.data || res?.data) as
      | Array<{ year: number; month: number; usd: number }>
      | { usd?: number }
      | number
      | undefined;

    const map = new Map<string, number>();
    if (Array.isArray(list)) {
      for (const row of list) {
        map.set(`${row.year}-${String(row.month).padStart(2, "0")}`, Number(row.usd || 0));
      }
    } else {
      const single =
        typeof list === "number"
          ? list
          : typeof list === "object" && list
          ? Number((list as any).usd || 0)
          : 0;
      const key = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      map.set(key, single);
    }
    return map;
  } catch {
    return new Map<string, number>();
  }
}

/* ------------------------------- CSV Export ------------------------------ */

function exportCSV(rows: Array<{ label: string; ssp: number; usd: number }>, filename = "monthly-income.csv") {
  const header = "Month,SSP,USD\n";
  const body = rows
    .map((r) => `${r.label},${Math.round(r.ssp)},${Math.round(r.usd)}`)
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------- Component ------------------------------ */

export default function MonthlyIncome({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
  monthlySSPTarget,
  onBarClick,
}: Props) {
  const months = useMemo(
    () =>
      computeWindow(
        timeRange,
        selectedYear,
        selectedMonth,
        customStartDate,
        customEndDate
      ),
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
    timeRange === "month-select" ||
    timeRange === "current-month" ||
    timeRange === "last-month";

  const monthStart = useMemo(
    () => new Date(selectedYear, selectedMonth - 1, 1),
    [selectedYear, selectedMonth]
  );
  const monthEnd = useMemo(
    () => new Date(selectedYear, selectedMonth, 0),
    [selectedYear, selectedMonth]
  );

  const { data = [], isLoading } = useQuery({
    queryKey: [
      "monthly-income-v3",
      timeRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      const map = new Map<string, { label: string; ssp: number; usd: number }>();
      months.forEach(({ y, m }) => {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        map.set(key, { label: `${MONTH_SHORT[m - 1]} ${y}`, ssp: 0, usd: 0 });
      });

      const txStart = isSingleMonth ? monthStart : spanStart;
      const txEnd = isSingleMonth ? monthEnd : spanEnd;
      const rows = await fetchTransactions(
        format(txStart, "yyyy-MM-dd"),
        format(txEnd, "yyyy-MM-dd")
      );

      for (const t of rows as any[]) {
        const rawDate =
          t.dateISO || t.date || t.createdAt || t.created_at || t.timestamp;
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

      const insMap = await fetchInsuranceMonthlyUSD(
        timeRange,
        selectedYear,
        selectedMonth,
        isSingleMonth ? monthStart : customStartDate,
        isSingleMonth ? monthEnd : customEndDate
      );
      for (const [key, usd] of insMap.entries()) {
        if (map.has(key)) map.get(key)!.usd += Number(usd || 0);
      }

      return Array.from(map.values());
    },
  });

  /* ----------------------------- Aggregations ---------------------------- */

  const totalSSP = data.reduce((s: number, r: any) => s + (r.ssp || 0), 0);
  const totalUSD = data.reduce((s: number, r: any) => s + (r.usd || 0), 0);

  const sspSeries = data.map(({ label, ssp }) => ({ label, value: ssp }));
  const usdSeries = data.map(({ label, usd }) => ({ label, value: usd }));

  // 3-month rolling average for SSP
  const sspRolling = sspSeries.map((d, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 2), i + 1);
    const avg = slice.reduce((s, r) => s + (r.value || 0), 0) / slice.length;
    return { label: d.label, avg };
  });

  // Variance chips (SSP)
  const lastIdx = sspSeries.map(s => s.value).findLastIndex(v => v !== 0);
  const lastVal = lastIdx >= 0 ? sspSeries[lastIdx].value : null;
  const prevVal = lastIdx > 0 ? sspSeries[lastIdx - 1].value : null;
  const momPct =
    lastVal !== null && prevVal !== null && prevVal !== 0
      ? ((lastVal - prevVal) / prevVal) * 100
      : null;
  const yoyIdx = lastIdx - 12;
  const yoyVal =
    lastIdx >= 0 && yoyIdx >= 0 ? sspSeries[yoyIdx].value : null;
  const yoyPct =
    lastVal !== null && yoyVal !== null && yoyVal !== 0
      ? ((lastVal - yoyVal) / yoyVal) * 100
      : null;

  const tooltipFmt = (v: any) => nf0.format(Math.round(Number(v)));

  const bothEmpty =
    sspSeries.every((d) => !d.value) && usdSeries.every((d) => !d.value);

  // Ensure labels never clip at the top (dynamic headroom)
  const maxSSP = Math.max(0, ...sspSeries.map(d => d.value || 0));
  const maxUSD = Math.max(0, ...usdSeries.map(d => d.value || 0));
  const yMaxSSP = Math.ceil(maxSSP * 1.12);
  const yMaxUSD = Math.ceil(maxUSD * 1.18);

  /* ------------------------------ Handlers ------------------------------ */

  const handleBarClick = (index: number, currency: "SSP" | "USD") => {
    if (!onBarClick) return;
    const bucket = months[index];
    if (bucket) onBarClick(bucket.y, bucket.m, currency);
  };

  /* -------------------------------- Render ------------------------------- */

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0 flex items-start justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Monthly Income
          </CardTitle>
          <div className="mt-1 text-sm text-slate-600">
            <span className="font-medium">YTD:</span>{" "}
            SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
          </div>

          <div className="mt-2 flex gap-2">
            {momPct !== null && (
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  momPct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                MoM {momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct).toFixed(1)}%
              </span>
            )}
            {yoyPct !== null && (
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  yoyPct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                YoY {yoyPct >= 0 ? "▲" : "▼"} {Math.abs(yoyPct).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => exportCSV(data)}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          Export CSV
        </button>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {bothEmpty ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
            No income recorded for this period.
          </div>
        ) : (
          <>
            {/* SSP chart */}
            <div aria-label="SSP monthly chart">
              <p className="text-sm font-medium text-slate-700 mb-2">SSP (Monthly)</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sspSeries}
                    margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={0}
                      angle={sspSeries.length > 6 ? -30 : 0}
                      textAnchor={sspSeries.length > 6 ? "end" : "middle"}
                      height={sspSeries.length > 6 ? 42 : 20}
                    />
                    <YAxis
                      domain={[0, yMaxSSP]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v)
                      }
                    />
                    <Line
                      type="monotone"
                      data={sspRolling}
                      dataKey="avg"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      name="3-mo avg"
                    />
                    {typeof monthlySSPTarget === "number" && monthlySSPTarget > 0 && (
                      <ReferenceLine
                        y={monthlySSPTarget}
                        stroke="#0ea5e9"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Target: SSP ${nf0.format(monthlySSPTarget)}`,
                          position: "right",
                          fill: "#0ea5e9",
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Tooltip
                      formatter={(v) => [`SSP ${tooltipFmt(v as number)}`, ""]}
                      labelFormatter={(l) => l as string}
                    />
                    <Bar
                      dataKey="value"
                      name="SSP"
                      fill="#14b8a6"
                      radius={[4, 4, 0, 0]}
                      minPointSize={2}
                      maxBarSize={32}
                      onClick={(_, index) => handleBarClick(index, "SSP")}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                        offset={10}
                        formatter={(v: any) => nf0.format(Math.round(Number(v)))}
                        className="fill-slate-700 text-[11px]"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* USD chart */}
            <div aria-label="USD monthly chart">
              <p className="text-sm font-medium text-slate-700 mb-2">USD (Monthly)</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={usdSeries}
                    margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      interval={0}
                      angle={usdSeries.length > 6 ? -30 : 0}
                      textAnchor={usdSeries.length > 6 ? "end" : "middle"}
                      height={usdSeries.length > 6 ? 42 : 20}
                    />
                    <YAxis
                      domain={[0, yMaxUSD]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${nf0.format(v / 1000)}k` : nf0.format(v)
                      }
                    />
                    <Tooltip
                      formatter={(v) => [`USD ${tooltipFmt(v as number)}`, ""]}
                      labelFormatter={(l) => l as string}
                    />
                    <Bar
                      dataKey="value"
                      name="USD"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                      minPointSize={2}
                      maxBarSize={32}
                      onClick={(_, index) => handleBarClick(index, "USD")}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                        offset={10}
                        formatter={(v: any) => nf0.format(Math.round(Number(v)))}
                        className="fill-slate-700 text-[11px]"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Totals row */}
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
          </>
        )}

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading monthly income…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
