'use client';

import { useEffect, useMemo, useState } from "react";
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
/* Types & helpers                                                     */
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
  selectedYear: number;   // 4-digit year (e.g. 2025)
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function normalizedRange(range: TimeRange) {
  return range === "month-select" ? "current-month" : range;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [breakpoint]);
  return isMobile;
}

/** Return a "nice" step (1, 2, **2.5**, 5, 10 × 10^n) for a given rough step. */
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

/** Build 5 ticks (0..max) with a nice step so labels are round and spacing feels right. */
function buildNiceTicks(dataMax: number) {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(dataMax / 4);
  const max = step * 4;
  const ticks = [0, step, step * 2, step * 3, max];
  return { max, ticks };
}

/* ------------------------------------------------------------------ */
/* Data fetch                                                          */
/* ------------------------------------------------------------------ */

async function fetchIncomeTrendsMonthly(
  year: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  // If your backend uses a different endpoint, keep the URL you had and only reuse the rendering bits below.
  let url = `/api/income-trends/${year}?range=${normalizedRange(range)}`;
  if (range === "custom" && start && end) {
    url += `&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(end, "yyyy-MM-dd")}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

type TTProps = {
  active?: boolean;
  payload?: any[];
  year: number;
  currency: "SSP" | "USD";
};

function MonthTooltip({ active, payload, year, currency }: TTProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  const m = Number(p?.month);
  const value = Number(p?.value ?? 0);
  const label = isFinite(m) ? `${MONTHS_SHORT[m - 1]} ${year}` : "";

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[160px]">
      <div className="font-semibold text-slate-900 mb-1">{label}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {compact.format(Math.round(value))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function MonthlyIncome({
  timeRange,
  selectedYear,
  selectedMonth,        // not strictly needed for "year", but kept for parity
  customStartDate,
  customEndDate,
}: Props) {
  const year = selectedYear;
  const isMobile = useIsMobile(768);

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      "overview-monthly-income",
      year,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsMonthly(year, timeRange, customStartDate, customEndDate),
    staleTime: 60_000,
    retry: 1,
  });

  // Base 12 months
  const base = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: MONTHS_SHORT[i],
        ssp: 0,
        usd: 0,
      })),
    []
  );

  // Merge raw -> base
  for (const r of raw as any[]) {
    let m: number | undefined = (r as any).month;
    if (!m && (r as any).dateISO) m = new Date((r as any).dateISO).getMonth() + 1;
    if (!m && (r as any).date)    m = new Date((r as any).date).getMonth() + 1;
    if (typeof m === "number" && m >= 1 && m <= 12) {
      const idx = m - 1;
      base[idx].ssp += Number(
        (r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0
      );
      base[idx].usd += Number((r as any).incomeUSD ?? 0);
    }
  }

  // Split series for Recharts
  const sspSeries = base.map((b) => ({ month: b.month, label: b.label, value: b.ssp }));
  const usdSeries = base.map((b) => ({ month: b.month, label: b.label, value: b.usd }));

  const totalSSP = sspSeries.reduce((s, d) => s + d.value, 0);
  const totalUSD = usdSeries.reduce((s, d) => s + d.value, 0);
  const activeMonthsSSP = sspSeries.filter((d) => d.value > 0).length || 0;
  const activeMonthsUSD = usdSeries.filter((d) => d.value > 0).length || 0;
  const avgSSP = activeMonthsSSP ? Math.round(totalSSP / activeMonthsSSP) : 0;
  const avgUSD = activeMonthsUSD ? Math.round(totalUSD / activeMonthsUSD) : 0;

  // Nice ticks for even spacing & round values
  const dataMaxSSP = Math.max(0, ...sspSeries.map((d) => d.value));
  const dataMaxUSD = Math.max(0, ...usdSeries.map((d) => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(dataMaxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(dataMaxUSD);

  // Mobile x-axis density
  const desiredTicks = isMobile ? 6 : 12;
  const xInterval = Math.max(0, Math.ceil(12 / desiredTicks) - 1);
  const xTickFont = isMobile ? 10 : 11;
  const xTickMargin = isMobile ? 4 : 8;

  const renderSSPTooltip = (p: any) => (
    <MonthTooltip {...p} year={year} currency="SSP" />
  );
  const renderUSDTooltip = (p: any) => (
    <MonthTooltip {...p} year={year} currency="USD" />
  );

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Monthly Income
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          Key financials · {year} · SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP (Monthly) */}
        <section aria-label="SSP monthly">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              <span className="mx-2">•</span>
              Avg/month: <span className="font-semibold">SSP {nf0.format(avgSSP)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sspSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={xInterval}
                  minTickGap={isMobile ? 2 : 0}
                  tick={{ fontSize: xTickFont, fill: "#64748b" }}
                  tickMargin={xTickMargin}
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
                  maxBarSize={isMobile ? 14 : 18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD (Monthly) */}
        <section aria-label="USD monthly">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              <span className="mx-2">•</span>
              Avg/month: <span className="font-semibold">USD {nf0.format(avgUSD)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usdSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={xInterval}
                  minTickGap={isMobile ? 2 : 0}
                  tick={{ fontSize: xTickFont, fill: "#64748b" }}
                  tickMargin={xTickMargin}
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
                  maxBarSize={isMobile ? 14 : 18}
                />
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
