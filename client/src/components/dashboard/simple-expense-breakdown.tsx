'use client';

import { useMemo } from 'react';
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

type Row = { name: string; value: number };

type Props = {
  /** Can be Row[], { rows: Row[] }, null, or undefined (we'll normalize). */
  rows?: Row[] | { rows: Row[] } | null;
  title?: string;
  periodLabel?: string; // e.g. 'This year' / 'Current month'
  total?: number;
  isLoading?: boolean;
};

/* -------- smart number formatting: 58.4M / 840K / 98,500 -------- */
const fmtMillions1 = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmtK0 = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 0,
});
const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatCompactSmart(n: number) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return fmtMillions1.format(n);
  if (n >= 100_000) return fmtK0.format(n);
  return fmt0.format(n);
}

/* ---------------- normalization (safe even if rows is undefined) --------- */
function normalizeRows(maybeRows: Props['rows']): Row[] {
  const arr =
    (Array.isArray(maybeRows)
      ? maybeRows
      : (maybeRows && typeof maybeRows === 'object' && Array.isArray((maybeRows as any).rows))
      ? (maybeRows as any).rows
      : []) as unknown[];

  return arr
    .filter(Boolean)
    .map((r: any) => ({ name: String(r?.name ?? ''), value: Number(r?.value ?? 0) }))
    .filter((r) => r.name.length > 0 && Number.isFinite(r.value));
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[13px] font-medium text-slate-900">{label}</div>
      <div className="text-[12px] text-slate-600 font-mono">{formatCompactSmart(v)}</div>
    </div>
  );
}

export default function SimpleExpenseBreakdown({
  rows,
  title = 'Expenses Breakdown',
  periodLabel = '',
  total,
  isLoading = false,
}: Props) {
  const data = useMemo(() => {
    const safe = normalizeRows(rows);
    safe.sort((a, b) => b.value - a.value);
    return safe;
  }, [rows]);

  const safeTotal =
    typeof total === 'number'
      ? total
      : data.reduce((sum, r) => (Number.isFinite(r.value) ? sum + r.value : sum), 0);

  const totalLabel = formatCompactSmart(safeTotal);
  const hasData = data.length > 0;

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
              {title}
            </CardTitle>
            {periodLabel && (
              <div className="mt-1 text-xs text-slate-500">{periodLabel}</div>
            )}
          </div>
          <div className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 border border-slate-200">
            <span className="mr-1 text-slate-500">Total</span>
            <span className="font-semibold">{totalLabel}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="h-[360px] md:h-[420px] rounded-lg border border-slate-200">
          {isLoading ? (
            /* simple skeleton */
            <div className="h-full animate-pulse grid grid-rows-6 gap-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 bg-slate-100 rounded" />
              ))}
            </div>
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 24, bottom: 4 }}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactSmart(Number(v))}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={180}
                  tick={{ fontSize: 12, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TooltipContent />} />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} fill="#3b82f6" maxBarSize={26}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: number) => formatCompactSmart(Number(v))}
                    style={{ fontSize: 11, fill: '#475569' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            /* graceful empty state */
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No expense data for the selected period.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
