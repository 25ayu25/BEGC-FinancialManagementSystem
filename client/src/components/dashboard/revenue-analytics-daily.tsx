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
  Line,
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

// number formatting helpers
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const kfmt = (v: number) =>
  v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v));

/* ----------------------------- helpers ----------------------------- */

function daysInMonth(year: number, month: number) {
  // month is 1..12
  return new Date(year, month, 0).getDate();
}

function normalizedRange(range: TimeRange) {
  // keep backend compatible: month-select behaves like current-month server-side
  return range === "month-select" ? "current-month" : range;
}

function rollingAvg(series: Array<{ day: number; value: number }>, window = 7) {
  // simple 7-day moving average, safe on any browser
  return series.map((p, i) => {
    const s = Math.max(0, i - (window - 1));
    const slice = series.slice(s, i + 1);
    const sum = slice.reduce((acc, r) => acc + (r.value || 0), 0);
    return { day: p.day, avg: slice.length ? sum / slice.length : 0 };
  });
}

/* ------------------------------ fetch ------------------------------ */

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

/* ---------------------------- component ---------------------------- */

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  // Focus the Exec view on a single month (the selected one).
  const year = selectedYear;
  const month = selectedMonth;
  const days = daysInMonth(year, month);

  // prebuild 1..N days so the X-axis always shows the full month
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
      fetchIncomeTrendsDaily(
        year,
        month,
        timeRange,
        customStartDate,
        customEndDate
      ),
  });

  // aggregate into continuous daily series for each currency
  const ssp = baseDays.map((day) => ({ day, value: 0 }));
  const usd = baseDays.map((day) => ({ day, value: 0 }));

  for (const r of raw as any[]) {
    // try day first, then parse date fields
    let d = (r as any).day;
    if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
    if (!d && (r as any).date) d = new Date((r as any).date).getDate();

    if (typeof d === "number" && d >= 1 && d <= days) {
      ssp[d - 1].value += Number((r as any).incomeSSP ?? (r as any).income ?? 0);
      usd[d - 1].value += Number((r as any).incomeUSD ?? 0);
    }
  }

  const sspTotal = ssp.reduce((s, r) => s + r.value, 0);
  const usdTotal = usd.reduce((s, r) => s + r.value, 0);

  // add headroom so bars/labels never clip
  const yMaxSSP = Math.ceil(Math.max(0, ...ssp.map((p) => p.value)) * 1.15);
  const yMaxUSD = Math.ceil(Math.max(0, ...usd.map((p) => p.value)) * 1.2);

  // 7-day moving averages (trend hints)
  const sspAvg = rollingAvg(ssp, 7);
  const usdAvg = rollingAvg(usd, 7);

  // show ~8–10 X ticks, but still render *all* days as data
  const approxTicks = 9;
  const tickInterval = Math.max(1, Math.floor(days / approxTicks));

  const tooltipSSP = (v: any) => [`SSP ${nf0.format(Math.round(Number(v)))}`, ""];
  const tooltipUSD = (v: any) => [`USD ${nf0.format(Math.round(Number(v)))}`, ""];

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {format(new Date(year, month - 1, 1), "MMM yyyy")} ·{" "}
          <span className="font-medium">
            SSP {nf0.format(sspTotal)}
          </span>{" "}
          ·{" "}
          <span className="font-medium">
            USD {nf0.format(usdTotal)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP daily */}
        <section aria-label="SSP daily">
          <p className="text-sm font-medium text-slate-700 mb-2">SSP (Daily)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ssp}
                margin={{ top: 6, right: 12, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={tickInterval - 1}
                />
                <YAxis
                  domain={[0, yMaxSSP]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={kfmt}
                />
                <Tooltip formatter={tooltipSSP} labelFormatter={(l) => `Day ${l}`} />
                <Line
                  type="monotone"
                  data={sspAvg}
                  dataKey="avg"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                  name="7-day avg"
                />
                <Bar
                  dataKey="value"
                  name="SSP"
                  fill="#14b8a6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD daily */}
        <section aria-label="USD daily">
          <p className="text-sm font-medium text-slate-700 mb-2">USD (Daily)</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usd}
                margin={{ top: 6, right: 12, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={tickInterval - 1}
                />
                <YAxis
                  domain={[0, yMaxUSD]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={kfmt}
                />
                <Tooltip formatter={tooltipUSD} labelFormatter={(l) => `Day ${l}`} />
                <Line
                  type="monotone"
                  data={usdAvg}
                  dataKey="avg"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="7-day avg"
                />
                <Bar
                  dataKey="value"
                  name="USD"
                  fill="#0ea5e9"
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
