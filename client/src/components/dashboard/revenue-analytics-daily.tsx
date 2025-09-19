'use client';

import { useMemo, useEffect, useState } from "react";
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

/* ----------------------------- Types ----------------------------- */

type TimeRange =
  | "current-month"
  | "last-month"
  | "month-select"
  | "last-3-months"
  | "year"
  | "custom";

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // e.g. 2025
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------ Number Formatters ---------------------- */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* ----------------------------- Utils ----------------------------- */

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1..12
}

function normalizedRange(range: TimeRange) {
  return range === "month-select" ? "current-month" : range;
}

async function fetchIncomeTrendsDaily(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let url = `/api/income-trends/${year}/${month}?range=${normalizedRange(range)}`;
  if (range === "custom" && start && end) {
    url += `&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(
      end,
      "yyyy-MM-dd"
    )}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/* --------------------- Nice ticks for Y-axis --------------------- */
/** Return a "nice" step (1, 2, 2.5, 5, 10 × 10^n) for a given rough step. */
function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;

  // include 2.5 to get 250/2.5k/etc when needed
  if (frac <= 1)        niceFrac = 1;
  else if (frac <= 2)   niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5)   niceFrac = 5;
  else                  niceFrac = 10;

  return niceFrac * base;
}

/** Build 5 ticks (0..max) with a nice step so spacing/labels look right. */
function buildNiceTicks(dataMax: number) {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(dataMax / 4);
  const max = step * 4;
  const ticks = [0, step, step * 2, step * 3, max];
  return { max, ticks };
}

/* ------------------------ Mobile helper hook --------------------- */

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

/* ------------------------- Tooltip component --------------------- */

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

/* ------------------------------- Main ---------------------------- */

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
  const isMobile = useIsMobile(768); // treat <= 768px as mobile/tablet

  // X-axis label density for mobile vs desktop
  const desiredXTicks = isMobile ? 12 : days; // ~12 labels on mobile, all on desktop
  const xInterval = Math.max(0, Math.ceil(days / desiredXTicks) - 1);
  const xTickFont = isMobile ? 10 : 11;
  const xTickMargin = isMobile ? 4 : 8;
  const chartHeightClass = isMobile ? "h-52" : "h-56";
  const sspBarSize = isMobile ? 14 : 18;
  const usdBarSize = isMobile ? 14 : 18;

  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      "exec-daily-income",
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
  });

  // Continuous series with zeros for missing days (SSP & USD)
  const ssp = baseDays.map((day) => ({ day, value: 0 }));
  const usd = baseDays.map((day) => ({ day, value: 0 }));

  for (const r of raw as any[]) {
    let d: number | undefined = (r as any).day;
    if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
    if (!d && (r as any).date) d = new Date((r as any).date).getDate();

    if (typeof d === "number" && d >= 1 && d <= days) {
      ssp[d - 1].value += Number(
        (r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0
      );
      usd[d - 1].value += Number((r as any).incomeUSD ?? 0);
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
          <div className={`${chartHeightClass} rounded-lg border border-slate-200`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ssp}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={xInterval}            // fewer labels on mobile
                  minTickGap={isMobile ? 2 : 0}   // let recharts drop a few if tight
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
                  maxBarSize={sspBarSize}
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
          <div className={`${chartHeightClass} rounded-lg border border-slate-200`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usd}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
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
                  maxBarSize={usdBarSize}
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
