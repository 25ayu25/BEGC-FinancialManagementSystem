'use client';

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/queryClient";
import { Link } from "wouter";
import { format } from "date-fns";

type Range =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "custom"
  | "month-select";

type Props = {
  timeRange: Range;
  selectedYear: number;
  selectedMonth: number;
  customStartDate?: Date;
  customEndDate?: Date;
  dashboardData: any; // expects insuranceBreakdown + totals
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

// Build [start, end) UTC date strings like the backend expects (YYYY-MM-DD)
function rangeToDates(
  timeRange: Range,
  selectedYear: number,
  selectedMonth: number,
  customStart?: Date,
  customEnd?: Date
) {
  const y = selectedYear;
  const m = selectedMonth; // 1..12
  const pad = (n: number) => String(n).padStart(2, "0");

  const ymd = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  const firstOf = (yy: number, mm1to12: number) =>
    new Date(Date.UTC(yy, mm1to12 - 1, 1));
  const firstOfNext = (yy: number, mm1to12: number) =>
    mm1to12 === 12 ? new Date(Date.UTC(yy + 1, 0, 1)) : new Date(Date.UTC(yy, mm1to12, 1));

  switch (timeRange) {
    case "current-month": {
      return {
        start: ymd(firstOf(y, m)),
        end: ymd(firstOfNext(y, m)),
      };
    }
    case "month-select": {
      return {
        start: ymd(firstOf(y, m)),
        end: ymd(firstOfNext(y, m)),
      };
    }
    case "last-month": {
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      return {
        start: ymd(firstOf(prevYear, prevMonth)),
        end: ymd(firstOfNext(prevYear, prevMonth)),
      };
    }
    case "last-3-months": {
      const startMonth = ((m - 3 + 12) % 12) + 1; // two months before current selection
      const startYear = m <= 2 ? y - 1 : y;
      return {
        start: ymd(firstOf(startYear, startMonth)),
        end: ymd(firstOfNext(y, m)),
      };
    }
    case "year": {
      return {
        start: ymd(new Date(Date.UTC(y, 0, 1))),
        end: ymd(new Date(Date.UTC(y + 1, 0, 1))),
      };
    }
    case "custom": {
      // backend expects [start, end); make end = selected end date + 1 day if both provided
      if (customStart && customEnd) {
        const e = new Date(Date.UTC(customEnd.getUTCFullYear(), customEnd.getUTCMonth(), customEnd.getUTCDate() + 1));
        return { start: ymd(customStart), end: ymd(e) };
      }
      // fall back to current month if incomplete
      return {
        start: ymd(firstOf(y, m)),
        end: ymd(firstOfNext(y, m)),
      };
    }
    default: {
      return {
        start: ymd(firstOf(y, m)),
        end: ymd(firstOfNext(y, m)),
      };
    }
  }
}

export default function ClaimsPipeline(props: Props) {
  const {
    timeRange,
    selectedYear,
    selectedMonth,
    customStartDate,
    customEndDate,
    dashboardData,
  } = props;

  const { start, end } = useMemo(
    () => rangeToDates(timeRange, selectedYear, selectedMonth, customStartDate, customEndDate),
    [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]
  );

  // Providers for name mapping (id -> name)
  const { data: providers } = useQuery({
    queryKey: ["/api/insurance-providers"],
  });

  // Payments received this period (USD income transactions)
  const { data: txPage } = useQuery({
    queryKey: ["/api/transactions", "USD", start, end],
    queryFn: async () => {
      const url =
        `/api/transactions?currency=USD&type=income&startDate=${start}&endDate=${end}&limit=2000`;
      const { data } = await api.get(url);
      return data;
    },
  });

  // Normalize transactions response shape
  const txRows: any[] = useMemo(() => {
    if (!txPage) return [];
    if (Array.isArray(txPage)) return txPage;
    if (Array.isArray(txPage.rows)) return txPage.rows;
    return [];
  }, [txPage]);

  // Sum payments by providerId and total
  const { totalPaidUSD, paidByProviderId } = useMemo(() => {
    const byProv: Record<string, number> = {};
    let total = 0;
    for (const t of txRows) {
      const amt = Number(t.amount || 0);
      if (!amt) continue;
      total += amt;
      const pid = t.insuranceProviderId || "unknown";
      byProv[pid] = (byProv[pid] || 0) + amt;
    }
    return { totalPaidUSD: total, paidByProviderId: byProv };
  }, [txRows]);

  // Worked USD from dashboard (sum insuranceBreakdown)
  const workedUSD = useMemo(() => {
    const bd = dashboardData?.insuranceBreakdown || {};
    return Object.values(bd).reduce((s: number, v: any) => s + Number(v || 0), 0);
  }, [dashboardData]);

  const outstandingUSD = Math.max(0, Number(workedUSD) - Number(totalPaidUSD));
  const reimbRate = workedUSD > 0 ? (totalPaidUSD / workedUSD) * 100 : 0;

  // Build top providers table (align by name when possible)
  const providerNameById: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(providers)) {
      for (const p of providers as any[]) map[p.id] = p.name || p.providerName || p.title || p.code || p.id;
    }
    return map;
  }, [providers]);

  // Combine worked (by name) and paid (by id) into rows by display name
  const topRows = useMemo(() => {
    const workedByName: Record<string, number> = {};
    const bd = dashboardData?.insuranceBreakdown || {};
    Object.entries(bd).forEach(([name, v]: any) => {
      workedByName[name] = Number(v || 0);
    });

    // reverse map: name -> sum of paid (aggregate ids that match same name)
    const paidByName: Record<string, number> = {};
    Object.entries(paidByProviderId).forEach(([pid, amt]) => {
      const name = providerNameById[pid] || "Unknown";
      paidByName[name] = (paidByName[name] || 0) + Number(amt || 0);
    });

    const names = Array.from(new Set([...Object.keys(workedByName), ...Object.keys(paidByName)]));
    const rows = names.map((name) => {
      const w = workedByName[name] || 0;
      const p = paidByName[name] || 0;
      const pct = w > 0 ? Math.min(100, Math.round((p / w) * 100)) : 0;
      return { name, worked: w, paid: p, pct };
    });
    rows.sort((a, b) => b.worked - a.worked);
    return rows.slice(0, 5);
  }, [dashboardData, paidByProviderId, providerNameById]);

  const periodLabel = useMemo(() => {
    const pretty = (s: string) => format(new Date(s + "T00:00:00Z"), "MMM d, yyyy");
    return `${pretty(start)} → ${pretty(end)}`;
  }, [start, end]);

  return (
    <Card className="border border-slate-200 shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Claims Pipeline
          </CardTitle>
          <Link href={`/insurance-providers?range=current-month`}>
            <Button size="sm" variant="outline">View providers</Button>
          </Link>
        </div>
        <div className="text-xs text-slate-500">Period: {periodLabel}</div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Worked (USD)</div>
            <div className="text-base font-semibold font-mono">USD {fmtUSD(workedUSD)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Paid (USD)</div>
            <div className="text-base font-semibold font-mono">USD {fmtUSD(totalPaidUSD)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Outstanding</div>
            <div className="text-base font-semibold font-mono">USD {fmtUSD(outstandingUSD)}</div>
          </div>
        </div>

        {/* Reimbursement rate */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-600">Reimbursement rate</div>
            <Badge variant="outline" className="rounded-full">{Math.round(reimbRate)}%</Badge>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, reimbRate)}%` }} />
          </div>
        </div>

        {/* Top providers */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-medium text-slate-600 mb-2">Top providers this period</div>
          <div className="space-y-2">
            {topRows.length ? topRows.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{r.name}</span>
                  <span className="font-mono">USD {fmtUSD(r.paid)} / {fmtUSD(r.worked)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            )) : <div className="text-xs text-slate-500">No provider data for this period.</div>}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-end">
          <Link href="/transactions">
            <Button size="sm">Record payment</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
