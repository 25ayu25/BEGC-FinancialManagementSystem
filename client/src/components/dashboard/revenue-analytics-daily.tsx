'use client';

import { useMemo } from 'react';
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

/* ------------------------------ Visual knobs ------------------------------ */
// Tweak these if you want the chart to look a bit bolder or denser later.
const chartHeight = 300;     // overall chart height (try 320–340 for taller bars)
const sspBarSize  = 22;      // SSP bar thickness
const usdBarSize  = 22;      // USD bar thickness
const xTickFont   = 11;      // X-axis font size
const yTickFont   = 11;      // Y-axis font size
const desiredXTicks = 16;    // how many day labels you want visible (approx.) // 12|16|24

/* --------------------------------- Types --------------------------------- */
type TimeRange =
  | 'current-month'
  | 'last-month'
  | 'month-select'
  | 'last-3-months'
  | 'year'
  | 'custom';

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // 4-digit year
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------------- Formatters ------------------------------- */
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/* --------------------------------- Utils --------------------------------- */
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1..12
}
const normCurrency = (x: any) =>
  String(x ?? 'SSP').replace(/[^a-z]/gi, '').toUpperCase();

/** Pull income transactions (with pagination) for a date span. */
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

/* --------------------------- Nice tick helpers ---------------------------- */
function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp  = Math.floor(Math.log10(roughStep));
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
  const step   = niceStep(max / 4);
  const niceMax = step * 4;
  return { max: niceMax, ticks: [0, step, step * 2, step * 3, niceMax] };
}

/* -------------------------------- Tooltip -------------------------------- */
function DayTooltip({
  active,
  payload,
  year,
  month,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  year: number;
  month: number; // 1..12
  currency: 'SSP' | 'USD';
}) {
  if (!active || !payload?.length) return null;
  const d     = Number(payload[0]?.payload?.day ?? 0);
  const value = Number(payload[0]?.payload?.value ?? 0);
  const label = d ? format(new Date(year, month - 1, d), 'MMM d, yyyy') : '';

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[160px]">
      <div className="font-semibold text-slate-900 mb-1">{label}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {nf0.format(Math.round(value))}
      </div>
    </div>
  );
}

/* --------------------------------- Main ---------------------------------- */
export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  // We only chart a single month in this component.
  // If a custom range is passed, we still anchor the charts to selectedYear/Month.
  const year  = selectedYear;
  const month = selectedMonth;
  const days  = daysInMonth(year, month);

  const xInterval = useMemo(() => {
    // approximate how many X labels we want:
    const step = Math.max(1, Math.round(days / desiredXTicks));
    // recharts uses "interval={n}" meaning "skip n labels"
    return Math.max(0, step - 1);
  }, [days]);

  const baseSSP = useMemo(
    () => Array.from({ length: days }, (_, i) => ({ day: i + 1, value: 0 })),
    [days]
  );
  const baseUSD = useMemo(
    () => Array.from({ length: days }, (_, i) => ({ day: i + 1, value: 0 })),
    [days]
  );

  // Start/end for the month (or custom if provided)
  const startDate = useMemo(
    () => (customStartDate ? customStartDate : new Date(year, month - 1, 1)),
    [year, month, customStartDate]
  );
  const endDate = useMemo(
    () => (customEndDate ? customEndDate : new Date(year, month, 0)),
    [year, month, customEndDate]
  );

  const { data = { ssp: baseSSP, usd: baseUSD }, isLoading } = useQuery({
    queryKey: [
      'exec-daily-income-v4',
      year,
      month,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      const rows = await fetchTransactions(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );

      const ssp = [...baseSSP];
      const usd = [...baseUSD];

      for (const t of rows as any[]) {
        const rawDate =
          t.dateISO || t.date || t.createdAt || t.created_at || t.timestamp;
        const d = rawDate ? new Date(rawDate) : null;
        if (!d || Number.isNaN(d.getTime())) continue;

        // keep only the transactions that fall into the selected month
        if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;

        const day = d.getDate();
        const amt = Number(t.amount ?? 0);
        const cur = normCurrency(t.currency);

        if (cur === 'USD') usd[day - 1].value += amt;
        else               ssp[day - 1].value += amt;
      }

      return { ssp, usd };
    },
  });

  const sspSeries = data.ssp;
  const usdSeries = data.usd;

  const totalSSP = sspSeries.reduce((s, r) => s + r.value, 0);
  const totalUSD = usdSeries.reduce((s, r) => s + r.value, 0);

  const activeDaysSSP = sspSeries.filter(d => d.value > 0).length || 0;
  const activeDaysUSD = usdSeries.filter(d => d.value > 0).length || 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  const maxSSP  = Math.max(0, ...sspSeries.map(d => d.value));
  const maxUSD  = Math.max(0, ...usdSeries.map(d => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(maxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(maxUSD);

  const monthLabel = format(new Date(year, month - 1, 1), 'MMM yyyy');

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

          <div className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sspSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={xInterval}
                  tick={{ fontSize: xTickFont, fill: '#64748b' }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  ticks={ticksSSP}
                  tick={{ fontSize: yTickFont, fill: '#64748b' }}
                  tickFormatter={(v) => compact.format(v as number)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DayTooltip year={year} month={month} currency="SSP" />} />
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

          <div className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usdSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={xInterval}
                  tick={{ fontSize: xTickFont, fill: '#64748b' }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  ticks={ticksUSD}
                  tick={{ fontSize: yTickFont, fill: '#64748b' }}
                  // USD shows full values (e.g., 1,523), not compact (1.5k)
                  tickFormatter={(v) => nf0.format(v as number)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DayTooltip year={year} month={month} currency="USD" />} />
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
          <div className="text-center text-slate-500 text-sm">Loading daily revenue…</div>
        )}
      </CardContent>
    </Card>
  );
}
