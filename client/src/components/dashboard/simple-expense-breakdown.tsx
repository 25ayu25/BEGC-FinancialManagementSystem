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
  /** Optional total; if omitted we sum rows safely. */
  total?: number;
};

/* --------------------------- Smart number format --------------------------- */
// one decimal for millions, none for thousands; plain for smaller.
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
  if (n >= 1_000_000) return fmtMillions1.format(n); // 58.4M
  if (n >= 100_000) return fmtK0.format(n);          // 840K, 250K
  return fmt0.format(n);                              // 98,500 → 98,500
}

/* ------------------------------ Normalization ----------------------------- */

function normalizeRows(maybeRows: Props['rows']): Row[] {
  // Allow { rows: [...] } or direct array, otherwise empty
  const arr =
    (Array.isArray(maybeRows) ? maybeRows
      : (maybeRows && typeof maybeRows === 'object' && Array.isArray((maybeRows as any).rows))
        ? (maybeRows as any).rows
        : []) as unknown[];

  // Ensure each item has the correct structure
  return arr
    .filter(Boolean)
    .map((r: any) => ({
      name: String(r?.name ?? ''),
      value: Number(r?.value ?? 0),
    }))
    .filter((r) => r.name.length > 0 && Number.isFinite(r.value));
}

/* ------------------------------- Tooltip ---------------------------------- */

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

/* -------------------------------- Component ------------------------------- */

export default function SimpleExpenseBreakdown({
  rows,
  title = 'Expenses Breakdown',
  periodLabel = '',
  total,
}: Props) {
  // Normalize + sort safely even if rows is undefined/null/wrong shape
  const data = useMemo(() => {
    const safe = normalizeRows(rows);
    safe.sort((a, b) => b.value - a.value);
    return safe;
  }, [rows]);

  // If no total provided, compute it safely
  const safeTotal =
    typeof total === 'number'
      ? total
      : data.reduce((sum, r) => (Number.isFinite(r.value) ? sum + r.value : sum), 0);

  const totalLabel = formatCompactSmart(safeTotal);

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
        <div className="h-[360px] md:h-[420px]">
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
              <Bar
                dataKey="value"
                radius={[6, 6, 6, 6]}
                fill="#3b82f6"
                maxBarSize={26}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: number) => formatCompactSmart(Number(v))}
                  style={{ fontSize: 11, fill: '#475569' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
