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
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Shield,
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

export default function InsuranceProvidersPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const rangeParam = (urlParams.get("range") || "current-month") as
    | "current-month"
    | "last-month"
    | "last-3-months"
    | "year"
    | "custom";
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

  const [timeRange, setTimeRange] = useState<
    "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  >(rangeParam);

  const [selectedYear, setSelectedYear] = useState(getInitialYearMonth().year);
  const [selectedMonth, setSelectedMonth] = useState(getInitialYearMonth().month);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

  const handleTimeRangeChange = (
    range: "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  ) => {
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
    }
  };

  /* ----------------------------- Queries ----------------------------- */

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
      const params = new URLSearchParams();
      params.set("year", String(selectedYear));
      params.set("month", String(selectedMonth));
      params.set("range", timeRange);

      if (timeRange === "custom" && customStartDate && customEndDate) {
        params.set("startDate", format(customStartDate, "yyyy-MM-dd"));
        params.set("endDate", format(customEndDate, "yyyy-MM-dd"));
      }

      const url = `/api/dashboard?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard data");
      return res.json();
    },
  });

  const { data: comparisonDashboard } = useQuery({
    queryKey: [
      "/api/dashboard-comparison",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
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
  });

  // NEW: fetch monthly insurance totals for charts or lists
  const { data: monthlyInsurance } = useQuery({
    queryKey: [
      "/api/insurance/monthly",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  /* ----------------------------- Derived data ----------------------------- */

  const providers = useMemo(() => {
    const list =
      dashboardData?.insuranceBreakdown && Array.isArray(dashboardData.insuranceBreakdown)
        ? dashboardData.insuranceBreakdown
        : [];

    // Normalize and sort by USD desc
    const normalized = list
      .map((p: any) => ({ name: String(p.name || p.provider || "Unknown"), usd: Number(p.usd || 0) }))
      .sort((a: any, b: any) => b.usd - a.usd);

    return normalized;
  }, [dashboardData]);

  const prevInsuranceBreakdown = useMemo(() => {
    if (!comparisonDashboard?.insuranceBreakdown) return {};
    const map: Record<string, number> = {};
    (comparisonDashboard.insuranceBreakdown as any[]).forEach((p) => {
      const name = String(p.name || p.provider || "Unknown");
      map[name] = Number(p.usd || 0);
    });
    return map;
  }, [comparisonDashboard]);

  const totalSelectedUSD = providers.reduce((s: number, p: any) => s + (p.usd || 0), 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce(
    (s: number, v: any) => s + (Number(v) || 0),
    0
  );
  const overallChange =
    totalComparisonUSD > 0
      ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100
      : 0;

  /* ------------------------ Color map & donut data ------------------------ */

  // Build consistent color map for all UI
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    providers.forEach((p, i) => {
      map[p.name] = BASE_COLORS[i % BASE_COLORS.length];
    });
    // Color for "Other"
    map["Other"] = "#CBD5E1"; // slate-300
    return map;
  }, [providers]);

  // Donut = top N + "Other"
  const donutData = useMemo(() => {
    if (!providers.length) return [];
    const top = providers.slice(0, MAX_SEGMENTS);
    const leftover = providers.slice(MAX_SEGMENTS);
    const otherTotal = leftover.reduce((s, p) => s + p.usd, 0);
    const data = [...top];
    if (otherTotal > 0) data.push({ name: "Other", usd: otherTotal });
    return data.map((d) => ({ name: d.name, value: d.usd }));
  }, [providers]);

  // Legend list for donut (matches donutData order)
  const donutLegend = donutData.map((d) => ({
    name: d.name,
    value: d.value,
    color: colorMap[d.name],
  }));

  const rangeLabel =
    timeRange === "current-month"
      ? "Current month"
      : timeRange === "last-month"
      ? "Last month"
      : timeRange === "last-3-months"
      ? "Last 3 months"
      : timeRange === "year"
      ? "This year"
      : customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} – ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom";

  /* --------------------------------- UI --------------------------------- */

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6">

      {/* Sticky header: back, title, filters */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Insurance Providers</h1>
              <p className="text-slate-600 text-sm md:text-base">
                Detailed breakdown · {rangeLabel}
              </p>
            </div>
          </div>

          {/* Filters: mobile pills + desktop select/date */}
          <div className="w-full md:w-auto">
            {/* Mobile pills */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-1">
              {[
                { k: "last-3-months", label: "Last 3 Months" },
                { k: "year", label: "This Year" },
                { k: "custom", label: "Custom" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => handleTimeRangeChange(opt.k as any)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 rounded-full text-sm border",
                    timeRange === opt.k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Desktop select + custom date pickers */}
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
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
                      className="p-2 w-[300px] bg-white border border-gray-200 shadow-2xl z-[50000]"
                      avoidCollisions
                      collisionPadding={15}
                    >
                      <DatePicker
                        mode="single"
                        selected={customStartDate}
                        onSelect={(d) => setCustomStartDate(d ?? undefined)}
                        fromDate={new Date(2022, 0, 1)}
                        toDate={new Date()}
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
                      className="p-2 w-[300px] bg-white border border-gray-200 shadow-2xl z-[50000]"
                      avoidCollisions
                      collisionPadding={15}
                    >
                      <DatePicker
                        mode="single"
                        selected={customEndDate}
                        onSelect={(d) => setCustomEndDate(d ?? undefined)}
                        fromDate={new Date(2022, 0, 1)}
                        toDate={new Date()}
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

      {/* Overview */}
      <Card className="border-0 shadow-md bg-white mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Insurance Revenue Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">
                  USD {nf0.format(Math.round(totalSelectedUSD))}
                </p>
                <p className="text-xs text-slate-500">{rangeLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{providers.length}</p>
                <p className="text-xs text-slate-500">with transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <ChevronRight className="h-5 w-5 text-emerald-600" />
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
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="md:col-span-2">
              <div className="h-60 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip
                      cursor={{ fill: "rgba(148,163,184,0.1)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const p: any = payload[0];
                        const total = donutData.reduce((s, x) => s + (x.value || 0), 0);
                        const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0";
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

              <div className="mt-2 text-center text-xs text-slate-500 md:hidden">
                Tap the legend to toggle providers.
              </div>
            </div>

            <div className="space-y-2">
              {donutLegend.map((x) => (
                <div key={x.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: x.color }}
                  />
                  <span className="text-slate-700 flex-1">{x.name}</span>
                  <span className="text-slate-500">
                    USD {nf0.format(Math.round(x.value))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {providers.map((p: any) => {
          const prev = Number(prevInsuranceBreakdown[p.name] || 0);
          const change = prev > 0 ? ((p.usd - prev) / prev) * 100 : 0;
          const pct = totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;
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
                        {pct.toFixed(1)}% of total
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-slate-900">
                      USD {nf0.format(Math.round(p.usd))}
                    </span>
                  </div>
                </div>

                {/* progress */}
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

                {/* change vs previous */}
                <div className="flex justify-between items-center mt-2">
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
                    className={cn(
                      "text-sm font-medium",
                      change >= 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {change >= 0 ? "+" : ""}
                    {nf1.format(change)}%
                  </span>
                </div>

                {/* helpful smalls */}
                {p.usd > 0 && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500">Monthly Average</span>
                    <span className="text-xs font-mono text-slate-500">
                      USD{" "}
                      {nf0.format(Math.round(p.usd / (timeRange === "year" ? 12 : 3)))}
                    </span>
                  </div>
                )}

                {prev > 0 && timeRange !== "last-3-months" && timeRange !== "year" && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {timeRange === "current-month"
                        ? "Previous"
                        : timeRange === "last-month"
                        ? "Current"
                        : "Previous Period"}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      USD {nf0.format(Math.round(prev))}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Optional: dump monthly data if available (kept from your original) */}
      {monthlyInsurance?.data?.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Monthly Totals (raw)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-700">
              {monthlyInsurance.data.map((entry: any) => (
                <li key={`${entry.year}-${entry.month}`}>
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
