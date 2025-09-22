'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/queryClient';

/* ----------------------------- Types ----------------------------- */

type TimeRange =
  | 'current-month'
  | 'last-month'
  | 'month-select'
  | 'last-3-months'
  | 'year'
  | 'custom';

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // e.g. 2025
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------ Number Formatters ---------------------- */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/* ----------------------------- Utils ----------------------------- */

function daysInMonth(y: number, m: number) {
  // m is 1..12
  return new Date(y, m, 0).getDate();
}

function effectiveYearMonth(
  timeRange: TimeRange,
  selectedYear: number,
  selectedMonth: number
) {
  if (timeRange === 'last-month') {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  // for current-month and month-select we use the given month
  return { year: selectedYear, month: selectedMonth };
}

function normalizedRange(range: TimeRange) {
  // the API already understands last-month; we only collapse month-select
  return range === 'month-select' ? 'current-month' : range;
}

async function fetchIncomeTrendsDaily(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let url = `/api/income-trends/${year}/${month}?range=${normalizedRange(range)}`;
  if (range === 'custom' && start && end) {
    url += `&startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(
      end,
      'yyyy-MM-dd'
    )}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/* --------------------- Nice ticks for Y-axis --------------------- */

function niceStep(roughStep: number) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

function buildNiceTicks(dataMax: number, preferredCap: number) {
  // Start with a preferred cap (6M or 1.5k), but auto-bump if needed
  const cap = Math.max(preferredCap, dataMax);
  const step = niceStep(cap / 4);
  const max = step * 4;
  return { max, ticks: [0, step, step * 2, step * 3, max] };
}

/* ------------------------ Mobile/size helpers -------------------- */

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpoint]);
  return isMobile;
}

function useNonZeroSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setReady(width > 0 && height > 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ready };
}

/* ------------------------- Tooltip component --------------------- */

type RTProps = {
  active?: boolean;
  payload?: any[];
  year: number;
  month: number; // 1..12
  currency: 'SSP' | 'USD';
};

function RevenueTooltip({ active, payload, year, month, currency }: RTProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload?.day as number | undefined;
  const value = Number(payload[0]?.payload?.value ?? 0);
  const dateStr =
    typeof d === 'number' && Number.isFinite(d)
      ? format(new Date(year, month - 1, d), 'MMM d, yyyy')
      : '';

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
      <div className="font-semibold text-slate-900 mb-1">{dateStr}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {nf0.format(Math.round(value))}
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
  const isMobile = useIsMobile(768);
  const { ref: sspBoxRef, ready: sspReady } = useNonZeroSize();
  const { ref: usdBoxRef, ready: usdReady } = useNonZeroSize();

  // Use *effective* month/year so “Last Month” actually shifts both API and axis.
  const { year, month } = useMemo(
    () => effectiveYearMonth(timeRange, selectedYear, selectedMonth),
    [timeRange, selectedYear, selectedMonth]
  );

  const days = daysInMonth(year, month);
  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      'exec-daily-income-v2',
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    keepPreviousData: true,
  });

  // Build continuous series (zeros for missing days)
  const { ssp, usd, totals } = useMemo(() => {
    const sspArr = baseDays.map((day) => ({ day, value: 0 }));
    const usdArr = baseDays.map((day) => ({ day, value: 0 }));

    for (const r of raw as any[]) {
      let d: number | undefined = r?.day;
      if (!d && r?.dateISO) d = new Date(r.dateISO).getDate();
      if (!d && r?.date) d = new Date(r.date).getDate();
      if (!Number.isFinite(d) || d! < 1 || d! > days) continue;

      sspArr[d! - 1].value += Number(r?.incomeSSP ?? r?.income ?? r?.amount ?? 0) || 0;
      usdArr[d! - 1].value += Number(r?.incomeUSD ?? 0) || 0;
    }

    const totalSSP = sspArr.reduce((s, r) => s + r.value, 0);
    const totalUSD = usdArr.reduce((s, r) => s + r.value, 0);
    const activeSSP = sspArr.filter((d) => d.value > 0).length || 0;
    const activeUSD = usdArr.filter((d) => d.value > 0).length || 0;

    return {
      ssp: sspArr,
      usd: usdArr,
      totals: {
        ssp: totalSSP,
        usd: totalUSD,
        avgSSP: activeSSP ? Math.round(totalSSP / activeSSP) : 0,
        avgUSD: activeUSD ? Math.round(totalUSD / activeUSD) : 0,
        maxSSP: Math.max(0, ...sspArr.map((d) => d.value)),
        maxUSD: Math.max(0, ...usdArr.map((d) => d.value)),
      },
    };
  }, [raw, baseDays, days]);

  /* -------- axis/ticks: your preferred caps with auto-bump -------- */

  const sspCapPreferred = 6_000_000;  // 6M
  const usdCapPreferred = 1_500;      // 1.5k

  const { max: yMaxSSP, ticks: ticksSSP } = useMemo(
    () => buildNiceTicks(totals.maxSSP, sspCapPreferred),
    [totals.maxSSP]
  );
  const { max: yMaxUSD, ticks: ticksUSD } = useMemo(
    () => buildNiceTicks(totals.maxUSD, usdCapPreferred),
    [totals.maxUSD]
  );

  // Safe tick formatters – never render "NaN"
  const safeXTick = (v: any) =>
    Number.isFinite(+v) ? String(v) : '';
  const safeYTick = (v: any) =>
    Number.isFinite(+v) ? compact.format(+v) : '';

  // Typography / spacing
  const chartHeight = isMobile ? 260 : 340;
  const sspBarSize = isMobile ? 16 : 24;
  const usdBarSize = isMobile ? 16 : 24;
  const xTickFont = isMobile ? 11 : 12;
  const yTickFont = isMobile ? 11 : 12;
  const xTickMargin = isMobile ? 4 : 8;

  const monthLabel = format(new Date(year, month - 1, 1), 'MMM yyyy');

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {monthLabel} · SSP {nf0.format(totals.ssp)} · USD {nf0.format(totals.usd)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP Daily */}
        <section aria-label="SSP daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totals.ssp)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">SSP {nf0.format(totals.avgSSP)}</span>
            </span>
          </div>
          <div ref={sspBoxRef} className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            {sspReady && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ssp}
                  margin={{ top: 8, right: 12, left: 12, bottom: 18 }}
                  barCategoryGap="26%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    type="number"
                    allowDecimals={false}
                    tickFormatter={safeXTick}
                    tick={{ fontSize: xTickFont, fill: '#64748b' }}
                    tickMargin={xTickMargin}
                    axisLine={false}
                    tickLine={false}
                    domain={[1, days]}
                  />
                  <YAxis
                    domain={[0, yMaxSSP]}
                    ticks={ticksSSP}
                    tick={{ fontSize: yTickFont, fill: '#64748b' }}
                    tickFormatter={safeYTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={(p) => <RevenueTooltip {...p} year={year} month={month} currency="SSP" />} />
                  <Bar
                    dataKey="value"
                    name="SSP"
                    fill="#14b8a6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={sspBarSize}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* USD Daily */}
        <section aria-label="USD daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totals.usd)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">USD {nf0.format(totals.avgUSD)}</span>
            </span>
          </div>
          <div ref={usdBoxRef} className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            {usdReady && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={usd}
                  margin={{ top: 8, right: 12, left: 12, bottom: 18 }}
                  barCategoryGap="26%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    type="number"
                    allowDecimals={false}
                    tickFormatter={safeXTick}
                    tick={{ fontSize: xTickFont, fill: '#64748b' }}
                    tickMargin={xTickMargin}
                    axisLine={false}
                    tickLine={false}
                    domain={[1, days]}
                  />
                  <YAxis
                    domain={[0, yMaxUSD]}
                    ticks={ticksUSD}
                    tick={{ fontSize: yTickFont, fill: '#64748b' }}
                    tickFormatter={safeYTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={(p) => <RevenueTooltip {...p} year={year} month={month} currency="USD" />} />
                  <Bar
                    dataKey="value"
                    name="USD"
                    fill="#0ea5e9"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={usdBarSize}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">Loading daily revenue…</div>
        )}
      </CardContent>
    </Card>
  );
}
