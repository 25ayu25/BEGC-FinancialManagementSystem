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
  LabelList,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/queryClient';

/* -------------------------------------------------------------------------- */
/* Types & helpers                                                            */
/* -------------------------------------------------------------------------- */
type TimeRange =
  | 'current-month'
  | 'last-month'
  | 'month-select'
  | 'last-3-months'
  | 'year'
  | 'custom';

type Props = {
  timeRange: TimeRange;
  selectedYear: number; // 4-digit year (e.g., 2025)
  selectedMonth?: number; // not used here, but harmless if provided
  customStartDate?: Date;
  customEndDate?: Date;
};

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function normalizedRange(range: TimeRange) {
  return range === 'month-select' ? 'current-month' : range;
}

/** Fetch monthly income trends for the selected year (and optional custom range). */
async function fetchIncomeTrendsMonthly(
  year: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let url = `/api/income-trends/${year}?range=${normalizedRange(range)}`;
  if (range === 'custom' && start && end) {
    url += `&startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(
      end,
      'yyyy-MM-dd'
    )}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/** niceStep includes 2.5 to get friendlier tick spacing (2.5k, 25k, 2.5M …). */
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

function buildNiceTicks(dataMax: number) {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(dataMax / 4);
  const max = step * 4;
  return { max, ticks: [0, step, step * 2, step * 3, max] };
}

/* ---------------------------- Bar value labels ---------------------------- */
function ValueLabelCompact(props: any) {
  const { x, y, width, value } = props;
  const v = Number(value || 0);
  if (v <= 0 || typeof x !== 'number' || typeof y !== 'number') return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
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
  if (v <= 0 || typeof x !== 'number' || typeof y !== 'number') return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={10}
      fill="#475569"
      className="pointer-events-none select-none"
    >
      {nf0.format(v)}
    </text>
  );
}

/* -------------------------------- Tooltip -------------------------------- */
type TTProps = {
  active?: boolean;
  payload?: any[];
  label?: any;
  year: number;
  currency: 'SSP' | 'USD';
};

function MonthTooltip({ active, payload, label, year, currency }: TTProps) {
  if (!active || !payload || !payload.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  // `label` is month index (1..12) because XAxis uses that for dataKey.
  const monthIdx = Number(label) || 1;
  const dateStr = format(new Date(year, monthIdx - 1, 1), 'MMM yyyy');

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
      <div className="font-semibold text-slate-900 mb-1">{dateStr}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {nf0.format(v)}
      </div>
    </div>
  );
}

/* -------------------------------- Component ------------------------------- */
export default function MonthlyIncome({
  timeRange,
  selectedYear,
  customStartDate,
  customEndDate,
}: Props) {
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1, // 1..12
        label: format(new Date(selectedYear, i, 1), 'MMM'),
      })),
    [selectedYear]
  );

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      'overview-monthly-income',
      selectedYear,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsMonthly(
        selectedYear,
        timeRange,
        customStartDate,
        customEndDate
      ),
  });

  // Base series
  const ssp = months.map((m) => ({ month: m.month, label: m.label, value: 0 }));
  const usd = months.map((m) => ({ month: m.month, label: m.label, value: 0 }));

  // Map incoming records
  for (const r of raw as any[]) {
    // Accept several possible shapes: { month }, { monthIndex }, { dateISO }, { date }
    let m: number | undefined =
      r.month ??
      r.monthIndex ??
      (r.dateISO ? new Date(r.dateISO).getMonth() + 1 : undefined) ??
      (r.date ? new Date(r.date).getMonth() + 1 : undefined);

    if (typeof m !== 'number' || m < 1 || m > 12) continue;

    const sspVal = Number(r.incomeSSP ?? r.ssp ?? r.amountSSP ?? 0);
    const usdVal = Number(r.incomeUSD ?? r.usd ?? r.amountUSD ?? 0);

    ssp[m - 1].value += sspVal;
    usd[m - 1].value += usdVal;
  }

  const totalSSP = ssp.reduce((s, d) => s + d.value, 0);
  const totalUSD = usd.reduce((s, d) => s + d.value, 0);

  // Monthly averages based on months with any value
  const activeMonthsSSP = ssp.filter((d) => d.value > 0).length || 0;
  const activeMonthsUSD = usd.filter((d) => d.value > 0).length || 0;
  const avgMoSSP = activeMonthsSSP ? Math.round(totalSSP / activeMonthsSSP) : 0;
  const avgMoUSD = activeMonthsUSD ? Math.round(totalUSD / activeMonthsUSD) : 0;

  const dataMaxSSP = Math.max(0, ...ssp.map((d) => d.value));
  const dataMaxUSD = Math.max(0, ...usd.map((d) => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(dataMaxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(dataMaxUSD);

  const renderSSPTooltip = (p: any) => (
    <MonthTooltip {...p} year={selectedYear} currency="SSP" />
  );
  const renderUSDTooltip = (p: any) => (
    <MonthTooltip {...p} year={selectedYear} currency="USD" />
  );

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Monthly Income
        </CardTitle>
        <div className="sr-only">
          {/* We keep this hidden line for accessibility; visible totals are per chart header below */}
          SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-10">
        {/* ------------------------------- SSP -------------------------------- */}
        <section aria-label="SSP (Monthly)">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total:{' '}
              <span className="font-semibold">
                SSP {nf0.format(totalSSP)}
              </span>
              <span className="mx-2">•</span>
              Avg/mo:{' '}
              <span className="font-semibold">
                SSP {nf0.format(avgMoSSP)}
              </span>
            </span>
          </div>

          <div className="h-64 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ssp}
                margin={{ top: 24, right: 16, left: 12, bottom: 22 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  interval={0}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(m) => ssp[(m as number) - 1]?.label ?? ''}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  ticks={ticksSSP}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => compact.format(v as number)} // compact for SSP
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderSSPTooltip} />
                <Bar dataKey="value" name="SSP" fill="#14b8a6" radius={[3, 3, 0, 0]} maxBarSize={28}>
                  {/* compact labels for SSP */}
                  <LabelList content={(p) => <ValueLabelCompact {...p} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ------------------------------- USD -------------------------------- */}
        <section aria-label="USD (Monthly)">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Monthly)</p>
            <span className="text-xs text-slate-500">
              Total:{' '}
              <span className="font-semibold">
                USD {nf0.format(totalUSD)}
              </span>
              <span className="mx-2">•</span>
              Avg/mo:{' '}
              <span className="font-semibold">
                USD {nf0.format(avgMoUSD)}
              </span>
            </span>
          </div>

          <div className="h-64 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usd}
                margin={{ top: 24, right: 16, left: 12, bottom: 22 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  interval={0}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(m) => usd[(m as number) - 1]?.label ?? ''}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  ticks={ticksUSD}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => nf0.format(v as number)} // FULL numbers for USD
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderUSDTooltip} />
                <Bar dataKey="value" name="USD" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={28}>
                  {/* FULL labels for USD */}
                  <LabelList content={(p) => <ValueLabelFull {...p} />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">Loading monthly income…</div>
        )}
      </CardContent>
    </Card>
  );
}
