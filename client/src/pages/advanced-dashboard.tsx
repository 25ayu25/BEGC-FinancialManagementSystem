"use client";

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// --- UI IMPORTS ---
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";

// --- ICONS ---
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CalendarIcon,
  Shield,
  Minus,
  CreditCard,
  Activity,
  ArrowRight,
  Plus,
  FileText,
  Settings,
} from "lucide-react";

// --- DATA & CONTEXT ---
import { api } from "@/lib/queryClient";
import { useDateFilter } from "@/context/date-filter-context";

// --- SUB-COMPONENTS ---
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import RevenueAnalyticsDaily from "@/components/dashboard/revenue-analytics-daily";

/* ==================================================================================
   1. UTILITIES
   ================================================================================= */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const headerControlStyles =
  "h-9 bg-slate-900/60 text-slate-100 border border-slate-600/50 hover:border-cyan-400/80 hover:bg-slate-800/80 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-0";

/** Calculates the API parameters based on the selected time range */
function computeRangeParams(
  timeRange: string,
  selectedYear: number | null,
  selectedMonth: number | null
) {
  const today = new Date();
  const fallbackY = today.getFullYear();
  const fallbackM = today.getMonth() + 1;

  if (timeRange === "last-month") {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      rangeToSend: "current-month",
      yearToSend: d.getFullYear(),
      monthToSend: d.getMonth() + 1,
    };
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

/* ==================================================================================
   2. INTERNAL UI COMPONENTS
   ================================================================================= */

/**
 * The "World Class" KPI Card.
 */
interface KpiCardProps {
  title: string;
  value: number;
  currency?: string;
  change?: number;
  trendMode?: "normal" | "inverse"; // 'normal': Green is good. 'inverse': Red is good (expenses).
  icon: React.ReactNode;
  subText?: React.ReactNode;
  gradient: string;
  onClick?: () => void;
}

function KpiCard({
  title,
  value,
  currency = "SSP",
  change,
  trendMode = "normal",
  icon,
  subText,
  gradient,
  onClick,
}: KpiCardProps) {
  // Determine if the trend is "Good" or "Bad"
  const isPositive = change !== undefined && change > 0;
  const isNeutral = change === 0 || change === undefined;
  const isGood = trendMode === "normal" ? isPositive : !isPositive;

  // Dynamic Coloring
  const trendColor = isNeutral
    ? "text-slate-500 bg-slate-100"
    : isGood
    ? "text-emerald-700 bg-emerald-100/80"
    : "text-rose-700 bg-rose-100/80";

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-0 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300",
        "hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1 relative overflow-hidden",
        gradient,
        onClick && "cursor-pointer active:scale-95"
      )}
    >
      <CardContent className="p-5 relative z-10">
        {/* Glassy Background Effect */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20 blur-3xl pointer-events-none" />

        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-600/90 text-[11px] font-bold uppercase tracking-wider mb-1">
              {title}
            </p>
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-baseline gap-1">
              {currency && (
                <span className="text-sm text-slate-500 font-sans font-medium">
                  {currency}
                </span>
              )}
              <AnimatedNumber
                value={Math.round(value)}
                duration={1500}
                formatFn={(n) => nf0.format(Math.round(n))}
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              {change !== undefined && change !== null ? (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm border border-transparent/10",
                    trendColor
                  )}
                >
                  <TrendIcon className="w-3 h-3" />
                  {Math.abs(change).toFixed(1)}%
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium bg-slate-100/50 px-2 py-0.5 rounded-full">
                  No Data
                </span>
              )}
              {subText && (
                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[100px] sm:max-w-none">
                  {subText}
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/60 border border-white/50 shadow-sm backdrop-blur-sm text-slate-700">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading State */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 bg-slate-800 rounded-lg" />
          <Skeleton className="h-4 w-40 bg-slate-800 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 bg-slate-800 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-32 w-full bg-slate-800/50 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Skeleton className="h-[500px] w-full bg-slate-800/50 rounded-2xl" />
        <Skeleton className="h-[500px] w-full bg-slate-800/50 rounded-2xl" />
      </div>
    </div>
  );
}

/** Legacy Quick Actions */
function QuickActionsCard() {
  const actions = [
    { href: "/transactions", label: "Add Transaction", icon: Plus, color: "text-teal-600", bg: "bg-teal-100" },
    { href: "/patient-volume", label: "Patient Volume", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { href: "/reports", label: "Monthly Reports", icon: FileText, color: "text-purple-600", bg: "bg-purple-100" },
    { href: "/users", label: "User Management", icon: Settings, color: "text-orange-600", bg: "bg-orange-100" },
  ];
  
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="block group cursor-pointer">
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-4 px-4 hover:bg-slate-50 transition-all duration-200 group-hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg transition-colors", action.bg)}>
                      <action.icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <span className="font-medium text-slate-900">{action.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-all" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================================================================================
   3. LOGIC HOOK
   ================================================================================= */

function useDashboardAnalyticsInternal({
  year,
  month,
  range,
  customStart,
  customEnd,
}: {
  year: number;
  month: number;
  range: string;
  customStart?: Date;
  customEnd?: Date;
}) {
  const queryKey = [
    "/api/dashboard",
    year,
    month,
    range,
    customStart?.toISOString(),
    customEnd?.toISOString(),
  ];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let url = `/api/dashboard?year=${year}&month=${month}&range=${range}`;
      if (range === "custom" && customStart && customEnd) {
        url += `&startDate=${format(customStart, "yyyy-MM-dd")}&endDate=${format(customEnd, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!data) return null;

    const rev = parseFloat(data.totalIncomeSSP || "0");
    const exp = parseFloat(data.totalExpenses || "0");
    const net = rev - exp;
    const margin = rev > 0 ? (net / rev) * 100 : 0;

    return {
      raw: data,
      revenue: {
        value: rev,
        change: data.changes?.incomeChangeSSP,
      },
      expenses: {
        value: exp,
        change: data.changes?.expenseChangeSSP,
      },
      netIncome: {
        value: net,
        change: data.changes?.netIncomeChangeSSP,
        margin,
        isProfit: net >= 0,
      },
      patients: {
        value: data.totalPatients || 0,
      },
      insurance: {
        valueUSD: parseFloat(data.totalIncomeUSD || "0"),
        change: data.changes?.incomeChangeUSD,
      },
    };
  }, [data]);

  return { metrics, isLoading, error };
}

/* ==================================================================================
   4. MAIN PAGE COMPONENT
   ================================================================================= */

export default function AdvancedDashboard() {
  const {
    timeRange,
    selectedYear,
    selectedMonth,
    customStartDate,
    customEndDate,
    setTimeRange,
    setCustomRange,
    setSpecificMonth,
    periodLabel,
  } = useDateFilter();

  const [openExpenses, setOpenExpenses] = useState(false);

  // 1. Calculate Params
  const params = computeRangeParams(
    timeRange,
    selectedYear ?? null,
    selectedMonth ?? null
  );

  // 2. Fetch Data
  const { metrics, isLoading } = useDashboardAnalyticsInternal({
    year: params.yearToSend,
    month: params.monthToSend,
    range: params.rangeToSend,
    customStart: customStartDate,
    customEnd: customEndDate,
  });

  // Fetch departments
  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  // 3. Render Skeleton if loading
  if (isLoading || !metrics) {
    return <DashboardSkeleton />;
  }

  // 4. Helper for Label
  const comparisonLabel =
    timeRange === "year" || timeRange === "last-3-months"
      ? "vs previous period"
      : "vs same days last month";

  return (
    <div className="grid h-screen grid-rows-[auto,1fr] overflow-hidden bg-slate-950">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40">
        <div className="relative bg-[linear-gradient(120deg,#020617_0%,#020617_20%,#0b1120_60%,#020617_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.9)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.38),_transparent_70%)] opacity-90" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-6 py-4 gap-4">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Executive Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Key financials · <span className="text-cyan-400 font-medium">{periodLabel}</span>
              </p>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2 w-full md:w-auto justify-end">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className={cn(headerControlStyles, "w-full sm:w-[170px] rounded-full px-3")}>
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
                <>
                  <Select value={String(selectedYear || 2025)} onValueChange={(v) => setSpecificMonth(Number(v), selectedMonth || 1)}>
                    <SelectTrigger className={cn(headerControlStyles, "w-[100px] rounded-full")}>
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {[2023, 2024, 2025].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedMonth || 1)} onValueChange={(v) => setSpecificMonth(selectedYear || 2025, Number(v))}>
                    <SelectTrigger className={cn(headerControlStyles, "w-[130px] rounded-full")}>
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({length: 12}, (_, i) => i+1).map(m => <SelectItem key={m} value={String(m)}>Month {m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>
              )}

              {timeRange === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn(headerControlStyles, "justify-start text-left font-normal px-3 rounded-full")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "MMM d") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <DatePicker mode="single" selected={customStartDate} onSelect={(d) => setCustomRange(d, customEndDate)} />
                    </PopoverContent>
                  </Popover>
                  <span className="text-slate-500">-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn(headerControlStyles, "justify-start text-left font-normal px-3 rounded-full")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "MMM d") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <DatePicker mode="single" selected={customEndDate} onSelect={(d) => setCustomRange(customStartDate, d)} />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
          <div className="relative z-10 h-[3px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_0_26px_rgba(34,211,238,0.95),0_0_42px_rgba(59,130,246,0.8)]" />
        </div>
      </header>

      {/* CONTENT SURFACE */}
      <main className="relative min-h-0 overflow-y-auto bg-slate-50">
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-20 bg-gradient-to-b from-cyan-400/20 via-sky-400/10 to-transparent" />
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-sky-500/10 via-cyan-400/4 to-transparent" />

        <div className="relative z-10 px-4 md:px-6 pb-20 pt-8 max-w-[1600px] mx-auto">
          
          <div className="relative rounded-3xl bg-white/80 backdrop-blur-sm shadow-[0_18px_55px_rgba(15,23,42,0.1)] border border-white overflow-hidden">
            <div className="relative px-4 md:px-6 pt-6 pb-10">
              
              {/* === KPI GRID === */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-8">
                
                <KpiCard
                  title="Total Revenue"
                  value={metrics.revenue.value}
                  change={metrics.revenue.change}
                  gradient="bg-gradient-to-br from-emerald-50/50 to-green-50/50 hover:to-emerald-100/50"
                  icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
                  subText={comparisonLabel}
                />

                <KpiCard
                  title="Total Expenses"
                  value={metrics.expenses.value}
                  change={metrics.expenses.change}
                  trendMode="inverse"
                  gradient="bg-gradient-to-br from-rose-50/50 to-red-50/50 hover:to-rose-100/50"
                  icon={<CreditCard className="h-5 w-5 text-rose-600" />}
                  subText={comparisonLabel}
                  onClick={() => setOpenExpenses(true)}
                />

                <KpiCard
                  title="Net Income"
                  value={metrics.netIncome.value}
                  change={metrics.netIncome.change}
                  gradient="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 hover:to-blue-100/50"
                  icon={<Activity className="h-5 w-5 text-blue-600" />}
                  subText={
                    <span className={cn("font-semibold", metrics.netIncome.isProfit ? "text-blue-600" : "text-red-600")}>
                      {metrics.netIncome.margin.toFixed(1)}% Margin
                    </span>
                  }
                />

                <Link href={`/insurance-providers?range=${params.rangeToSend}`}>
                  <div className="h-full">
                    <KpiCard
                      title="Insurance (USD)"
                      value={metrics.insurance.valueUSD}
                      currency="USD"
                      change={metrics.insurance.change}
                      gradient="bg-gradient-to-br from-purple-50/50 to-violet-50/50 hover:to-purple-100/50"
                      icon={<Shield className="h-5 w-5 text-purple-600" />}
                      subText={comparisonLabel}
                    />
                  </div>
                </Link>

                <Link href="/patient-volume">
                  <div className="h-full">
                    <KpiCard
                      title="Total Patients"
                      value={metrics.patients.value}
                      currency=""
                      gradient="bg-gradient-to-br from-teal-50/50 to-cyan-50/50 hover:to-teal-100/50"
                      icon={<Users className="h-5 w-5 text-teal-600" />}
                      subText="Current period"
                    />
                  </div>
                </Link>
              </div>

              {/* === MAIN LAYOUT === */}
              <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 mb-8">
                
                {/* Left Column: Charts */}
                <div className="space-y-6">
                  {/* WRAPPED IN SOLID CARD: Matches Departments panel style */}
                  <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl">
                    <CardHeader className="pb-2 border-b border-slate-50">
                       <CardTitle className="text-base font-semibold text-slate-900">Revenue Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <RevenueAnalyticsDaily
                        timeRange={params.rangeToSend}
                        selectedYear={params.yearToSend}
                        selectedMonth={params.monthToSend}
                        customStartDate={customStartDate ?? undefined}
                        customEndDate={customEndDate ?? undefined}
                      />
                    </CardContent>
                  </Card>

                  {/* Desktop Quick Actions */}
                  <div className="hidden lg:block">
                     <QuickActionsCard />
                  </div>
                </div>

                {/* Right Column: Departments & Status */}
                <div className="space-y-6">
                  <DepartmentsPanel
                    departments={Array.isArray(departments) ? departments : []}
                    departmentBreakdown={metrics.raw.departmentBreakdown}
                    totalSSP={metrics.revenue.value}
                  />
                  
                  {/* System Status */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                       System Status
                    </h3>
                    <div className="space-y-3 text-sm text-slate-600">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <span>Database</span>
                            <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100">Connected</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Last Sync</span>
                            <span className="font-mono text-xs text-slate-400">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                  </div>
                  
                  {/* Mobile Quick Actions */}
                  <div className="lg:hidden">
                    <QuickActionsCard />
                  </div>
                </div>

              </div>
              
              <ExpensesDrawer
                open={openExpenses}
                onOpenChange={setOpenExpenses}
                periodLabel={periodLabel}
                expenseBreakdown={metrics.raw.expenseBreakdown ?? {}}
                totalExpenseSSP={metrics.expenses.value}
                onViewFullReport={() => (window.location.href = "/reports")}
              />

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
