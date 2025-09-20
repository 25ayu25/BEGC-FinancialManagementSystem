'use client';

import {useEffect, useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import {format} from 'date-fns';
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {api} from '@/lib/queryClient';
import {useDateFilter} from '@/context/date-filter-context';

// ----------------------------- Types -----------------------------
type TimeRange =
  | 'current-month'
  | 'last-month'
  | 'last-3-months'
  | 'year'
  | 'month-select'
  | 'custom';

type Summary = {
  totalUSD: number;
  activeProviders: number;
  changePct?: number; // optional: vs last period
};

type ProviderSlice = { provider: string; usd: number };

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

// --------------------------- URL helpers --------------------------
function getSearchParams() {
  const sp = new URLSearchParams(window.location.search);
  return {
    range: (sp.get('range') as TimeRange) ?? undefined,
    year: sp.get('year') ? Number(sp.get('year')) : undefined,
    month: sp.get('month') ? Number(sp.get('month')) : undefined,
  };
}
function setSearchParams(params: Partial<{range: TimeRange; year: number; month: number}>) {
  const sp = new URLSearchParams(window.location.search);
  if (params.range !== undefined) sp.set('range', params.range);
  if (params.year !== undefined) sp.set('year', String(params.year));
  if (params.month !== undefined) sp.set('month', String(params.month));
  // do not push new history entries every change
  window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`);
}

// Range used for queries (we normalise month-select to current-month on the backend)
const normalise = (r: TimeRange) => (r === 'month-select' ? 'current-month' : r);

// Compute the start/end window for server calls
function computeWindow(
  range: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  if (range === 'current-month' || range === 'last-month' || range === 'month-select') {
    const s = new Date(year, month - 1, 1);
    const e = new Date(year, month, 0);
    return { startISO: format(s, 'yyyy-MM-dd'), endISO: format(e, 'yyyy-MM-dd') };
  }
  if (range === 'year') {
    const s = new Date(year, 0, 1);
    const e = new Date(year, 11, 31);
    return { startISO: format(s, 'yyyy-MM-dd'), endISO: format(e, 'yyyy-MM-dd') };
  }
  // last-3-months and custom — pass through via URL and let API figure it out
  const s = customStart ?? new Date(year, month - 1, 1);
  const e = customEnd ?? new Date(year, month, 0);
  return { startISO: format(s, 'yyyy-MM-dd'), endISO: format(e, 'yyyy-MM-dd') };
}

// ------------------------- API fetchers --------------------------
async function fetchInsuranceSummary(range: TimeRange, year: number, month: number, start?: Date, end?: Date): Promise<Summary> {
  const {startISO, endISO} = computeWindow(range, year, month, start, end);
  const url = `/api/insurance/summary?range=${normalise(range)}&year=${year}&month=${month}&startDate=${startISO}&endDate=${endISO}`;
  const {data} = await api.get(url);
  // defensive mapping
  return {
    totalUSD: Number(data?.totalUSD ?? 0),
    activeProviders: Number(data?.activeProviders ?? data?.providers ?? 0),
    changePct: data?.changePct != null ? Number(data.changePct) : undefined,
  };
}

async function fetchProviders(range: TimeRange, year: number, month: number, start?: Date, end?: Date): Promise<ProviderSlice[]> {
  const {startISO, endISO} = computeWindow(range, year, month, start, end);
  const url = `/api/insurance/providers?range=${normalise(range)}&year=${year}&month=${month}&startDate=${startISO}&endDate=${endISO}`;
  try {
    const {data} = await api.get(url);
    const arr = Array.isArray(data?.providers) ? data.providers : Array.isArray(data) ? data : [];
    return arr.map((r: any) => ({ provider: String(r.provider ?? r.name ?? '—'), usd: Number(r.usd ?? r.total ?? 0) }));
  } catch {
    return [];
  }
}

// ----------------- Sticky filter (URL <-> Context) ----------------
/** Hydrates from URL once; keeps URL updated; never re-asserts defaults. */
function useStickyDateFilter() {
  const { range, setRange, year, setYear, month, setMonth } = useDateFilter();
  const hydratedRef = useRef(false);

  // 1) On first mount, hydrate from URL (if present)
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const { range: r, year: y, month: m } = getSearchParams();
    if (r) setRange(r);
    if (y) setYear(y);
    if (m) setMonth(m);
  }, [setRange, setYear, setMonth]);

  // 2) Whenever filter changes, mirror into the URL (once hydrated)
  useEffect(() => {
    if (!hydratedRef.current) return;
    setSearchParams({ range, year, month });
  }, [range, year, month]);
}

// ------------------------------ Page ------------------------------
export default function InsuranceProvidersPage() {
  const {
    range, setRange,
    year, setYear,
    month, setMonth,
    customStartDate, customEndDate,
  } = useDateFilter();

  // glue URL <-> context
  useStickyDateFilter();

  // Query data
  const { data: summary } = useQuery({
    queryKey: ['ins-summary', normalise(range), year, month, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: () => fetchInsuranceSummary(range, year, month, customStartDate, customEndDate),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['ins-providers', normalise(range), year, month, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: () => fetchProviders(range, year, month, customStartDate, customEndDate),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const totalUSD = Number(summary?.totalUSD ?? 0);
  const activeProviders = Number(summary?.activeProviders ?? 0);

  const rangeLabel = useMemo(() => {
    if (range === 'current-month' || range === 'month-select') return 'Current Month';
    if (range === 'last-month') return 'Last Month';
    if (range === 'last-3-months') return 'Last 3 Months';
    if (range === 'year') return String(year);
    if (range === 'custom') return 'Custom';
    return 'Current Month';
  }, [range, year]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Insurance Providers</h1>
          <p className="text-sm text-slate-500">Detailed breakdown · {rangeLabel}</p>
        </div>

        {/* Single filter (same behaviour as before, but stable) */}
        <Select
          value={range}
          onValueChange={(v: TimeRange) => {
            setRange(v);
            // if the user switches to a month-based range and we don’t have a month yet, keep the current month
            if (v === 'month-select' || v === 'current-month' || v === 'last-month') {
              if (!month) setMonth(new Date().getMonth() + 1);
            }
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current-month">Current Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="month-select">Select Month…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview cards */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Insurance Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-slate-500 mb-1">Total Revenue</div>
              <div className="text-xl font-semibold">USD {nf0.format(totalUSD)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {range === 'year'
                  ? `${year}`
                  : range === 'month-select' || range === 'current-month' || range === 'last-month'
                  ? `${MONTH_SHORT[month - 1]} ${year}`
                  : 'Selected period'}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-xs text-slate-500 mb-1">Active Providers</div>
              <div className="text-xl font-semibold">{activeProviders}</div>
              <div className="text-xs text-slate-500 mt-1">with transactions</div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-xs text-slate-500 mb-1">vs Last Month</div>
              <div className="text-xl font-semibold">
                {summary?.changePct == null ? '—' : `${nf2.format(summary.changePct)}%`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share by Provider (reuse your existing donut/cards, the data is stable now) */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Share by Provider</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {providers.length === 0 ? (
            <div className="text-slate-500 text-sm py-8 text-center">
              No insurance data for this period.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: your donut or pie chart */}
              {/* Keep your existing donut component here */}
              {/* RIGHT: your provider cards list */}
              <div className="space-y-3">
                {providers.map((p) => (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="font-medium">{p.provider}</div>
                    <div className="text-sm text-slate-700">USD {nf0.format(p.usd)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
