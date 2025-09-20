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

// Recharts
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
} from "recharts";

/* -------------------------------- Helpers -------------------------------- */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const BASE_COLORS = [
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

// light track color for progress bars
const toRGBA = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// max # of visible providers in donut (the rest grouped as "Other")
const MAX_SEGMENTS = 7;

/* --------------------------- Page Component --------------------------- */

type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

export default function InsuranceProvidersPage() {
  // read URL params (compat with links coming from dashboard)
  const urlParams = new URLSearchParams(window.location.search);
  const rangeParam = (urlParams.get("range") || "current-month") as TimeRange;
  const startDateParam = urlParams.get("startDate");
  const endDateParam   = urlParams.get("endDate");
  const yearParam  = urlParams.get("year");
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

  // state
  const initial = getInitialYearMonth();
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [timeRange, setTimeRange] = useState<TimeRange>(rangeParam);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

  // month-select choices
  const thisYear = now.getFullYear();
  const years = useMemo(() => [thisYear, thisYear - 1, thisYear - 2], [thisYear]);
  const months = [
    { label: "January", value: 1 },
    { label: "February", value: 2 },
    { label: "March", value: 3 },
    { label: "April", value: 4 },
    { label: "May", value: 5 },
    { label: "June", value: 6 },
    { label: "July", value: 7 },
    { label: "August", value: 8 },
    { label: "September", value: 9 },
    { label: "October", value: 10 },
    { label: "November", value: 11 },
    { label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    const now = new Date();

    switch (range) {
      case "current-month":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case "last-month": {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1);
        setSelectedYear(lm.getFullYear());
        setSelectedMonth(lm.getMonth() + 1);
        break;
      }
      case "last-3-months":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case "year":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(1);
        break;
      case "month-select":
        // keep current selections; user will choose year/month below
        break;
      case "custom":
        // keep custom dates as-is
        break;
    }
  };

  // normalize: when month-select is active, tell backend "current-month" but include explicit year/month
  const normalizedRange = timeRange === "month-select" ? "current-month" : timeRange;

  /* ----------------------------- Queries ----------------------------- */

  const { data: dashboardData } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      normalizedRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
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
  });

  // comparison (kept: only meaningful for current-month vs last-month navigation)
  const { data: comparisonData } = useQuery({
    queryKey: ["/api/dashboard/comparison", selectedYear, selectedMonth, normalizedRange],
    queryFn: async () => {
      let compYear = selectedYear;
      let compMonth = selectedMonth;

      if (normalizedRange === "current-month") {
        const lm = new Date(selectedYear, selectedMonth - 2);
        compYear = lm.getFullYear();
        compMonth = lm.getMonth() + 1;
      } else if (normalizedRange === "last-month") {
        const today = new Date();
        compYear = today.getFullYear();
        compMonth = today.getMonth() + 1;
      }

      const url = `/api/dashboard?year=${compYear}&month=${compMonth}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: normalizedRange === "current-month" || normalizedRange === "last-month",
  });

  // monthly insurance totals
  const { data: monthlyInsurance } = useQuery({
    queryKey: [
      "/api/insurance/monthly",
      selectedYear,
      selectedMonth,
      normalizedRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch insurance monthly data");
      return res.json();
    },
  });

  // breakdowns
  const insuranceBreakdown: Record<string, number> =
    (dashboardData?.insuranceBreakdown as any) || {};
  const prevInsuranceBreakdown: Record<string, number> =
    (comparisonData?.insuranceBreakdown as any) || {};

  const providers = useMemo(() => {
    const arr = Object.entries(insuranceBreakdown).map(([name, v]) => ({
      name,
      usd: Number(v) || 0,
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

  /* ------------------------ Color map & donut data ------------------------ */

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    providers.forEach((p, i) => {
      map[p.name] = BASE_COLORS[i % BASE_COLORS.length];
    });
    map["Other"] = "#CBD5E1"; // slate-300
    return map;
  }, [providers]);

  const donutData = useMemo(() => {
    if (!providers.length) return [];
    const top = providers.slice(0, MAX_SEGMENTS);
    const leftover = providers.slice(MAX_SEGMENTS);
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

  /* ------------------------------- Render ------------------------------- */

  // header label
  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    timeRange === "custom" && customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header (mobile-first, stacks filter below title) */}
      <header className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Row 1: back + titles */}
          <div className="flex items-start gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                Insurance
                <br className="hidden md:block" />
                {" "}Providers
              </h1>
              <p className="text-slate-600 mt-1 md:mt-2">
                Detailed breakdown · {headerLabel}
              </p>
            </div>
          </div>

          {/* Row 2: date filter (z-50 so popovers are never clipped) */}
          <div className="relative z-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Left spacer on desktop keeps alignment with title block */}
              <div className="hidden md:block w-[280px]" aria-hidden="true" />

              {/* Controls */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current-month">Current Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="month-select">Select Month…</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                {timeRange === "month-select" && (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <Select
                      value={String(selectedYear)}
                      onValueChange={(v) => setSelectedYear(Number(v))}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[120px]">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={String(selectedMonth)}
                      onValueChange={(v) => setSelectedMonth(Number(v))}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[140px]">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {timeRange === "custom" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 justify-start text-left font-normal w-full sm:w-auto",
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

                    <span aria-hidden="true" className="text-muted-foreground mx-1 hidden sm:inline">
                      to
                    </span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 justify-start text-left font-normal w-full sm:w-auto",
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
                  USD {nf0.format(Math.round(providers.reduce((s,p)=>s+p.usd,0)))}
                </p>
                <p className="text-xs text-slate-500">{headerLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{providers.length}</p>
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
                  vs {normalizedRange === "current-month" ? "Last Month" :
                       normalizedRange === "last-month"   ? "Current Month" : "Previous Period"}
                </p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {overallChange >= 0 ? "+" : ""}{nf1.format(overallChange)}%
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
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />
                    <span className="text-slate-800">{x.name}</span>
                    <span className="ml-auto text-slate-600">USD {nf0.format(Math.round(x.usd))}</span>
                    <span className="w-14 text-right text-slate-500">{nf1.format(x.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((p, idx) => {
          const prev = Number(prevInsuranceBreakdown[p.name] || 0);
          const change = prev > 0 ? ((p.usd - prev) / prev) * 100 : 0;
          const pct = totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;
          const color = colorMap[p.name];

          return (
            <Card key={p.name} className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: toRGBA(color, 0.12) }}>
                      <Shield className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{p.name}</h3>
                      <Badge
                        variant="secondary"
                        style={{ background: toRGBA(color, 0.12), color, borderColor: toRGBA(color, 0.24) }}
                        className="text-xs"
                      >
                        {nf1.format(pct)}% of total
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Rank #{idx + 1}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      {normalizedRange === "last-3-months" ? "Total (3 months)" :
                       normalizedRange === "year" ? "Total (Year)" : "Revenue"}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(p.usd))}</span>
                  </div>

                  <div className="h-2 w-full rounded-full" style={{ background: toRGBA(color, 0.12) }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      vs {normalizedRange === "current-month" ? "Last Month" :
                          normalizedRange === "last-month"   ? "Current Month" :
                          normalizedRange === "last-3-months" ? "Previous 3 Months" :
                          normalizedRange === "year" ? "Previous Year" : "Previous Period"}
                    </span>
                    <span className={`text-sm font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-slate-500"}`}>
                      {change > 0 ? "+" : ""}{nf1.format(change)}%
                    </span>
                  </div>

                  {(normalizedRange === "last-3-months" || normalizedRange === "year") && p.usd > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-500">Monthly Average</span>
                      <span className="text-xs font-mono text-slate-500">
                        USD {nf0.format(Math.round(p.usd / (normalizedRange === "year" ? 12 : 3)))}
                      </span>
                    </div>
                  )}

                  {prev > 0 && normalizedRange !== "last-3-months" && normalizedRange !== "year" && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        {normalizedRange === "current-month" ? "Previous" :
                         normalizedRange === "last-month"   ? "Current" : "Previous Period"}
                      </span>
                      <span className="text-xs font-mono text-slate-500">USD {nf0.format(Math.round(prev))}</span>
                    </div>
                  )}
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
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Insurance Data</h3>
            <p className="text-slate-600">No insurance transactions found for the selected period.</p>
          </CardContent>
        </Card>
      )}

      {/* Monthly totals list (optional) */}
      {monthlyInsurance && monthlyInsurance.data && monthlyInsurance.data.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardHeader>
            <CardTitle>Insurance Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {monthlyInsurance.data.map((entry: any) => (
                <li key={`${entry.year}-${entry.month}`} className="text-sm text-slate-700">
                  {entry.month} {entry.year}: USD {nf0.format(Math.round(entry.usd))}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
