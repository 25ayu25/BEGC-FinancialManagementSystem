'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { api } from '@/lib/queryClient';

type Stage = 'submitted' | 'in_review' | 'approved' | 'paid' | 'rejected';

type ByState = Partial<
  Record<
    Stage,
    {
      count: number;
      amount: number; // USD
    }
  >
>;

type Summary = {
  period?: string;
  currency?: string;
  outstanding: number;     // not yet paid
  paidPeriod: number;      // paid during this filtered period
  totalAllStages: number;  // all claims amounts in any state for the period
  byState: ByState;
};

type Props = {
  className?: string;
  timeRange:
    | 'current-month'
    | 'last-month'
    | 'last-3-months'
    | 'year'
    | 'month-select'
    | 'custom';
  normalizedRange: string;
  selectedYear?: number | null;
  selectedMonth?: number | null;
  customStartDate?: Date;
  customEndDate?: Date;
};

// local formatters
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

const defaultSummary: Summary = {
  outstanding: 0,
  paidPeriod: 0,
  totalAllStages: 0,
  byState: {},
};

export default function ClaimsPipeline({
  className,
  timeRange,
  normalizedRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: [
      '/api/claims/summary',
      normalizedRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/claims/summary?range=${normalizedRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(
          customEndDate,
          'yyyy-MM-dd'
        )}`;
      } else {
        url += `&year=${selectedYear}&month=${selectedMonth}`;
      }

      try {
        const { data } = await api.get(url);
        return (data ?? defaultSummary) as Summary;
      } catch {
        // backend not live yet / 404—just show the scaffold
        return defaultSummary;
      }
    },
  });

  const summary = data ?? defaultSummary;

  const rows: Array<{ key: Stage; label: string }> = useMemo(
    () => [
      { key: 'submitted', label: 'Submitted' },
      { key: 'in_review', label: 'In review' },
      { key: 'approved', label: 'Approved' },
      { key: 'paid', label: 'Paid' },
      { key: 'rejected', label: 'Rejected' },
    ],
    []
  );

  const totalCount =
    rows.reduce((s, r) => s + (summary.byState?.[r.key]?.count ?? 0), 0) || 0;

  const visibleRows = rows.filter((r) => (summary.byState?.[r.key]?.count ?? 0) > 0);

  return (
    <Card className={cn('h-full flex flex-col border border-slate-200 shadow-sm', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Claims Pipeline
          </CardTitle>
          <Badge variant="outline" className="rounded-full">
            {timeRange === 'custom' && customStartDate && customEndDate
              ? `${format(customStartDate, 'MMM d')}–${format(customEndDate, 'MMM d')}`
              : 'Current period'}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Track claims from submission through payment.
        </p>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {/* Top summary tiles */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] text-slate-500">Outstanding</p>
            <p className="text-sm font-mono font-semibold">USD {fmtUSD(summary.outstanding || 0)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] text-slate-500">Paid (period)</p>
            <p className="text-sm font-mono font-semibold">USD {fmtUSD(summary.paidPeriod || 0)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] text-slate-500">Total (all stages)</p>
            <p className="text-sm font-mono font-semibold">USD {fmtUSD(summary.totalAllStages || 0)}</p>
          </div>
        </div>

        {/* Stage rows */}
        <div className="space-y-2">
          {visibleRows.length ? (
            visibleRows.map((r) => {
              const c = summary.byState?.[r.key]?.count ?? 0;
              const amt = summary.byState?.[r.key]?.amount ?? 0;
              const pct = totalCount ? Math.min(100, Math.round((c / totalCount) * 100)) : 0;

              return (
                <div key={r.key} className="rounded-md border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700">{r.label}</div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono">{c}</span> claims · USD{' '}
                      <span className="font-mono">{fmtUSD(amt)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-1.5 bg-slate-900/80 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs text-slate-500">
                No claim data yet for this period (or the endpoint isn’t live). You can still
                create claims and they’ll show up here.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <a href="/claims" className="block">
            <Button variant="outline" size="sm">
              View all claims
            </Button>
          </a>
          <a href="/claims/new" className="block ml-auto">
            <Button size="sm">New claim</Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
