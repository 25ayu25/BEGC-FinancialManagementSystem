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

// Props you already use:
// rows: Array<{ name: string; value: number }>
// title?: string
// periodLabel?: string
// total?: number
type Row = { name: string; value: number };

type Props = {
  rows: Row[];
  title?: string;
  periodLabel?: string; // e.g. 'This year' or 'Current month'
  total?: number;
};

/** --- Formatters -------------------------------------------------------- */
// One-decimal for millions; no-decimal for thousands; plain for smaller.
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
  if (n >= 1_000_000) return fmtMillions1.format(n); // 58.4M
  if (n >= 100_000) return fmtK0.format(n);          // 840K, 250K
  return fmt0.format(n);                              // 98,500 → 98,500
}

/** Keep Y-axis clean & readable with compact ticks */
function formatAxis(n: number) {
  return formatCompactSmart(n);
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
  const p = payload[0];
  const v = Number(p?.value ?? 0);
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[13px] font-medium text-slate-900">{label}</div>
      <div className="text-[12px] text-slate-600 font-mono">
        {formatCompactSmart(v)}
      </div>
    </div>
  );
}

export default function SimpleExpenseBreakdown({
  rows,
  title = 'Expenses Breakdown',
  periodLabel = '',
  total,
}: Props) {
  // Sort rows descending to keep big items at top (as you have now)
  const data = useMemo(
    () => [...rows].sort((a, b) => b.value - a.value),
    [rows]
  );

  const totalLabel =
    typeof total === 'number' ? formatCompactSmart(total) : undefined;

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

          {totalLabel && (
            <div className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 border border-slate-200">
              <span className="mr-1 text-slate-500">Total</span>
              <span className="font-semibold">{totalLabel}</span>
            </div>
          )}
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
                tickFormatter={formatAxis}
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
                // Keep your existing palette or brand color here:
                fill="#3b82f6"
                maxBarSize={26}
              >
                {/* right-aligned label with smarter compact format */}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: number) => formatCompactSmart(Number(v))}
                  style={{
                    fontSize: 11,
                    fill: '#475569',
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
