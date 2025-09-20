'use client';

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
} from "recharts";

/* -------------------------------- Helpers -------------------------------- */

type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const BASE_COLORS = ["#6366F1","#22C55E","#F59E0B","#06B6D4","#EF4444","#A855F7","#84CC16","#10B981","#F97316","#14B8A6"];
const toRGBA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const MAX_SEGMENTS = 7;

function parseQuery(search: string) {
  const qs = new URLSearchParams(search.startsWith("?") ? search : (search.split("?")[1] || ""));
  const range = (qs.get("range") || "current-month") as TimeRange;
  const year = qs.get("year") ? parseInt(qs.get("year")!) : undefined;
  const month = qs.get("month") ? parseInt(qs.get("month")!) : undefined;
  const startDate = qs.get("startDate") ? new Date(qs.get("startDate")!) : undefined;
  const endDate   = qs.get("endDate")   ? new Date(qs.get("endDate")!)   : undefined;
  return { range, year, month, startDate, endDate };
}

/* --------------------------- Page Component --------------------------- */

export default function InsuranceProvidersPage() {
  const [location] = useLocation();
  const now = new Date();

  const [timeRange, setTimeRange] = useState<TimeRange>("current-month");
  const [selectedYear, setSelectedYear]   = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate,   setCustomEndDate]   = useState<Date | undefined>();

  // 🔄 Sync local state with query-string whenever it changes
  useEffect(() => {
    const { range, year, month, startDate, endDate } = parseQuery(location);
    setTimeRange(range);

    if (range === "custom") {
      if (startDate) setCustomStartDate(startDate);
      if (endDate)   setCustomEndDate(endDate);
      if (startDate) setSelectedYear(startDate.getFullYear());
      if (startDate) setSelectedMonth(startDate.getMonth() + 1);
      return;
    }
    if (range === "month-select") {
      setSelectedYear(year ?? now.getFullYear());
      setSelectedMonth(month ?? (now.getMonth() + 1));
    } else if (range === "last-month") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setSelectedYear(year ?? lm.getFullYear());
      setSelectedMonth(month ?? (lm.getMonth() + 1));
    } else if (range === "year") {
      setSelectedYear(year ?? now.getFullYear());
      setSelectedMonth(1);
    } else {
      setSelectedYear(year ?? now.getFullYear());
      setSelectedMonth(month ?? (now.getMonth() + 1));
    }
  }, [location, now]);

  // UI choices
  const thisYear = now.getFullYear();
  const years = useMemo(() => [thisYear, thisYear - 1, thisYear - 2], [thisYear]);
  const months = [
    { label: "January", value: 1 },{ label: "February", value: 2 },{ label: "March", value: 3 },
    { label: "April", value: 4 },{ label: "May", value: 5 },{ label: "June", value: 6 },
    { label: "July", value: 7 },{ label: "August", value: 8 },{ label: "September", value: 9 },
    { label: "October", value: 10 },{ label: "November", value: 11 },{ label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    const today = new Date();
    switch (range) {
      case "current-month":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;
      case "last-month": {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        setSelectedYear(lm.getFullYear());
        setSelectedMonth(lm.getMonth() + 1);
        break;
      }
      case "last-3-months":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;
      case "year":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(1);
        break;
      case "month-select":
      case "custom":
        break;
    }
  };

  // For API calls: treat 'month-select' like 'current-month' but with explicit y/m
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
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

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
  const insuranceBreakdown: Record<string, number> = (dashboardData?.insuranceBreakdown as any) || {};
  const prevInsuranceBreakdown: Record<string, number> =
    (comparisonData?.insuranceBreakdown as any) || {};

  // providers (sorted)
  const providers = useMemo(() => {
    const arr = Object.entries(insuranceBreakdown).map(([name, v]) => ({ name, usd: Number(v) || 0 }));
    return arr.sort((a, b) => b.usd - a.usd);
  }, [insuranceBreakdown]);

  const totalSelectedUSD = providers.reduce((s, p) => s + p.usd, 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce(
    (s, v) => s + (Number(v) || 0), 0
  );
  const overallChange =
    totalComparisonUSD > 0 ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100 : 0;

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    providers.forEach((p, i) => { map[p.name] = BASE_COLORS[i % BASE_COLORS.length]; });
    map["Other"] = "#CBD5E1";
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

  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month"   ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    timeRange === "custom" && customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  /* -------------------------------- UI -------------------------------- */

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header / controls */}
      <header className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-start gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                Insurance<br className="hidden md:block" /> Providers
              </h1>
              <p className="text-slate-600 mt-1 md:mt-2">Detailed breakdown · {headerLabel}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="relative z-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="hidden md:block w-[280px]" aria-hidden="true" />
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
                    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                      <SelectTrigger className="h-9 w-full sm:w-[120px]">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {timeRange === "custom" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("h-9 justify-start text-left font-normal w-full sm:w-auto",
                            !customStartDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12}
                        className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                        style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}>
                        <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                          selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                      </PopoverContent>
                    </Popover>

                    <span aria-hidden className="text-muted-foreground mx-1 hidden sm:inline">to</span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline"
                          className={cn("h-9 justify-start text-left font-normal w-full sm:w-auto",
                            !customEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12}
                        className="p-2 w=[280px] bg-white border border-gray-200 shadow-2xl"
                        style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}>
                        <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                          selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Overview KPI row */}
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
                {overallChange >= 0
                  ? <TrendingUp className="h-5 w-5 text-emerald-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs {normalizedRange === "current-month" ? "Last Month"
                      : normalizedRange === "last-month" ? "Current Month"
                      : "Previous Period"}
                </p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {overallChange >= 0 ? "+" : ""}{nf1.format(overallChange)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share by provider (Donut) */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Share by Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No insurance data for this period.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={`cell-${i}`} fill={colorMap[d.name] || BASE_COLORS[i % BASE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p: any = payload[0].payload;
                        const name = p?.name ?? "";
                        const usd = Number(p?.value || 0);
                        const pct = totalSelectedUSD > 0 ? (usd / totalSelectedUSD) * 100 : 0;
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                            <div className="font-semibold text-slate-900 mb-1">{name}</div>
                            <div className="text-slate-700">
                              USD {nf0.format(Math.round(usd))} · {nf1.format(pct)}%
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {donutLegend.map((item) => (
                  <div key={item.name}
                    className="flex items-center justify-between gap-3 border rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block h-3 w-3 rounded-sm"
                        style={{ background: item.color }} />
                      <span className="truncate text-sm text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900">
                        USD {nf0.format(Math.round(item.usd))}
                      </div>
                      <div className="text-xs text-slate-500">{nf1.format(item.pct)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider list cards */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No Insurance Data
              <div className="text-xs mt-1">No insurance transactions found for the selected period.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((p, idx) => {
                const prev = Number(prevInsuranceBreakdown[p.name] || 0);
                const deltaPct = prev > 0 ? ((p.usd - prev) / prev) * 100 : 0;
                const color = colorMap[p.name] || BASE_COLORS[idx % BASE_COLORS.length];
                const pctOfTotal = totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;

                return (
                  <div key={p.name} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                        <span className="truncate font-medium text-slate-900">{p.name}</span>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {pctOfTotal.toFixed(1)}%
                      </Badge>
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">
                        USD {nf0.format(Math.round(p.usd))}
                      </span>
                      <span className={`ml-2 ${deltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {deltaPct >= 0 ? "+" : ""}
                        {nf1.format(deltaPct)}%
                      </span>
                      <span className="text-slate-400 ml-1">vs previous</span>
                    </div>

                    <div className="mt-3 h-2 rounded bg-slate-100 overflow-hidden">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${Math.min(100, pctOfTotal)}%`,
                          background: `linear-gradient(90deg, ${toRGBA(color,0.9)}, ${toRGBA(color,0.7)})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional monthly totals list (quick debug/insight) */}
      {monthlyInsurance?.data?.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardHeader><CardTitle>Insurance Revenue by Month</CardTitle></CardHeader>
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
