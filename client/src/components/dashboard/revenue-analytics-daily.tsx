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
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type TimeRange =
  | "current-month"
  | "last-month"
  | "month-select"
  | "last-3-months"
  | "year"
  | "custom";

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // 4-digit year
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------------------------------------------------ */
/* Intl formatters                                                    */
/* ------------------------------------------------------------------ */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function daysInMonth(year: number, month: number) {
  // month: 1..12
  return new Date(year, month, 0).getDate();
}

function monthBounds(year: number, month: number) {
  // month: 1..12
  const start = new Date(year, month - 1, 1);
  // inclusive end (set to last day 23:59:59 to avoid server-exclusive filters)
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function ymd(d: Date) {
  // yyyy-MM-dd
  return format(d, "yyyy-MM-dd");
}

/** Return a "nice" step (1, 2, **2.5**, 5, 10 × 10^n) for a given rough step. */
function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;

  // include 2.5 for 250/2.5k/25k style ticks
  if (frac <= 1)        niceFrac = 1;
  else if (frac <= 2)   niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5)   niceFrac = 5;
  else                  niceFrac = 10;

  return niceFrac * base;
}

/** Build 5 ticks (0..max) with a nice step so labels are round and spacing feels right. */
function buildNiceTicks(dataMax: number) {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(dataMax / 4);
  const max = step * 4;
  const ticks = [0, step, step * 2, step * 3, max];
  return { max, ticks };
}

/* ------------------------------------------------------------------ */
/* Normalization helpers                                              */
/* ------------------------------------------------------------------ */
type RawItem =
  | { day?: number; incomeSSP?: number; incomeUSD?: number; income?: number; amount?: number; currency?: string; date?: string; dateISO?: string }
  | any;

/** Turn heterogeneous API rows into {day, ssp, usd}. */
function normalizeDailyRows(items: RawItem[], daysInTarget: number) {
  const out = Array.from({ length: daysInTarget }, (_, i) => ({
    day: i + 1,
    ssp: 0,
    usd: 0,
  }));

  for (const r of items) {
    let d: number | undefined = (r as any).day;

    const rawDate = (r as any).dateISO ?? (r as any).date;
    if (!d && rawDate) {
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) d = dt.getDate();
    }

    // If still no day but we can guess from a transaction-like row, skip (we need a day)
    if (typeof d !== "number" || d < 1 || d > daysInTarget) continue;

    // Pull SSP & USD in a permissive way
    const sspCandidate =
      (r as any).incomeSSP ??
      (r as any).income ??
      ((r as any).currency === "SSP" ? (r as any).amount : undefined) ??
      0;

    const usdCandidate =
      (r as any).incomeUSD ??
      ((r as any).currency === "USD" ? (r as any).amount : undefined) ??
      0;

    out[d - 1].ssp += Number(sspCandidate || 0);
    out[d - 1].usd += Number(usdCandidate || 0);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* API fetch with robust fallbacks                                    */
/* ------------------------------------------------------------------ */
async function fetchIncomeTrendsDailyRobust(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let s: Date;
  let e: Date;

  if (range === "month-select") {
    const mb = monthBounds(year, month);
    s = mb.start;
    e = mb.end;
  } else if (range === "custom" && start && end) {
    s = start;
    e = end;
  } else {
    // default to selected month to be safe
    const mb = monthBounds(year, month);
    s = mb.start;
    e = mb.end;
  }

  const qsCustom = `range=custom&startDate=${ymd(s)}&endDate=${ymd(e)}`;

  // Try several URL shapes your backend may accept
  const candidates = [
    // explicit month path + custom dates
    `/api/income-trends/${year}/${month}?${qsCustom}`,
    // generic query
    `/api/income-trends?year=${year}&month=${month}&${qsCustom}`,
    // explicit month path + current-month (some servers expect this)
    `/api/income-trends/${year}/${month}?range=current-month`,
    // last resort: pull transactions and aggregate client-side
    // (we'll detect this one by checking the path and aggregating below)
    `/api/transactions?type=income&${qsCustom}`,
  ];

  for (const url of candidates) {
    try {
      const { data } = await api.get(url);

      // If this is the transactions fallback, aggregate it client-side
      if (url.startsWith("/api/transactions")) {
        if (Array.isArray(data) && data.length) {
          const normalized = normalizeDailyRows(data, daysInMonth(year, month));
          return normalized;
        }
        continue;
      }

      if (Array.isArray(data) && data.length) {
        const normalized = normalizeDailyRows(data, daysInMonth(year, month));
        return normalized;
      }
    } catch (err) {
      // swallow and try next
      // console.debug("fetch candidate failed", url, err);
    }
  }

  // Nothing worked
  return normalizeDailyRows([], daysInMonth(year, month));
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                            */
/* ------------------------------------------------------------------ */
type RTProps = {
  active?: boolean;
  payload?: any[];
  year: number;
  month: number; // 1..12
  currency: "SSP" | "USD";
};

function RevenueTooltip({ active, payload, year, month, currency }: RTProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload?.day as number | undefined;
  const value = Number(payload[0]?.payload?.value ?? 0);
  const dateStr =
    typeof d === "number"
      ? format(new Date(year, month - 1, d), "MMM d, yyyy")
      : "";

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
      <div className="font-semibold text-slate-900 mb-1">{dateStr}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {compact.format(Math.round(value))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const year = selectedYear;
  const month = selectedMonth;

  const days = daysInMonth(year, month);
  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data: daily = [], isLoading } = useQuery({
    queryKey: [
      "exec-daily-income-v2",
      year,
      month,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDailyRobust(year, month, timeRange, customStartDate, customEndDate),
  });

  // Build continuous series (SSP & USD)
  const ssp = baseDays.map((day) => ({ day, value: 0 }));
  const usd = baseDays.map((day) => ({ day, value: 0 }));

  for (const r of daily as any[]) {
    const d = Number(r.day);
    if (d >= 1 && d <= days) {
      ssp[d - 1].value += Number(r.ssp || 0);
      usd[d - 1].value += Number(r.usd || 0);
    }
  }

  const totalSSP = ssp.reduce((s, r) => s + r.value, 0);
  const totalUSD = usd.reduce((s, r) => s + r.value, 0);

  // "active-day" averages (ignores zero days)
  const activeDaysSSP = ssp.filter((d) => d.value > 0).length || 0;
  const activeDaysUSD = usd.filter((d) => d.value > 0).length || 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  // Nice ticks for even spacing & rounded labels
  const dataMaxSSP = Math.max(0, ...ssp.map((d) => d.value));
  const dataMaxUSD = Math.max(0, ...usd.map((d) => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(dataMaxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(dataMaxUSD);

  const monthLabel = format(new Date(year, month - 1, 1), "MMM yyyy");
  const renderSSPTooltip = (p: any) => (
    <RevenueTooltip {...p} year={year} month={month} currency="SSP" />
  );
  const renderUSDTooltip = (p: any) => (
    <RevenueTooltip {...p} year={year} month={month} currency="USD" />
  );

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {monthLabel} · SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP Daily */}
        <section aria-label="SSP daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">SSP {nf0.format(avgDaySSP)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ssp}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  ticks={ticksSSP}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => compact.format(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderSSPTooltip} />
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
        </section>

        {/* USD Daily */}
        <section aria-label="USD daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">USD {nf0.format(avgDayUSD)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usd}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  ticks={ticksUSD}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => compact.format(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderUSDTooltip} />
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
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading daily revenue…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
