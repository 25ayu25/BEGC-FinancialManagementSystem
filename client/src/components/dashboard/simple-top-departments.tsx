'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/queryClient';

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

type DeptRow = {
  name: string;
  total: number;
  percent: number; // 0..1
  avgPerDay?: number;
  color?: string;
};

export default function SimpleTopDepartments() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['top-departments', 'overview'],
    queryFn: async () => {
      const res = await api.get('/api/departments/top?range=current-month');
      // Expecting array of rows; fall back safely
      const rows: DeptRow[] = Array.isArray(res?.data) ? res.data : [];
      return rows
        .map((r) => ({
          name: String(r?.name ?? '—'),
          total: Number(r?.total ?? 0),
          percent: Number(r?.percent ?? 0),
          avgPerDay: Number(r?.avgPerDay ?? 0),
          color: r?.color || undefined,
        }))
        .slice(0, 6);
    },
  });

  return (
    <Card className="border-0 shadow-md bg-white h-full self-start">
      {/* Align with Revenue Analytics (no extra top padding) */}
      <CardHeader className="px-4 pt-2 pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Departments
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pt-3">
        <div className="space-y-4">
          {isLoading && (
            <div className="text-sm text-slate-500">Loading departments…</div>
          )}

          {!isLoading &&
            (data.length ? (
              data.map((row, i) => {
                const pct = Math.max(0, Math.min(1, row.percent || 0));
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            background:
                              row.color ||
                              ['#10b981', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#94a3b8'][i % 6],
                          }}
                        />
                        <span className="text-slate-700">{row.name}</span>
                      </div>
                      <div className="font-medium tabular-nums">
                        SSP {nf0.format(row.total)}
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full bg-slate-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${pct * 100}%`,
                          background:
                            row.color ||
                            ['#10b981', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#94a3b8'][i % 6],
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{(pct * 100).toFixed(1)}% of revenue</span>
                      {row.avgPerDay ? (
                        <span>Avg/day: SSP {nf0.format(row.avgPerDay)}</span>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500">No department data for this period.</div>
            ))}
        </div>

        {/* Total badge */}
        {!isLoading && data.length > 0 && (
          <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4 border border-emerald-100">
            <div className="flex items-center justify-between text-sm">
              <div className="text-emerald-700 font-medium">Total Revenue</div>
              <div className="text-emerald-700 font-semibold tabular-nums">
                SSP {nf0.format(data.reduce((s, r) => s + (r.total || 0), 0))}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-emerald-700/70">
              {data.length} active departments
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
