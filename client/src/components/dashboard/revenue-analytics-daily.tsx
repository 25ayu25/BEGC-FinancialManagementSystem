'use client';

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, differenceInCalendarDays, startOfMonth, endOfMonth } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TimeRange =
  | "current-month"
  | "last-month"
  | "month-select"
  | "last-3-months"
  | "year"
  | "custom";

type Props = {
  timeRange: TimeRange;
  selectedYear: number;   // 4-digit year
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------------------------------------------------ */
/* Number formatters                                                   */
/* ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;
  if (frac <= 1)        niceFrac = 1;
  else if (frac <= 2)   niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5)   niceFrac = 5;
  else                  niceFrac = 10;
  return niceFrac * base;
}
function buildNiceTicks(max: number) {
  if (max <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(max / 4);
  const niceMax = step * 4;
  return { max: niceMax, ticks: [0, step, step * 2, step * 3, niceMax] };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Decide bucket size based on total length in days. */
function decideBucket(days: number): "daily" | "weekly" | "monthly" {
  if (days <= 45) return "daily";
  if (days <= 120) return "weekly";
  return "monthly";
}

/** Compute start/end date for the selected time range. */
function computeRange(
  timeRange: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date; label: string } {
  const mIdx = clamp(month - 1, 0, 11);

  if (timeRange === "current-month") {
    const start = startOfMonth(new Date(year, mIdx, 1));
    const end = endOfMonth(new Date(year, mIdx, 1));
    return { start, end, label: `${MONTH_SHORT[mIdx]} ${year}` };
  }
  if (timeRange === "last-month") {
    const d = new Date(year, mIdx, 1);
    const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const start = startOfMonth(last);
    const end = endOfMonth(last);
    return { start, end, label: `${MONTH_SHORT[last.getMonth()]} ${last.getFullYear()}` };
  }
  if (timeRange === "month-select") {
    const start = startOfMonth(new Date(year, mIdx, 1));
    const end = endOfMonth(new Date(year, mIdx, 1));
    return { start, end, label: `${MONTH_SHORT[mIdx]} ${year}` };
  }
  if (timeRange === "last-3-months") {
    const end = endOfMonth(new Date(year, mIdx, 1));
    const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - 2, 1));
    return { start, end, label: "Last 3 months" };
  }
  if (timeRange === "year") {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { start, end, label: `${year}` };
  }
  // custom
  const start = customStart ? new Date(customStart) : startOfMonth(new Date(year, mIdx, 1));
  const end   = customEnd   ? new Date(customEnd)   : endOfMonth(new Date(year, mIdx, 1));
  return { start, end, label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
}

/** Read all income transactions in a span (SSP + USD). */
async function fetchTransactions(start: Date, end: Date) {
  // Pull in pages to be safe with larger ranges.
  const pageSize = 1000;
  let page = 1;
  let hasMore = true;
  const all: any[] = [];

  while (hasMore) {
    const { data } = await api.get(
      `/api/transactions?type=income&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(
        end,
        "yyyy-MM-dd"
      )}&page=${page}&limit=${pageSize}`
    );
    const rows: any[] = data?.transactions || [];
    all.push(...rows);
    hasMore = Boolean(data?.hasMore);
    page += 1;
    if (!rows.length) break;
  }
  return all;
}

/** For single-month windows we can keep using the existing daily endpoint */
async function fetchDailyMonth(year: number, month: number) {
  const { data } = await api.get(`/api/income-trends/${year}/${month}?range=current-month`);
  return Array.isArray(data) ? data : [];
}

/* ------------------------------------------------------------------ */
/* Bucketing                                                          */
/* ------------------------------------------------------------------ */

type BucketRow = { label: string; ssp: number; usd: number };

function bucketize(
  rows: any[],
  start: Date,
  end: Date,
  bucket: "daily" | "weekly" | "monthly"
): BucketRow[] {
  const map = new Map<string, BucketRow>();

  if (bucket === "daily") {
    // Build every day so gaps show as zeros
    const totalDays = differenceInCalendarDays(end, start) + 1;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      const key = format(d, "yyyy-MM-dd");
      map.set(key, { label: format(d, "d"), ssp: 0, usd: 0 });
    }
    for (const t of rows) {
      const raw = t.dateISO || t.date || t.createdAt || t.created_at;
      const d = raw ? new Date(raw) : null;
      if (!d) continue;
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) continue; // outside
      const cur = map.get(key)!;
      cur.ssp += Number(t.incomeSSP ?? t.income ?? t.amount ?? 0);
      cur.usd += Number(t.incomeUSD ?? 0);
    }
    return Array.from(map.values());
  }

  if (bucket === "weekly") {
    // 7-day rolling buckets aligned to the start date
    let cursor = new Date(start);
    while (cursor <= end) {
      const next = addDays(cursor, 6);
      const key = `${format(cursor, "yyyy-MM-dd")}__${format(next, "yyyy-MM-dd")}`;
      map.set(key, {
        label: `${format(cursor, "MMM d")}–${format(next, "d")}`,
        ssp: 0,
        usd: 0,
      });
      cursor = addDays(next, 1);
    }
    for (const t of rows) {
      const raw = t.dateISO || t.date || t.createdAt || t.created_at;
      const d = raw ? new Date(raw) : null;
      if (!d || d < start || d > end) continue;
      // find bucket
      const daysFromStart = differenceInCalendarDays(d, start);
      const bucketStartIdx = Math.floor(daysFromStart / 7) * 7;
      const bStart = addDays(start, bucketStartIdx);
      const bEnd = addDays(bStart, 6);
      const k = `${format(bStart, "yyyy-MM-dd")}__${format(bEnd, "yyyy-MM-dd")}`;
      const cur = map.get(k);
      if (!cur) continue;
      cur.ssp += Number(t.incomeSSP ?? t.income ?? t.amount ?? 0);
      cur.usd += Number(t.incomeUSD ?? 0);
    }
    return Array.from(map.values());
  }

  // monthly
  {
    // Seed months
    const first = new Date(start.getFullYear(), start.getMonth(), 1);
    let cursor = new Date(first);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, { label: `${MONTH_SHORT[cursor.getMonth()]}`, ssp: 0, usd: 0 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    for (const t of rows) {
      const raw = t.dateISO || t.date || t.createdAt || t.created_at;
      const d = raw ? new Date(raw) : null;
      if (!d || d < start || d > end) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key);
      if (!cur) continue;
      cur.ssp += Number(t.incomeSSP ?? t.income ?? t.amount ?? 0);
      cur.usd += Number(t.incomeUSD ?? 0);
    }
    return Array.from(map.values());
  }
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                            */
/* ------------------------------------------------------------------ */

function BucketTooltip({
  active,
  payload,
  titlePrefix,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  titlePrefix: string;
  currency: "SSP" | "USD";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  const label: string = p?.label ?? "";
  const value: number = Number(payload[0]?.value ?? 0);

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[160px]">
      <div className="font-semibold text-slate-900 mb-1">
        {titlePrefix} {label}
      </div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {nf0.format(Math.round(value))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const { start, end, label: rangeLabel } = useMemo(
    () => computeRange(timeRange, selectedYear, selectedMonth, customStartDate, customEndDate),
    [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]
  );

  const spanDays = differenceInCalendarDays(end, start) + 1;
  const bucket = decideBucket(spanDays);

  const { data = [], isLoading } = useQuery({
    queryKey: ["exec-revenue", timeRange, selectedYear, selectedMonth, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      // Optimization: for "single month" daily mode, use existing daily endpoint
      const isSingleMonth =
        bucket === "daily" &&
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === 1 &&
        end.getDate() >= 28;

      if (isSingleMonth) {
        const daily = await fetchDailyMonth(start.getFullYear(), start.getMonth() + 1);
        // shape to {label, ssp, usd}
        const rows = daily.map((r: any) => ({
          label: String(r.day ?? r.date ?? r.dateISO ? new Date(r.dateISO).getDate() : ""),
          ssp: Number(r.incomeSSP ?? r.income ?? r.amount ?? 0),
          usd: Number(r.incomeUSD ?? 0),
        }));
        return rows as BucketRow[];
      }

      // otherwise, get raw transactions in the big window and bucket
      const tx = await fetchTransactions(start, end);
      return bucketize(tx, start, end, bucket);
    },
  });

  /* Aggregations */
  const sspSeries = data.map((d: BucketRow) => ({ label: d.label, value: d.ssp }));
  const usdSeries = data.map((d: BucketRow) => ({ label: d.label, value: d.usd }));

  const totalSSP = sspSeries.reduce((s, r) => s + r.value, 0);
  const totalUSD = usdSeries.reduce((s, r) => s + r.value, 0);

  const activeSSP = sspSeries.filter(d => d.value > 0).length || 0;
  const activeUSD = usdSeries.filter(d => d.value > 0).length || 0;

  const avgSSP = activeSSP ? Math.round(totalSSP / activeSSP) : 0;
  const avgUSD = activeUSD ? Math.round(totalUSD / activeUSD) : 0;

  // Nice Y ticks
  const maxSSP = Math.max(0, ...sspSeries.map(d => d.value));
  const maxUSD = Math.max(0, ...usdSeries.map(d => d.value));
  const { max: yMaxSSP, ticks: ticksSSP } = buildNiceTicks(maxSSP);
  const { max: yMaxUSD, ticks: ticksUSD } = buildNiceTicks(maxUSD);

  const bucketTitle = bucket === "daily" ? "day" : bucket === "weekly" ? "week of" : "month";

  /* UI */
  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {rangeLabel} · SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)} ·
          <span className="ml-1">({bucket.toUpperCase()})</span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP */}
        <section aria-label="SSP">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP ({bucket === "daily" ? "Daily" : bucket === "weekly" ? "Weekly" : "Monthly"})</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              <span className="mx-2">•</span>
              Avg/{bucket === "daily" ? "day" : bucket === "weekly" ? "week" : "month"}:{" "}
              <span className="font-semibold">SSP {nf0.format(avgSSP)}</span>
            </span>
          </div>
          <div className="h-64 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sspSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={bucket === "daily" ? 0 : 0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  ticks={ticksSSP}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => compact.format(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<BucketTooltip titlePrefix={bucketTitle} currency="SSP" />}
                />
                <Bar dataKey="value" name="SSP" fill="#14b8a6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD */}
        <section aria-label="USD">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD ({bucket === "daily" ? "Daily" : bucket === "weekly" ? "Weekly" : "Monthly"})</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              <span className="mx-2">•</span>
              Avg/{bucket === "daily" ? "day" : bucket === "weekly" ? "week" : "month"}:{" "}
              <span className="font-semibold">USD {nf0.format(avgUSD)}</span>
            </span>
          </div>
          <div className="h-64 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usdSeries}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={bucket === "daily" ? 0 : 0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  ticks={ticksUSD}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => compact.format(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<BucketTooltip titlePrefix={bucketTitle} currency="USD" />}
                />
                <Bar dataKey="value" name="USD" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">Loading revenue…</div>
        )}
      </CardContent>
    </Card>
  );
}
