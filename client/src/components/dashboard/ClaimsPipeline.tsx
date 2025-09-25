'use client';

import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/queryClient';

type Stage = {
  count: number;
  amountUSD: number;    // total claim value in USD for this stage
};

type Pipeline = {
  submitted: Stage;
  inReview: Stage;
  approved: Stage;
  paid: Stage;
  rejected: Stage;
};

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export default function ClaimsPipeline(props: {
  timeRange: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'month-select' | 'custom';
  selectedYear: number;
  selectedMonth: number;
  customStartDate?: Date;
  customEndDate?: Date;
  normalizedRange: string;
}) {
  const { timeRange, selectedYear, selectedMonth, customStartDate, customEndDate, normalizedRange } =
    props;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      '/api/claims/summary',
      normalizedRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/claims/summary?range=${normalizedRange}&year=${selectedYear}&month=${selectedMonth}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(
          customEndDate,
          'yyyy-MM-dd'
        )}`;
      }
      const { data } = await api.get(url);
      return data as { pipeline: Pipeline; periodLabel?: string };
    },
    // If the endpoint isn't live yet, we still render a friendly empty state
    retry: 1,
  });

  const pipeline: Pipeline =
    data?.pipeline || {
      submitted: { count: 0, amountUSD: 0 },
      inReview: { count: 0, amountUSD: 0 },
      approved: { count: 0, amountUSD: 0 },
      paid: { count: 0, amountUSD: 0 },
      rejected: { count: 0, amountUSD: 0 },
    };

  const outstandingUSD =
    pipeline.submitted.amountUSD + pipeline.inReview.amountUSD + pipeline.approved.amountUSD;
  const totalUSD =
    outstandingUSD + pipeline.paid.amountUSD + pipeline.rejected.amountUSD;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Claims Pipeline
          </CardTitle>
          <Badge variant="outline" className="rounded-full">
            {data?.periodLabel ?? 'Current period'}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Track claims from submission through payment.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-600">Outstanding</p>
            <p className="font-semibold tabular-nums">USD {nf2.format(outstandingUSD)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-600">Paid (period)</p>
            <p className="font-semibold tabular-nums">USD {nf2.format(pipeline.paid.amountUSD)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-600">Total (all stages)</p>
            <p className="font-semibold tabular-nums">USD {nf2.format(totalUSD)}</p>
          </div>
        </div>

        {/* Visual pipeline */}
        <div className="space-y-3">
          {[
            ['Submitted', pipeline.submitted, 'bg-slate-300'],
            ['In review', pipeline.inReview, 'bg-blue-300'],
            ['Approved', pipeline.approved, 'bg-emerald-400'],
            ['Paid', pipeline.paid, 'bg-purple-300'],
            ['Rejected', pipeline.rejected, 'bg-red-300'],
          ].map(([label, stage, color], idx) => {
            const s = stage as Stage;
            const width = pct(s.amountUSD, Math.max(totalUSD, 1));
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{label as string}</span>
                  <span className="text-xs text-slate-500">
                    {nf0.format(s.count)} claim{s.count === 1 ? '' : 's'} · USD {nf2.format(s.amountUSD)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${color as string}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button asChild size="sm" variant="outline">
            <a href="/claims">View all claims</a>
          </Button>
          <Button asChild size="sm">
            <a href="/claims/new">New claim</a>
          </Button>
        </div>

        {isLoading && (
          <p className="text-xs text-slate-500">Loading claims…</p>
        )}
        {isError && (
          <p className="text-xs text-slate-500">
            No claim data yet for this period (or the endpoint isn’t live). You can still create claims and they’ll show up here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
