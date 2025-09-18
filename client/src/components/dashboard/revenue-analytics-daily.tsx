'use client';

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const kfmt = (v: number) =>
  v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v));

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1..12
}
function normalizedRange(range: TimeRange) {
  return range === "month-select" ? "current-month" : range;
}

async function fetchIncomeTrendsDaily(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let url = `/api/income-trends/${year}/${month}?range=${normalizedRange(range)}`;
  if (range === "custom" && start && end) {
    url += `&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(
      end,
      "yyyy-MM-dd"
    )}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const year = selectedYear;
  const month = selectedMonth;
  const days = daysInMonth(year, month);

  // full month on the X axis (like Patient Volume)
  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      "exec-daily-income",
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
  });

  // Build continuous series with zeros for missing days (SSP & USD)
  const ssp = baseDays.map((day) => ({ day, value: 0 }));
  const usd = baseDays.map((day) => ({ day, value: 0 }));

  for (const r of raw as any[]) {
    let d: number | undefined = (r as any).day;
    if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
    if (!d && (r as any).date) d = new Date((r as any).date).getDate();

    if (typeof d === "number" && d >= 1 && d <= days) {
      ssp[d - 1].value += Number(
        (r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0
      );
      usd[d - 1].value += Number((r as any).incomeUSD ?? 0);
    }
  }

  const totalSSP = ssp.reduce((s, r) => s + r.value, 0);
  const totalUSD = usd.reduce((s, r) => s + r.value, 0);

  // "active-day" averages (ignores zero days so a few end-of-month zeros don't dilute the signal)
  const activeDaysSSP = ssp.filter(d => d.value > 0).length || 0;
  const activeDaysUSD = usd.filter(d => d.value > 0).length || 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  // headroom so the tallest bar doesn’t touch the top
  const yMaxSSP = Math.ceil(Math.max(0, ...ssp.map(d => d.value)) * 1.12);
  const yMaxUSD = Math.ceil(Math.max(0, ...usd.map(d => d.value)) * 1.18);

  const tooltipSSP = (v: any) => [`SSP ${nf0.format(Math.round(Number(v)))}`, ""];
  const tooltipUSD = (v: any) => [`USD ${nf0.format(Math.round(Number(v)))}`, ""];

  const monthLabel = format(new Date(year, month - 1, 1), "MMM yyyy");

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {monthLabel} · SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP Daily */}
        <section aria-label="SSP daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">SSP {nf0.format(avgDaySSP)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ssp}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                {/* Light horizontal grid, no vertical lines */}
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={0}             // show every day (like Patient Volume)
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}         // remove the baseline line
                  tickLine={false}         // remove little tick marks
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={kfmt}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={tooltipSSP} labelFormatter={(l) => `Day ${l}`} />
                <Bar
                  dataKey="value"
                  name="SSP"
                  fill="#14b8a6"           // teal (matches Patient Volume vibe)
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD Daily */}
        <section aria-label="USD daily">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD (Daily)</p>
            <span className="text-xs text-slate-500">
              Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              <span className="mx-2">•</span>
              Avg/day: <span className="font-semibold">USD {nf0.format(avgDayUSD)}</span>
            </span>
          </div>
          <div className="h-56 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usd}
                margin={{ top: 10, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickMargin={8}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={kfmt}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={tooltipUSD} labelFormatter={(l) => `Day ${l}`} />
                <Bar
                  dataKey="value"
                  name="USD"
                  fill="#0ea5e9"           // blue pairs nicely with teal
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading daily revenue…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
