'use client';

import { useMemo, useState, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  selectedYear: number;   // four-digit
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

type TrendRow = {
  day?: number;
  dateISO?: string;
  date?: string;
  incomeSSP?: number;
  incomeUSD?: number;
  income?: number;
  amount?: number;
};

type TxRow = {
  id?: string | number;
  date?: string;
  createdAt?: string;
  currency?: 'SSP' | 'USD' | string;
  amount?: number;
  amountSSP?: number;
  amountUSD?: number;
  description?: string;
  department?: { id?: string | number; name?: string } | null;
  departmentName?: string;
};

/* --------------------------- Formatting -------------------------- */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function normalizedRange(range: TimeRange) {
  return range === 'month-select' ? 'current-month' : range;
}

/** Make y-axis spacing feel even and round. */
function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
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
function buildNiceTicks(maxVal: number) {
  if (maxVal <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(maxVal / 4);
  const max = step * 4;
  return { max, ticks: [0, step, step * 2, step * 3, max] };
}

/* --------------------------- Data fetchers ----------------------- */

/** Robust fetcher with fallbacks so we always get data even if the API ignores the range param. */
async function fetchIncomeTrendsDaily(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
): Promise<TrendRow[]> {
  const rng = normalizedRange(range);

  // Try #1: /api/income-trends/{y}/{m}?range=...
  const try1 = new URL(`/api/income-trends/${year}/${month}`, window.location.origin);
  try1.searchParams.set('range', rng);
  if (range === 'custom' && start && end) {
    try1.searchParams.set('startDate', format(start, 'yyyy-MM-dd'));
    try1.searchParams.set('endDate', format(end, 'yyyy-MM-dd'));
  }
  try {
    const r1 = await api.get(try1.toString());
    if (Array.isArray(r1.data) && r1.data.length) return r1.data as TrendRow[];
  } catch {}

  // Try #2: ?period=...
  const try2 = new URL(`/api/income-trends/${year}/${month}`, window.location.origin);
  try2.searchParams.set('period', rng);
  try {
    const r2 = await api.get(try2.toString());
    if (Array.isArray(r2.data) && r2.data.length) return r2.data as TrendRow[];
  } catch {}

  // Try #3: no period param
  const try3 = new URL(`/api/income-trends/${year}/${month}`, window.location.origin);
  try {
    const r3 = await api.get(try3.toString());
    if (Array.isArray(r3.data) && r3.data.length) return r3.data as TrendRow[];
  } catch {}

  // Try #4: flat style: /api/income-trends?year=&month=
  const try4 = new URL('/api/income-trends', window.location.origin);
  try4.searchParams.set('year', String(year));
  try4.searchParams.set('month', String(month));
  try {
    const r4 = await api.get(try4.toString());
    if (Array.isArray(r4.data) && r4.data.length) return r4.data as TrendRow[];
  } catch {}

  // No luck — return empty array
  return [];
}

/** Fetch the list of income transactions for a specific ISO date. */
async function fetchTransactionsForDay(isoDate: string) {
  const url = new URL('/api/transactions', window.location.origin);
  url.searchParams.set('type', 'income');
  // Support both single-date and range styles
  url.searchParams.set('date', isoDate);
  url.searchParams.set('start', isoDate);
  url.searchParams.set('end', isoDate);

  const { data } = await api.get(url.toString());
  return Array.isArray(data) ? (data as TxRow[]) : [];
}

/* ------------------------------ Tooltip -------------------------- */

function RevenueTooltip({
  active,
  payload,
  year,
  month,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  year: number;
  month: number;
  currency: 'SSP' | 'USD';
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload?.day as number | undefined;
  const value = Number(payload[0]?.payload?.value ?? 0);
  const dateStr =
    typeof d === 'number'
      ? format(new Date(year, month - 1, d), 'MMM d, yyyy')
      : '';

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
      <div className="font-semibold text-slate-900 mb-1">{dateStr}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {compact.format(Math.round(value))}
      </div>
    </div>
  );
}

/* ------------------------------ Component ------------------------ */

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
  const baseDays = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      'exec-daily-income',
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
  });

  // Build continuous series
  const ssp = baseDays.map((day) => ({ day, value: 0 }));
  const usd = baseDays.map((day) => ({ day, value: 0 }));

  for (const r of raw) {
    let d = r.day;
    if (!d && r.dateISO) d = new Date(r.dateISO).getDate();
    if (!d && r.date) d = new Date(r.date).getDate();
    if (typeof d === 'number' && d >= 1 && d <= days) {
      ssp[d - 1].value += Number(r.incomeSSP ?? r.income ?? r.amount ?? 0);
      usd[d - 1].value += Number(r.incomeUSD ?? 0);
    }
  }

  const totalSSP = ssp.reduce((s, r) => s + r.value, 0);
  const totalUSD = usd.reduce((s, r) => s + r.value, 0);

  const activeDaysSSP = ssp.filter((d) => d.value > 0).length || 0;
  const activeDaysUSD = usd.filter((d) => d.value > 0).length || 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(Math.max(0, ...ssp.map((d) => d.value)));
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(Math.max(0, ...usd.map((d) => d.value)));

  const [open, setOpen] = useState(false);
  const [clickedDay, setClickedDay] = useState<number | null>(null);
  const isoForDay = clickedDay
    ? format(new Date(year, month - 1, clickedDay), 'yyyy-MM-dd')
    : null;

  const { data: dayTx = [], isFetching: loadingDay } = useQuery({
    enabled: !!isoForDay && open,
    queryKey: ['day-income-transactions', isoForDay],
    queryFn: () => fetchTransactionsForDay(isoForDay as string),
  });

  const byDept = useMemo(() => {
    const map = new Map<string, { ssp: number; usd: number; rows: TxRow[] }>();
    for (const t of dayTx) {
      const dept = t.department?.name || t.departmentName || 'Unspecified';
      const entry = map.get(dept) || { ssp: 0, usd: 0, rows: [] };
      const cur = String(t.currency || '').toUpperCase();
      const value =
        typeof t.amount === 'number'
          ? t.amount
          : cur === 'USD'
          ? Number(t.amountUSD ?? 0)
          : Number(t.amountSSP ?? 0);
      if (cur === 'USD') entry.usd += value;
      else entry.ssp += value;
      entry.rows.push(t);
      map.set(dept, entry);
    }
    return Array.from(map.entries())
      .map(([dept, v]) => ({ dept, ...v }))
      .sort((a, b) => b.ssp + b.usd - (a.ssp + a.usd));
  }, [dayTx]);

  const onBarClick = useCallback((payload: any) => {
    const d = payload?.activeLabel ?? payload?.payload?.day;
    if (typeof d === 'number' && d >= 1 && d <= days) {
      setClickedDay(d);
      setOpen(true);
    }
  }, [days]);

  const monthLabel = format(new Date(year, month - 1, 1), 'MMM yyyy');
  const renderSSPTooltip = (p: any) => (
    <RevenueTooltip {...p} year={year} month={month} currency="SSP" />
  );
  const renderUSDTooltip = (p: any) => (
    <RevenueTooltip {...p} year={year} month={month} currency="USD" />
  );

  return (
    <>
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
                  onClick={(state) => onBarClick(state?.activePayload?.[0])}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    interval={0}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, yMaxSSP]}
                    ticks={ticksSSP}
                    tick={{ fontSize: 11, fill: '#64748b' }}
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
                  onClick={(state) => onBarClick(state?.activePayload?.[0])}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    interval={0}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickMargin={8}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, yMaxUSD]}
                    ticks={ticksUSD}
                    tick={{ fontSize: 11, fill: '#64748b' }}
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

      {/* Day details */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {clickedDay
                ? `${format(new Date(year, month - 1, clickedDay), 'MMM d, yyyy')} • SSP & USD breakdown`
                : 'Day breakdown'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detailed income for the selected day grouped by department
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-600">Totals for the day</div>
              <div className="font-medium text-slate-900">
                SSP {nf0.format(byDept.reduce((s, d) => s + d.ssp, 0))}
                <span className="mx-2">•</span>
                USD {nf0.format(byDept.reduce((s, d) => s + d.usd, 0))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                By Department
              </div>

              {loadingDay ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : byDept.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No income recorded for this day.
                </div>
              ) : (
                <div className="space-y-2">
                  {byDept.map((d) => (
                    <div
                      key={d.dept}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div className="font-medium text-slate-800">{d.dept}</div>
                      <div className="text-sm tabular-nums text-slate-700">
                        <span className="mr-3">SSP {nf0.format(d.ssp)}</span>
                        <span>USD {nf0.format(d.usd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
