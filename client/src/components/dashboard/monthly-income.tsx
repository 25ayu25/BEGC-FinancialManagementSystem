'use client';

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
  ReferenceLine,
  LabelList,
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
  selectedYear: number;
  selectedMonth: number;
  customStartDate?: Date;
  customEndDate?: Date;
  monthlySSPTarget?: number;
  onBarClick?: (year: number, month: number, currency: "SSP" | "USD") => void;
};

/* ----------------------------- Constants ------------------------------ */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* -------------------------------- Utils -------------------------------- */

const normCurrency = (x: any) =>
  String(x ?? "SSP").replace(/[^a-z]/gi, "").toUpperCase();

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

/* --------------------------- Nice tick helpers -------------------------- */

function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;
  if (frac <= 1)        niceFrac = 1;
  else if (frac <= 2)   niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5)   niceFrac = 5;
  else                  niceFrac = 10;
  return niceFrac * base;
}
function buildNiceTicks(max: number) {
  if (max <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(max / 4);
  const niceMax = step * 4;
  return { max: niceMax, ticks: [0, step, step * 2, step * 3, niceMax] };
}

/* ------------------------------ Tooltip UI ------------------------------ */

function MonthTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  currency: "SSP" | "USD";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  const label: string = p?.label ?? "";
  const value = Number(p?.value ?? 0);

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[160px]">
      <div className="font-semibold text-slate-900 mb-1">{label}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {nf0.format(Math.round(value))}
      </div>
    </div>
  );
}

/* --------------------------- Value labels ------------------------------- */

function ValueLabel(props: any) {
  const { x, y, width, value } = props;
  const v = Number(value || 0);
  if (v <= 0 || typeof x !== "number" || typeof y !== "number") return null;
  const cx = x + width / 2;
  const cy = y - 6;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={10}
      fill="#475569"
      className="pointer-events-none select-none"
    >
      {compact.format(v)}
    </text>
  );
}
function ValueLabelFull(props: any) {
  const { x, y, width, value } = props;
  const v = Number(value || 0);
  if (v <= 0 || typeof x !== "number" || typeof y !== "number") return null;
  const cx = x + width / 2;
  const cy = y - 6;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      fontSize={10}
      fill="#475569"
      className="pointer-events-none select-none"
    >
      {nf0.format(v)}
    </text>
  );
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
      "monthly-income-v7",
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
        map.set(key, { label: MONTH_SHORT[m - 1], ssp: 0, usd: 0 });
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
    // Small stability/perf wins:
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const sspSeries = data.map(({ label, ssp }) => ({ label, value: Number(ssp) || 0 }));
  const usdSeries = data.map(({ label, usd }) => ({ label, value: Number(usd) || 0 }));

  const totalSSP = sspSeries.reduce((s, r) => s + r.value, 0);
  const totalUSD = usdSeries.reduce((s, r) => s + r.value, 0);

  const activeMonthsSSP = sspSeries.filter(d => d.value > 0).length || 0;
  const activeMonthsUSD = usdSeries.filter(d => d.value > 0).length || 0;
  const avgMoSSP = activeMonthsSSP ? Math.round(totalSSP / activeMonthsSSP) : 0;
  const avgMoUSD = activeMonthsUSD ? Math.round(totalUSD / activeMonthsUSD) : 0;

  const sspRolling = sspSeries.map((d, i, arr) => {
    const start = Math.max(0, i - 2);
    const slice = arr.slice(start, i + 1);
    const sum = slice.reduce((s, r) => s + r.value, 0);
    return { label: d.label, avg: slice.length ? sum / slice.length : 0 };
  });

  const maxSSP = Math.max(0, ...sspSeries.map(d => d.value));
  const maxUSD = Math.max(0, ...usdSeries.map(d => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(maxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(maxUSD);

  const handleBarClick = (index: number, currency: "SSP" | "USD") => {
    if (!onBarClick) return;
    const bucket = computeWindow(
      timeRange,
      selectedYear,
      selectedMonth,
      customStartDate,
      customEndDate
    )[index];
    if (bucket) onBarClick(bucket.y, bucket.m, currency);
  };

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Monthly Income
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP Monthly */}
        <section aria-label="SSP monthly">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              <span className="mx-2">•</span>
              Avg/mo: <span className="font-semibold">SSP {nf0.format(avgMoSSP)}</span>
            </span>
          </div>

          {/* min-w-0 prevents flex overflow → resize loops */}
          <div className="h-64 rounded-lg border border-slate-200 min-w-0">
            <ResponsiveContainer width="100%" height="100%" debounce={250}>
              <BarChart
                data={sspSeries}
                margin={{ top: 24, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  angle={0}
                  textAnchor="middle"
                  height={20}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  ticks={ticksSSP}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => compact.format(v as number)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MonthTooltip currency="SSP" />} />
                <Line
                  type="monotone"
                  data={sspRolling}
                  dataKey="avg"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  name="3-mo avg"
                  isAnimationActive={false}
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
                <Bar
                  dataKey="value"
                  name="SSP"
                  fill="#14b8a6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                  onClick={(_, i) => handleBarClick(i, "SSP")}
                >
                  <LabelList content={(p) => <ValueLabel {...p} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD Monthly */}
        <section aria-label="USD monthly">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              <span className="mx-2">•</span>
              Avg/mo: <span className="font-semibold">USD {nf0.format(avgMoUSD)}</span>
            </span>
          </div>

          <div className="h-64 rounded-lg border border-slate-200 min-w-0">
            <ResponsiveContainer width="100%" height="100%" debounce={250}>
              <BarChart
                data={usdSeries}
                margin={{ top: 24, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  angle={0}
                  textAnchor="middle"
                  height={20}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  ticks={ticksUSD}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => nf0.format(v as number)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MonthTooltip currency="USD" />} />
                <Bar
                  dataKey="value"
                  name="USD"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                  onClick={(_, i) => handleBarClick(i, "USD")}
                >
                  <LabelList content={(p) => <ValueLabelFull {...p} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading monthly income…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
