'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/queryClient';

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const short = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

type Row = { name: string; total: number };

export default function SimpleExpenseBreakdown() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['expense-breakdown', 'overview'],
    queryFn: async () => {
      const res = await api.get('/api/expenses/breakdown?range=current-month');
      const rows: Row[] = Array.isArray(res?.data) ? res.data : [];
      return rows.map((r) => ({
        name: String(r?.name ?? '—'),
        total: Number(r?.total ?? 0),
      }));
    },
  });

  const total = useMemo(
    () => data.reduce((s: number, r: Row) => s + (r.total || 0), 0),
    [data]
  );

  // Nice max domain for a comfortable chart
  const max = useMemo(() => {
    const m = Math.max(0, ...data.map((r: Row) => r.total || 0));
    if (m <= 0) return 4;
    const order = Math.pow(10, Math.floor(Math.log10(m)));
    const frac = m / order;
    const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
    return step * order * 1.1; // add 10% headroom
  }, [data]);

  return (
    <Card className="border-0 shadow-md bg-white h-full self-start">
      {/* Align with Revenue Analytics (no extra top padding) */}
      <CardHeader className="px-4 pt-2 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
            Expenses Breakdown
          </CardTitle>
          <div className="text-xs rounded-full bg-slate-50 px-3 py-1 border border-slate-200 text-slate-700 tabular-nums">
            Total&nbsp;SSP {nf0.format(total)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-3">
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading expenses…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-500">No expense data for this period.</div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  type="number"
                  domain={[0, max]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => short.format(Number(v || 0))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#334155' }}
                  width={160} // keeps labels aligned & readable
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="total" radius={[4, 4, 4, 4]} fill="#60a5fa" maxBarSize={28}>
                  {/* value label at end of each bar */}
                  <LabelList
                    dataKey="total"
                    position="right"
                    className="fill-slate-700"
                    formatter={(v: number) => short.format(Number(v || 0))}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
