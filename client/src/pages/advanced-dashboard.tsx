'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
  TrendingUp, TrendingDown, DollarSign, Users, CalendarIcon, Shield, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/queryClient";

import { useDateFilter } from "@/context/date-filter-context";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import RevenueAnalyticsDaily from "@/components/dashboard/revenue-analytics-daily";

/* ================== number helpers ================== */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

/* ================== range helper ================== */
function computeRangeParams(timeRange: string, selectedYear: number | null, selectedMonth: number | null) {
  const today = new Date();
  const fallbackY = today.getFullYear();
  const fallbackM = today.getMonth() + 1;

  if (timeRange === "last-month") {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { rangeToSend: "current-month", yearToSend: d.getFullYear(), monthToSend: d.getMonth() + 1 };
  }
  if (timeRange === "month-select") {
    return {
      rangeToSend: "current-month",
      yearToSend: selectedYear ?? fallbackY,
      monthToSend: selectedMonth ?? fallbackM,
    };
  }
  return {
    rangeToSend: timeRange,
    yearToSend: selectedYear ?? fallbackY,
    monthToSend: selectedMonth ?? fallbackM,
  };
}

/* ================== Insurance Providers Card ================== */
function InsuranceProvidersUSD({
  breakdown,
  totalUSD,
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: {
  breakdown?: Record<string, number> | Array<{ name?: string; provider?: string; amount?: number; total?: number }>;
  totalUSD: number;
  timeRange: string;
  selectedYear?: number | null;
  selectedMonth?: number | null;
  customStartDate?: Date;
  customEndDate?: Date;
}) {
  const rows = useMemo(() => {
    if (!breakdown) return [] as { name: string; amount: number }[];
    if (Array.isArray(breakdown)) {
      return breakdown
        .map((r) => ({ name: String(r.name ?? r.provider ?? "Unknown"), amount: Number(r.amount ?? r.total ?? 0) }))
        .filter((r) => r.amount > 0);
    }
    return Object.entries(breakdown)
      .map(([name, amount]) => ({ name, amount: Number(amount) }))
      .filter((r) => r.amount > 0);
  }, [breakdown]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const displayTotal = computedTotal > 0 ? computedTotal : Number(totalUSD || 0);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);

  const palette = ["#00A3A3", "#4F46E5", "#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#EA580C", "#06B6D4"];

  const base = `/insurance-providers?range=${timeRange}`;
  const viewAllHref =
    timeRange === "custom" && customStartDate && customEndDate
      ? `${base}&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`
      : `${base}&year=${selectedYear}&month=${selectedMonth}`;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full" /> Insurance Providers (USD)
        </CardTitle>
        <Link href={viewAllHref}>
          <Button variant="outline" size="sm">View all</Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-slate-500">
          Totals in period: <span className="font-mono">USD {fmtUSD(displayTotal)}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-sm text-slate-500">No insurance receipts for this period.</div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item, idx) => {
              const pct = displayTotal > 0 ? (item.amount / displayTotal) * 100 : 0;
              const color = palette[idx % palette.length];
              return (
                <div key={`${item.name}-${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-600">USD {fmtUSD(item.amount)}</div>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden">
                    <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================== Page ================== */
export default function AdvancedDashboard() {
  const {
    timeRange, selectedYear, selectedMonth,
    customStartDate, customEndDate,
    setTimeRange, setCustomRange, setSpecificMonth, periodLabel,
  } = useDateFilter();

  const [openExpenses, setOpenExpenses] = useState(false);

  const { rangeToSend, yearToSend, monthToSend } = computeRangeParams(
    timeRange, selectedYear ?? null, selectedMonth ?? null
  );

  const handleTimeRangeChange = (
    range: "current-month" | "last-month" | "last-3-months" | "year" | "month-select" | "custom"
  ) => setTimeRange(range);

  /* ---- Sticky offsets & shadow ---- */
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(64); // measured page header height (title + date)
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.getBoundingClientRect().height || 64);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update, { passive: true });
    return () => { ro?.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  /* ---- queries ---- */
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard", yearToSend, monthToSend, rangeToSend, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard?year=${yearToSend}&month=${monthToSend}&range=${rangeToSend}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  const { data: rawIncome } = useQuery({
    queryKey: ["/api/income-trends", yearToSend, monthToSend, rangeToSend, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/income-trends/${yearToSend}/${monthToSend}?range=${rangeToSend}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  /* ---- build income series (unchanged) ---- */
  let incomeSeries: Array<{ day: number; amount: number; amountSSP: number; amountUSD: number; label: string; fullDate: string; }> = [];
  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    incomeSeries = rawIncome.map((r: any, i: number) => ({
      day: i + 1,
      amount: Number(r.income ?? r.amount ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSP: Number(r.incomeSSP ?? (r.income ?? r.amount ?? 0)),
      label: r.date,
      fullDate: r.date,
    }));
  } else {
    const y = yearToSend!;
    const m = monthToSend!;
    const daysInMonth = new Date(y, m, 0).getDate();
    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1, amount: 0, amountUSD: 0, amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(y, m - 1, i + 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }));
    if (Array.isArray(rawIncome)) {
      for (const r of rawIncome as any[]) {
        let d = (r as any).day;
        if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
        if (!d && (r as any).date) d = new Date((r as any).date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          incomeSeries[d - 1].amountUSD += Number((r as any).incomeUSD ?? 0);
          incomeSeries[d - 1].amountSSP += Number((r as any).incomeSSP ?? 0);
          incomeSeries[d - 1].amount += Number((r as any).income ?? (r as any).amount ?? 0);
        }
      }
    }
  }

  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || "0");
  const usdIncome = parseFloat(dashboardData?.totalIncomeUSD || "0");
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || "0");
  const sspRevenue = monthTotalSSP || sspIncome;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  /* ------- shared KPI grid ------- */
  const KpiGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
      {/* Total Revenue */}
      <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
        <CardContent className="p-4 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
              <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                SSP {nf0.format(Math.round(sspRevenue))}
              </p>
              {dashboardData?.changes?.incomeChangeSSP !== undefined && (
                <span className={`text-xs font-medium ${
                  dashboardData.changes.incomeChangeSSP > 0 ? "text-emerald-600" :
                  dashboardData.changes.incomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
                }`}>
                  {dashboardData.changes.incomeChangeSSP > 0 ? "+" : ""}
                  {dashboardData.changes.incomeChangeSSP.toFixed(1)}% vs last month
                </span>
              )}
            </div>
            <div className="bg-emerald-50 p-1.5 rounded-lg">
              {dashboardData?.changes?.incomeChangeSSP !== undefined &&
              dashboardData.changes.incomeChangeSSP < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (<TrendingUp className="h-4 w-4 text-emerald-600" />)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Expenses */}
      <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setOpenExpenses(true)} title="Click to view expense breakdown">
        <CardContent className="p-4 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
              <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                SSP {nf0.format(Math.round(totalExpenses))}
              </p>
              {dashboardData?.changes?.expenseChangeSSP !== undefined && (
                <span className={`text-xs font-medium ${
                  dashboardData.changes.expenseChangeSSP > 0 ? "text-red-600" :
                  dashboardData.changes.expenseChangeSSP < 0 ? "text-emerald-600" : "text-slate-500"
                }`}>
                  {dashboardData.changes.expenseChangeSSP > 0 ? "+" : ""}
                  {dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                </span>
              )}
            </div>
            <div className="bg-red-50 p-1.5 rounded-lg">
              {dashboardData?.changes?.expenseChangeSSP !== undefined &&
              dashboardData.changes.expenseChangeSSP < 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              ) : (<TrendingUp className="h-4 w-4 text-red-600" />)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Income */}
      <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
        <CardContent className="p-4 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-xs font-medium">Net Income</p>
              <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                SSP {nf0.format(Math.round(sspRevenue - totalExpenses))}
              </p>
              {dashboardData?.changes?.netIncomeChangeSSP !== undefined && (
                <span className={`text-xs font-medium ${
                  dashboardData.changes.netIncomeChangeSSP > 0 ? "text-emerald-600" :
                  dashboardData.changes.netIncomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
                }`}>
                  {dashboardData.changes.netIncomeChangeSSP > 0 ? "+" : ""}
                  {dashboardData.changes.netIncomeChangeSSP.toFixed(1)}% vs last month
                </span>
              )}
            </div>
            <div className="bg-blue-50 p-1.5 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insurance (USD) */}
      <Link href={`/insurance-providers?range=${rangeToSend}${
        timeRange === "custom" && customStartDate && customEndDate
          ? `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`
          : `&year=${yearToSend}&month=${monthToSend}`
      }`}>
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  USD {fmtUSD(Math.round(usdIncome))}
                </p>
                {dashboardData?.changes?.incomeChangeUSD !== undefined && (
                  <span className={`text-xs font-medium ${
                    dashboardData.changes.incomeChangeUSD > 0 ? "text-emerald-600" :
                    dashboardData.changes.incomeChangeUSD < 0 ? "text-red-600" : "text-slate-500"
                  }`}>
                    {dashboardData.changes.incomeChangeUSD > 0 ? "+" : ""}
                    {dashboardData.changes.incomeChangeUSD.toFixed(1)}% vs last month
                  </span>
                )}
              </div>
              <div className="bg-purple-50 p-1.5 rounded-lg"><Shield className="h-4 w-4 text-purple-600" /></div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Patients */}
      <Link href={`/patient-volume?view=monthly&year=${yearToSend}&month=${monthToSend}&range=${rangeToSend}`}>
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Patients</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  {(dashboardData?.totalPatients || 0).toLocaleString()}
                </p>
                <span className="text-xs font-medium text-teal-600">Current period</span>
              </div>
              <div className="bg-teal-50 p-1.5 rounded-lg"><Users className="h-4 w-4 text-teal-600" /></div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900">
      {/* Sticky header (Title + Date) — offset under global topbar */}
      <div
        ref={headerRef}
        className={`sticky z-30 bg-white dark:bg-slate-900 ${scrolled ? "shadow-sm" : ""}`}
        style={{ top: "var(--shell-top, 56px)" }}
      >
        <div className="p-6">
          <header className="mb-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
              <div>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
                  Executive Dashboard
                </h1>
                <div className="mt-1 flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">Key financials · {periodLabel}</p>
                </div>
              </div>

              {/* Date / Range controls */}
              <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
                <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                  <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
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
                  <>
                    <Select
                      value={String(selectedYear)}
                      onValueChange={(val) => setSpecificMonth(Number(val), selectedMonth || 1)}
                    >
                      <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>
                        {[ (new Date()).getFullYear(), (new Date()).getFullYear()-1, (new Date()).getFullYear()-2 ].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={String(selectedMonth)}
                      onValueChange={(val) => setSpecificMonth(selectedYear || (new Date()).getFullYear(), Number(val))}
                    >
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {[
                          "January","February","March","April","May","June",
                          "July","August","September","October","November","December",
                        ].map((m, i) => (
                          <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {timeRange === "custom" && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12}
                        className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                        style={{ zIndex: 50000, backgroundColor: "rgb(255,255,255)" }}
                        avoidCollisions collisionPadding={15}
                      >
                        <DatePicker
                          mode="single" numberOfMonths={1} showOutsideDays={false}
                          selected={customStartDate ?? undefined}
                          onSelect={(d) => setCustomRange(d ?? undefined, customEndDate)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <span aria-hidden className="text-muted-foreground">to</span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12}
                        className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                        style={{ zIndex: 50000, backgroundColor: "rgb(255,255,255)" }}
                        avoidCollisions collisionPadding={15}
                      >
                        <DatePicker
                          mode="single" numberOfMonths={1} showOutsideDays={false}
                          selected={customEndDate ?? undefined}
                          onSelect={(d) => setCustomRange(customStartDate, d ?? undefined)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>
      </div>

      {/* KPI cards: mobile (non-sticky) */}
      <div className="md:hidden p-6 pt-4">
        <KpiGrid />
      </div>

      {/* KPI cards: desktop (sticky under header) — offset by shell + header height */}
      <div
        className="hidden md:block sticky z-20 bg-white dark:bg-slate-900"
        style={{ top: `calc(var(--shell-top, 56px) + ${headerH}px)` }}
      >
        <div className={`p-6 pt-4 ${scrolled ? "shadow-sm" : ""}`}>
          <KpiGrid />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-8">
          <div className="space-y-6">
            <RevenueAnalyticsDaily
              timeRange={rangeToSend}
              selectedYear={yearToSend}
              selectedMonth={monthToSend}
              customStartDate={customStartDate ?? undefined}
              customEndDate={customEndDate ?? undefined}
            />

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <a href="/transactions" className="block">
                    <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-slate-900">Add Transaction</span>
                        <span className="text-xs text-slate-500">Record new income or expense</span>
                      </div>
                    </Button>
                  </a>
                  <a href="/patient-volume" className="block">
                    <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-slate-900">Patient Volume</span>
                        <span className="text-xs text-slate-500">Update patient count</span>
                      </div>
                    </Button>
                  </a>
                  <a href="/reports" className="block">
                    <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-slate-900">Monthly Reports</span>
                        <span className="text-xs text-slate-500">View generated reports</span>
                      </div>
                    </Button>
                  </a>
                  <a href="/users" className="block">
                    <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-slate-900">User Management</span>
                        <span className="text-xs text-slate-500">Manage user accounts</span>
                      </div>
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <DepartmentsPanel
              departments={Array.isArray(departments) ? (departments as any[]) : []}
              departmentBreakdown={dashboardData?.departmentBreakdown}
              totalSSP={sspRevenue}
            />

            <InsuranceProvidersUSD
              breakdown={dashboardData?.insuranceBreakdown}
              totalUSD={parseFloat(dashboardData?.totalIncomeUSD || "0")}
              timeRange={rangeToSend}
              selectedYear={yearToSend}
              selectedMonth={monthToSend}
              customStartDate={customStartDate ?? undefined}
              customEndDate={customEndDate ?? undefined}
            />

            <Card className="border border-slate-200 shadow-sm self-start">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" /> System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Database</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 rounded-full">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Last Sync</span>
                    <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Active Users</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">1 online</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ExpensesDrawer
          open={openExpenses}
          onOpenChange={setOpenExpenses}
          periodLabel={periodLabel}
          expenseBreakdown={dashboardData?.expenseBreakdown ?? {}}
          totalExpenseSSP={Number(dashboardData?.totalExpenses || 0)}
          onViewFullReport={() => { window.location.href = "/reports"; }}
        />
      </div>
    </div>
  );
}
