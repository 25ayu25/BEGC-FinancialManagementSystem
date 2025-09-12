import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Shield,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Link } from "wouter";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
} from "recharts";

/* -------------------------------- Helpers -------------------------------- */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const COLORS = [
  "#6366F1", // indigo
  "#22C55E", // green
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#EF4444", // red
  "#A855F7", // violet
  "#84CC16", // lime
  "#10B981", // emerald
  "#F97316", // orange
  "#14B8A6", // teal
];

const toRGBA = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type RangeKey = "current-month" | "last-month" | "last-3-months" | "year" | "custom";

/* --------------------------- Page Component --------------------------- */

export default function InsuranceProvidersPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const rangeParam = (urlParams.get("range") || "current-month") as RangeKey;
  const startDateParam = urlParams.get("startDate");
  const endDateParam = urlParams.get("endDate");
  const yearParam = urlParams.get("year");
  const monthParam = urlParams.get("month");

  const now = new Date();

  const getInitialYearMonth = () => {
    if (yearParam && monthParam) {
      return { year: parseInt(yearParam), month: parseInt(monthParam) };
    }
    switch (rangeParam) {
      case "last-month": {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1);
        return { year: lm.getFullYear(), month: lm.getMonth() + 1 };
      }
      case "year":
        return { year: now.getFullYear(), month: 1 };
      default:
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
  };

  const initial = getInitialYearMonth();
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [timeRange, setTimeRange] = useState<RangeKey>(rangeParam);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

  const handleTimeRangeChange = (range: RangeKey) => {
    setTimeRange(range);
    const n = new Date();
    switch (range) {
      case "current-month":
        setSelectedYear(n.getFullYear());
        setSelectedMonth(n.getMonth() + 1);
        break;
      case "last-month": {
        const lm = new Date(n.getFullYear(), n.getMonth() - 1);
        setSelectedYear(lm.getFullYear());
        setSelectedMonth(lm.getMonth() + 1);
        break;
      }
      case "last-3-months":
        setSelectedYear(n.getFullYear());
        setSelectedMonth(n.getMonth() + 1);
        break;
      case "year":
        setSelectedYear(n.getFullYear());
        setSelectedMonth(1);
        break;
      case "custom":
        break;
    }
  };

  /* ----------------------------- Queries ----------------------------- */

  // Dashboard (unchanged)
  const { data: dashboardData } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
  });

  // Comparison for month vs last-month (unchanged)
  const { data: comparisonData } = useQuery({
    queryKey: ["/api/dashboard/comparison", selectedYear, selectedMonth, timeRange],
    queryFn: async () => {
      let compYear = selectedYear;
      let compMonth = selectedMonth;
      if (timeRange === "current-month") {
        const lm = new Date(selectedYear, selectedMonth - 2);
        compYear = lm.getFullYear();
        compMonth = lm.getMonth() + 1;
      } else if (timeRange === "last-month") {
        const today = new Date();
        compYear = today.getFullYear();
        compMonth = today.getMonth() + 1;
      }
      const url = `/api/dashboard?year=${compYear}&month=${compMonth}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: timeRange === "current-month" || timeRange === "last-month",
    staleTime: 0,
    gcTime: 0,
  });

  // ✅ Monthly Totals — now using the new backend endpoint
  const { data: monthlySeries = [], isFetching: loadingMonthly } = useQuery({
    queryKey: [
      "/api/insurance/monthly",
      timeRange,
      selectedYear,
      selectedMonth,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("range", timeRange);
      if (timeRange === "year" || timeRange === "current-month" || timeRange === "last-month") {
        params.set("year", String(selectedYear));
        params.set("month", String(selectedMonth));
      }
      if (timeRange === "custom" && customStartDate && customEndDate) {
        params.set("startDate", format(customStartDate, "yyyy-MM-dd"));
        params.set("endDate", format(customEndDate, "yyyy-MM-dd"));
      }
      const r = await fetch(`/api/insurance/monthly?${params.toString()}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load monthly insurance totals");
      const j = await r.json();
      return Array.isArray(j?.data) ? (j.data as Array<{ month: string; year: number; usd: number }>) : [];
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  /* ------------------------ Breakdown + colors ------------------------ */

  const insuranceBreakdown: Record<string, number> =
    (dashboardData?.insuranceBreakdown as any) || {};
  const prevInsuranceBreakdown: Record<string, number> =
    (comparisonData?.insuranceBreakdown as any) || {};

  const providers = useMemo(() => {
    const arr = Object.entries(insuranceBreakdown).map(([name, v]) => ({
      name,
      usd: Number(typeof v === "string" ? v.replace(/[^0-9.-]/g, "") : v) || 0,
    }));
    return arr.sort((a, b) => b.usd - a.usd);
  }, [insuranceBreakdown]);

  const totalSelectedUSD = providers.reduce((s, p) => s + p.usd, 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce(
    (s, v) => s + (Number(v) || 0),
    0
  );
  const overallChange =
    totalComparisonUSD > 0
      ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100
      : 0;

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    providers.forEach((p, i) => {
      map[p.name] = COLORS[i % COLORS.length];
    });
    map["Other"] = "#CBD5E1";
    return map;
  }, [providers]);

  const donutData = useMemo(() => {
    if (!providers.length) return [];
    const top = providers.slice(0, 7);
    const leftover = providers.slice(7);
    const otherTotal = leftover.reduce((s, p) => s + p.usd, 0);
    const data = [...top];
    if (otherTotal > 0) data.push({ name: "Other", usd: otherTotal });
    return data.map((d) => ({ name: d.name, value: d.usd }));
  }, [providers]);

  const donutLegend = donutData.map((d) => ({
    name: d.name,
    usd: d.value,
    pct: totalSelectedUSD > 0 ? (d.value / totalSelectedUSD) * 100 : 0,
    color: colorMap[d.name],
  }));

  // CEO-type insight numbers
  const hhi = useMemo(() => {
    if (!providers.length || totalSelectedUSD <= 0) return 0;
    const shares = providers.map((p) => Math.pow(p.usd / totalSelectedUSD, 2));
    return shares.reduce((s, x) => s + x, 0);
  }, [providers, totalSelectedUSD]);
  const topProvider = providers[0]?.name ?? "—";
  const topShare = providers[0] ? (providers[0].usd / (totalSelectedUSD || 1)) * 100 : 0;

  const monthlyAvg = useMemo(() => {
    if (!Array.isArray(monthlySeries) || monthlySeries.length === 0) return 0;
    const sum = monthlySeries.reduce((s, r) => s + (r.usd || 0), 0);
    return sum / monthlySeries.length;
  }, [monthlySeries]);

  const yMax = useMemo(() => {
    const m = Math.max(0, ...monthlySeries.map((d) => d.usd || 0));
    return m <= 0 ? 10 : Math.ceil(m * 1.1);
  }, [monthlySeries]);

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Insurance Providers</h1>
              <p className="text-slate-600 mt-1">Detailed breakdown by insurance provider</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: "rgb(255, 255, 255)" }}
                    avoidCollisions
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
                      showOutsideDays={false}
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span aria-hidden="true" className="text-muted-foreground">
                  to
                </span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: "rgb(255, 255, 255)" }}
                    avoidCollisions
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
                      showOutsideDays={false}
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overview */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Insurance Revenue Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">
                  USD {nf0.format(Math.round(totalSelectedUSD))}
                </p>
                <p className="text-xs text-slate-500">
                  {timeRange === "current-month"
                    ? "Current month"
                    : timeRange === "last-month"
                    ? "Last month"
                    : timeRange === "last-3-months"
                    ? "Last 3 months"
                    : timeRange === "year"
                    ? "This year"
                    : "Custom period"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">
                  {providers.length}
                </p>
                <p className="text-xs text-slate-500">with transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                {overallChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs{" "}
                  {timeRange === "current-month"
                    ? "Last Month"
                    : timeRange === "last-month"
                    ? "Current Month"
                    : "Previous Period"}
                </p>
                <p
                  className={`text-xl font-bold ${
                    overallChange >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {overallChange >= 0 ? "+" : ""}
                  {nf1.format(overallChange)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share by Provider (Donut + Legend) */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Share by Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {providers.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No insurance data for this period.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as any;
                        const pct =
                          totalSelectedUSD > 0
                            ? ((p.value / totalSelectedUSD) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <div className="bg-white border border-slate-200 rounded-md shadow px-3 py-2 text-sm">
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="text-slate-600">
                              USD {nf0.format(Math.round(p.value))} · {pct}%
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={80}
                      outerRadius={120}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={colorMap[d.name]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {donutLegend.map((x) => (
                  <div key={x.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: x.color }}
                    />
                    <span className="text-slate-800">{x.name}</span>
                    <span className="ml-auto text-slate-600">
                      USD {nf0.format(Math.round(x.usd))}
                    </span>
                    <span className="w-14 text-right text-slate-500">
                      {nf1.format(x.pct)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CEO Insights */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg font-semibold text-slate-900">Insights</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Top provider</span>
            <span className="font-medium text-slate-900">{topProvider}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Top provider share</span>
            <span className="font-medium text-slate-900">{nf1.format(topShare)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Concentration (HHI)</span>
            <span className="font-medium text-slate-900">{nf1.format(hhi * 100)} / 100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Run-rate (monthly avg)</span>
            <span className="font-medium text-slate-900">
              USD{" "}
              {nf0.format(
                Math.round(
                  totalSelectedUSD /
                    (timeRange === "year" ? 12 : timeRange === "last-3-months" ? 3 : 1)
                )
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Totals */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg font-semibold text-slate-900">Monthly Totals</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {loadingMonthly && (
            <div className="py-12 text-center text-slate-500">Loading monthly data…</div>
          )}

          {!loadingMonthly && monthlySeries.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              No monthly data found for this period.
            </div>
          )}

          {!loadingMonthly && monthlySeries.length > 0 && (
            <>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlySeries}
                    margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, yMax]} tickFormatter={(v) => nf0.format(Number(v))} />
                    <Tooltip
                      formatter={(value) => [`USD ${nf0.format(Number(value))}`, "USD"]}
                      labelFormatter={(label) => label}
                    />
                    <Legend />
                    <Bar dataKey="usd" name="USD" fill="#6366F1" />
                    <Line
                      type="monotone"
                      dataKey={() => monthlyAvg}
                      name="Monthly avg"
                      stroke="#0EA5E9"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Brush travellerWidth={8} height={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Small values table (helps verify what’s graphed) */}
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left p-1">Month</th>
                      <th className="text-left p-1">USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySeries.map((r) => (
                      <tr key={`${r.year}-${r.month}`} className="border-t border-slate-100">
                        <td className="p-1">{r.month}</td>
                        <td className="p-1">USD {nf0.format(r.usd || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((p, idx) => {
          const prev = Number(prevInsuranceBreakdown[p.name] || 0);
          const change = prev > 0 ? ((p.usd - prev) / prev) * 100 : 0;
          const pct =
            totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;
          const color = colorMap[p.name];
          return (
            <Card
              key={p.name}
              className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center"
                      style={{ background: toRGBA(color, 0.12) }}
                    >
                      <Shield className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{p.name}</h3>
                      <Badge
                        variant="secondary"
                        style={{
                          background: toRGBA(color, 0.12),
                          color,
                          borderColor: toRGBA(color, 0.24),
                        }}
                        className="text-xs"
                      >
                        {nf1.format(pct)}% of total
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Rank #{idx + 1}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      {timeRange === "last-3-months"
                        ? "Total (3 months)"
                        : timeRange === "year"
                        ? "Total (Year)"
                        : "Revenue"}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      USD {nf0.format(Math.round(p.usd))}
                    </span>
                  </div>

                  <div
                    className="h-2 w-full rounded-full"
                    style={{ background: toRGBA(color, 0.12) }}
                  >
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: color,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      vs{" "}
                      {timeRange === "current-month"
                        ? "Last Month"
                        : timeRange === "last-month"
                        ? "Current Month"
                        : timeRange === "last-3-months"
                        ? "Previous 3 Months"
                        : timeRange === "year"
                        ? "Previous Year"
                        : "Previous Period"}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        change > 0
                          ? "text-emerald-600"
                          : change < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {change > 0 ? "+" : ""}
                      {nf1.format(change)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {providers.length === 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Insurance Data
            </h3>
            <p className="text-slate-600">
              No insurance transactions found for the selected period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
