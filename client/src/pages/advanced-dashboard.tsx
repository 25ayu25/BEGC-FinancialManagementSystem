// client/src/pages/advanced-dashboard.tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

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
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CalendarIcon,
  Shield,
  RefreshCw,
  Plus,
  FileText,
  Settings,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/queryClient";

import { useDateFilter } from "@/context/date-filter-context";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import RevenueAnalyticsDaily from "@/components/dashboard/revenue-analytics-daily";

/* ================== number formatting helpers ================== */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) =>
  v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v));
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

/* ================== helper: normalize range ================== */
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
  breakdown?:
    | Record<string, number>
    | Array<{
        name?: string;
        provider?: string;
        amount?: number;
        total?: number;
      }>;
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
        .map((r) => ({
          name: String(r.name ?? r.provider ?? "Unknown"),
          amount: Number(r.amount ?? r.total ?? 0),
        }))
        .filter((r) => r.amount > 0);
    }
    return Object.entries(breakdown)
      .map(([name, amount]) => ({ name, amount: Number(amount) }))
      .filter((r) => r.amount > 0);
  }, [breakdown]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const displayTotal = computedTotal > 0 ? computedTotal : Number(totalUSD || 0);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);

  const palette = [
    "#00A3A3",
    "#4F46E5",
    "#F59E0B",
    "#EF4444",
    "#10B981",
    "#8B5CF6",
    "#EA580C",
    "#06B6D4",
  ];

  const base = `/insurance-providers?range=${timeRange}`;
  const viewAllHref =
    timeRange === "custom" && customStartDate && customEndDate
      ? `${base}&startDate=${format(
          customStartDate,
          "yyyy-MM-dd"
        )}&endDate=${format(customEndDate, "yyyy-MM-dd")}`
      : `${base}&year=${selectedYear}&month=${selectedMonth}`;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full" /> Insurance
          Providers (USD)
        </CardTitle>
        <Link href={viewAllHref}>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-slate-500">
          Totals in period:{" "}
          <span className="font-mono">
            USD {fmtUSD(displayTotal)}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-sm text-slate-500">
            No insurance receipts for this period.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item, idx) => {
              const pct = displayTotal > 0 ? (item.amount / displayTotal) * 100 : 0;
              const color = palette[idx % palette.length];
              return (
                <div key={`${item.name}-${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      USD {fmtUSD(item.amount)}
                    </div>
                  </div>
                  <div className="h-2 rounded bg-slate-100 overflow-hidden">
                    <div
                      className="h-2 rounded"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
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

  // Normalize the range for API/links
  const { rangeToSend, yearToSend, monthToSend } = computeRangeParams(
    timeRange,
    selectedYear ?? null,
    selectedMonth ?? null
  );

  const handleTimeRangeChange = (
    range:
      | "current-month"
      | "last-month"
      | "last-3-months"
      | "year"
      | "month-select"
      | "custom"
  ) => setTimeRange(range);

  const now = new Date();
  const thisYear = now.getFullYear();
  const years = useMemo(
    () => [thisYear, thisYear - 1, thisYear - 2],
    [thisYear]
  );
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

  /* ---------- main dashboard data ---------- */
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [
      "/api/dashboard",
      yearToSend,
      monthToSend,
      rangeToSend,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${yearToSend}&month=${monthToSend}&range=${rangeToSend}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(
          customStartDate,
          "yyyy-MM-dd"
        )}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  /* ---------- current-period income trends ---------- */
  const { data: rawIncome } = useQuery({
    queryKey: [
      "/api/income-trends",
      yearToSend,
      monthToSend,
      rangeToSend,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/income-trends/${yearToSend}/${monthToSend}?range=${rangeToSend}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(
          customStartDate,
          "yyyy-MM-dd"
        )}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  /* ---------- previous-month income trends (for MTD comparison) ---------- */
  const { data: prevRawIncome } = useQuery({
    queryKey: [
      "/api/income-trends",
      "prev-month",
      yearToSend,
      monthToSend,
    ],
    enabled: timeRange === "current-month",
    queryFn: async () => {
      const currentMonthDate = new Date(yearToSend, monthToSend - 1, 1);
      const prevMonthDate = new Date(
        currentMonthDate.getFullYear(),
        currentMonthDate.getMonth() - 1,
        1
      );
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth() + 1;

      const url = `/api/income-trends/${prevYear}/${prevMonth}?range=current-month`;
      const { data } = await api.get(url);
      return data;
    },
  });

  /* ---------- build income series for current period ---------- */
  let incomeSeries: Array<{
    day: number;
    amount: number;
    amount: number;
    amountSSP: number;
    amountUSD: number;
    label: string;
    fullDate: string;
  }> = [];

  if (
    timeRange === "custom" &&
    customStartDate &&
    customEndDate &&
    Array.isArray(rawIncome)
  ) {
    incomeSeries = rawIncome.map((r: any, i: number) => ({
      day: i + 1,
      amount: Number(r.income ?? r.amount ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSP: Number(r.incomeSSP ?? r.income ?? r.amount ?? 0),
      label: r.date,
      fullDate: r.date,
    }));
  } else {
    const y = yearToSend!;
    const m = monthToSend!;
    const daysInMonth = new Date(y, m, 0).getDate();
    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: 0,
      amountUSD: 0,
      amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(y, m - 1, i + 1).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));
    if (Array.isArray(rawIncome)) {
      for (const r of rawIncome as any[]) {
        let d = (r as any).day;
        if (!d && (r as any).dateISO)
          d = new Date((r as any).dateISO).getDate();
        if (!d && (r as any).date) d = new Date((r as any).date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          incomeSeries[d - 1].amountUSD += Number((r as any).incomeUSD ?? 0);
          incomeSeries[d - 1].amountSSP += Number(
            (r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0
          );
          incomeSeries[d - 1].amount += Number(
            (r as any).income ?? (r as any).amount ?? 0
          );
        }
      }
    }
  }

  /* ---------- Month-to-date vs same days last month (Option B) ---------- */
  const isCurrentMonthRange = timeRange === "current-month";

  // Determine how many days of data we have this month
  const daysInCurrentMonth = new Date(yearToSend, monthToSend, 0).getDate();
  const lastDayWithIncome = incomeSeries.reduce(
    (max, d) =>
      d.amountSSP !== 0 || d.amountUSD !== 0 ? Math.max(max, d.day) : max,
    0
  );

  const today = new Date();
  const isThisCalendarMonth =
    yearToSend === today.getFullYear() &&
    monthToSend === today.getMonth() + 1;

  const effectiveCurrentDay =
    lastDayWithIncome > 0
      ? lastDayWithIncome
      : isThisCalendarMonth
      ? Math.min(today.getDate(), daysInCurrentMonth)
      : daysInCurrentMonth;

  const currentMonthDate = new Date(yearToSend, monthToSend - 1, 1);
  const prevMonthDate = new Date(
    currentMonthDate.getFullYear(),
    currentMonthDate.getMonth() - 1,
    1
  );
  const daysInPrevMonth = new Date(
    prevMonthDate.getFullYear(),
    prevMonthDate.getMonth() + 1,
    0
  ).getDate();

  const daysToCompare =
    effectiveCurrentDay > 0 ? Math.min(effectiveCurrentDay, daysInPrevMonth) : 0;

  // Current month MTD (SSP & USD)
  const currentMTDIncomeSSP =
    daysToCompare > 0
      ? incomeSeries
          .filter((d) => d.day <= daysToCompare)
          .reduce((s, d) => s + d.amountSSP, 0)
      : 0;

  const currentMTDIncomeUSD =
    daysToCompare > 0
      ? incomeSeries
          .filter((d) => d.day <= daysToCompare)
          .reduce((s, d) => s + d.amountUSD, 0)
      : 0;

  // Previous month income mapped by day
  let prevIncomeByDay: Record<
    number,
    { amountSSP: number; amountUSD: number }
  > = {};

  if (Array.isArray(prevRawIncome)) {
    const prevDays = daysInPrevMonth;
    for (const r of prevRawIncome as any[]) {
      let d = (r as any).day;
      if (!d && (r as any).dateISO)
        d = new Date((r as any).dateISO).getDate();
      if (!d && (r as any).date) d = new Date((r as any).date).getDate();
      if (typeof d === "number" && d >= 1 && d <= prevDays) {
        const ssp = Number(
          (r as any).incomeSSP ??
            (r as any).income ??
            (r as any).amount ??
            0
        );
        const usd = Number((r as any).incomeUSD ?? 0);
        const existing = prevIncomeByDay[d] ?? {
          amountSSP: 0,
          amountUSD: 0,
        };
        prevIncomeByDay[d] = {
          amountSSP: existing.amountSSP + ssp,
          amountUSD: existing.amountUSD + usd,
        };
      }
    }
  }

  const prevMTDIncomeSSP =
    isCurrentMonthRange && daysToCompare > 0
      ? Array.from({ length: daysToCompare }, (_, idx) => idx + 1).reduce(
          (sum, day) => sum + (prevIncomeByDay[day]?.amountSSP ?? 0),
          0
        )
      : 0;

  const prevMTDIncomeUSD =
    isCurrentMonthRange && daysToCompare > 0
      ? Array.from({ length: daysToCompare }, (_, idx) => idx + 1).reduce(
          (sum, day) => sum + (prevIncomeByDay[day]?.amountUSD ?? 0),
          0
        )
      : 0;

  let incomeChangeSSP_MTD: number | null = null;
  let incomeChangeUSD_MTD: number | null = null;

  if (isCurrentMonthRange && daysToCompare > 0 && prevMTDIncomeSSP > 0) {
    incomeChangeSSP_MTD =
      ((currentMTDIncomeSSP - prevMTDIncomeSSP) / prevMTDIncomeSSP) * 100;
  }

  if (isCurrentMonthRange && daysToCompare > 0 && prevMTDIncomeUSD > 0) {
    incomeChangeUSD_MTD =
      ((currentMTDIncomeUSD - prevMTDIncomeUSD) / prevMTDIncomeUSD) * 100;
  }

  /* ---------- totals & metrics ---------- */
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const daysWithSSP = incomeSeries.filter((d) => d.amountSSP > 0).length;
  const monthlyAvgSSP = daysWithSSP ? Math.round(monthTotalSSP / daysWithSSP) : 0;
  const peakSSP = Math.max(...incomeSeries.map((d) => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find((d) => d.amountSSP === peakSSP);
  const showAvgLine = daysWithSSP >= 2;
  const hasAnyUSD = incomeSeries.some((d) => d.amountUSD > 0);

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

  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || "0");
  const usdIncome = parseFloat(dashboardData?.totalIncomeUSD || "0");
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || "0");
  const sspRevenue = monthTotalSSP || sspIncome;
  const sspNetIncome = sspRevenue - totalExpenses;

  // Which % we actually use on the cards
  const revenueChangePct =
    isCurrentMonthRange && incomeChangeSSP_MTD !== null
      ? incomeChangeSSP_MTD
      : dashboardData?.changes?.incomeChangeSSP;

  const insuranceChangePct =
    isCurrentMonthRange && incomeChangeUSD_MTD !== null
      ? incomeChangeUSD_MTD
      : dashboardData?.changes?.incomeChangeUSD;

  const prevMonthLabel = (() => {
    const date = prevMonthDate;
    return `${date.toLocaleString("default", {
      month: "short",
    })} ${date.getFullYear()}`;
  })();

  // ---------- comparison label & "no data" logic ----------

  const comparisonLabel = (() => {
    if (isCurrentMonthRange) {
      return `vs same days last month (${prevMonthLabel})`;
    }
    switch (timeRange) {
      case "last-3-months":
        return "vs previous 3 months";
      case "year":
        return "vs last year";
      case "last-month":
      case "month-select":
        return "vs last month";
      default:
        return "vs previous period";
    }
  })();

  const hasPreviousPeriodSSP =
    !!dashboardData?.previousPeriod &&
    (dashboardData.previousPeriod.totalIncomeSSP !== 0 ||
      dashboardData.previousPeriod.totalExpensesSSP !== 0);

  const hasPreviousPeriodUSD =
    !!dashboardData?.previousPeriod &&
    dashboardData.previousPeriod.totalIncomeUSD !== 0;

  const shouldShowNoComparisonSSP =
    (timeRange === "year" || timeRange === "last-3-months") &&
    !hasPreviousPeriodSSP;

  const shouldShowNoComparisonUSD =
    (timeRange === "year" || timeRange === "last-3-months") &&
    !hasPreviousPeriodUSD;

  // ---------- "No transactions yet" logic for zero current period ----------
  const currentRevenueValue = monthTotalSSP || parseFloat(dashboardData?.totalIncomeSSP || "0");
  const currentExpenseValue = parseFloat(dashboardData?.totalExpenses || "0");
  const currentInsuranceValue = parseFloat(dashboardData?.totalIncomeUSD || "0");
  const currentPatientsValue = dashboardData?.totalPatients || 0;

  const showNoDataYetRevenue = currentRevenueValue === 0;
  const showNoDataYetExpenses = currentExpenseValue === 0;
  const showNoDataYetNetIncome = currentRevenueValue === 0 && currentExpenseValue === 0;
  const showNoDataYetInsurance = currentInsuranceValue === 0;
  const showNoDataYetPatients = currentPatientsValue === 0;

  /* ================== RENDER ================== */

  return (
    <div className="grid h-screen grid-rows-[auto,1fr] overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-50",
          "bg-white/80 dark:bg-slate-900/70",
          "backdrop-blur-md supports-[backdrop-filter]:bg-white/60",
          "shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]",
          "dark:shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
        )}
      >
        <div className="px-4 py-[max(12px,env(safe-area-inset-top))] md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
                Executive Dashboard
              </h1>
              <div className="mt-1 flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Key financials · {periodLabel}
                </p>
                <span className="hidden sm:inline-flex text-xs text-slate-400">
                  Last updated: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-3 md:mt-0 w-full md:w-auto flex flex-col sm:flex-row items-stretch md:items-center md:justify-end gap-2">
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="h-10 w-full sm:w-[160px]">
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
                  <Select
                    value={String(selectedYear)}
                    onValueChange={(val) =>
                      setSpecificMonth(Number(val), selectedMonth || 1)
                    }
                  >
                    <SelectTrigger className="h-10 w-full sm:w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={String(selectedMonth)}
                    onValueChange={(val) =>
                      setSpecificMonth(selectedYear || thisYear, Number(val))
                    }
                  >
                    <SelectTrigger className="h-10 w-full sm:w-[140px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {timeRange === "custom" && (
                <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2 w-full sm:w-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full sm:w-auto justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate
                          ? format(customStartDate, "MMM d, yyyy")
                          : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      sideOffset={12}
                      className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                      style={{
                        zIndex: 50000,
                        backgroundColor: "rgb(255, 255, 255)",
                      }}
                      avoidCollisions
                      collisionPadding={15}
                    >
                      <DatePicker
                        mode="single"
                        numberOfMonths={1}
                        showOutsideDays={false}
                        selected={customStartDate}
                        onSelect={(d) => setCustomRange(d ?? undefined, customEndDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span
                    aria-hidden
                    className="text-center sm:text-left text-muted-foreground"
                  >
                    to
                  </span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full sm:w-auto justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate
                          ? format(customEndDate, "MMM d, yyyy")
                          : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      sideOffset={12}
                      className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                      style={{
                        zIndex: 50000,
                        backgroundColor: "rgb(255, 255, 255)",
                      }}
                      avoidCollisions
                      collisionPadding={15}
                    >
                      <DatePicker
                        mode="single"
                        numberOfMonths={1}
                        showOutsideDays={false}
                        selected={customEndDate}
                        onSelect={(d) => setCustomRange(customStartDate, d ?? undefined)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="min-h-0 overflow-y-auto [overscroll-behavior:contain]">
        <div className="px-4 md:px-6 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 md:pt-6 dashboard-content">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
            {/* Total Revenue */}
            <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-xs font-medium uppercase tracking-wide">
                      Total Revenue
                    </p>
                    <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                      SSP{" "}
                      {nf0.format(
                        Math.round(
                          monthTotalSSP ||
                            parseFloat(
                              dashboardData?.totalIncomeSSP || "0"
                            )
                        )
                      )}
                    </p>
                    <div className="flex items-center mt-1">
                      {showNoDataYetRevenue ? (
                        <span className="text-xs font-medium text-slate-500">
                          No transactions yet
                        </span>
                      ) : revenueChangePct !== undefined &&
                        revenueChangePct !== null &&
                        (!(
                          timeRange === "year" || timeRange === "last-3-months"
                        ) ||
                          hasPreviousPeriodSSP) ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            revenueChangePct > 0
                              ? "text-emerald-600"
                              : revenueChangePct < 0
                              ? "text-red-600"
                              : "text-slate-500"
                          )}
                        >
                          {revenueChangePct > 0 ? "+" : ""}
                          {revenueChangePct.toFixed(1)}% {comparisonLabel}
                        </span>
                      ) : shouldShowNoComparisonSSP ? (
                        <span className="text-xs font-medium text-slate-500">
                          No data to compare
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(
                    "p-2.5 rounded-xl shadow-sm",
                    revenueChangePct !== undefined && revenueChangePct !== null && revenueChangePct > 0
                      ? "bg-emerald-100"
                      : revenueChangePct !== undefined && revenueChangePct !== null && revenueChangePct < 0
                      ? "bg-red-100"
                      : "bg-emerald-100"
                  )}>
                    {revenueChangePct !== undefined &&
                    revenueChangePct !== null &&
                    revenueChangePct < 0 ? (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Expenses */}
            <Card
              className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setOpenExpenses(true)}
              title="Click to view expense breakdown"
            >
              <CardContent className="p-4 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-xs font-medium uppercase tracking-wide">
                      Total Expenses
                    </p>
                    <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                      SSP{" "}
                      {nf0.format(
                        Math.round(
                          parseFloat(dashboardData?.totalExpenses || "0")
                        )
                      )}
                    </p>
                    <div className="flex items-center mt-1">
                      {showNoDataYetExpenses ? (
                        <span className="text-xs font-medium text-slate-500">
                          No expenses yet
                        </span>
                      ) : dashboardData?.changes?.expenseChangeSSP !== undefined &&
                        (!(
                          timeRange === "year" || timeRange === "last-3-months"
                        ) ||
                          hasPreviousPeriodSSP) ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            dashboardData.changes.expenseChangeSSP > 0
                              ? "text-red-600"
                              : dashboardData.changes.expenseChangeSSP < 0
                              ? "text-emerald-600"
                              : "text-slate-500"
                          )}
                        >
                          {dashboardData.changes.expenseChangeSSP > 0
                            ? "+"
                            : ""}
                          {dashboardData.changes.expenseChangeSSP.toFixed(1)}%{" "}
                          {comparisonLabel}
                        </span>
                      ) : shouldShowNoComparisonSSP ? (
                        <span className="text-xs font-medium text-slate-500">
                          No data to compare
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={cn(
                    "p-2.5 rounded-xl shadow-sm",
                    dashboardData?.changes?.expenseChangeSSP !== undefined && dashboardData.changes.expenseChangeSSP < 0
                      ? "bg-emerald-100"
                      : "bg-red-100"
                  )}>
                    {dashboardData?.changes?.expenseChangeSSP !== undefined &&
                    dashboardData.changes.expenseChangeSSP < 0 ? (
                      <TrendingDown className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Net Income - Special Highlight */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-lg transition-shadow ring-1 ring-blue-100">
              <CardContent className="p-4 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-700 text-xs font-semibold uppercase tracking-wide">
                      ✨ Net Income
                    </p>
                    <p className="text-xl font-bold text-blue-900 font-mono tabular-nums">
                      SSP {nf0.format(Math.round(sspNetIncome))}
                    </p>
                    {sspRevenue > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        Profit Margin: {((sspNetIncome / sspRevenue) * 100).toFixed(1)}%
                      </p>
                    )}
                    <div className="flex items-center mt-1">
                      {showNoDataYetNetIncome ? (
                        <span className="text-xs font-medium text-slate-500">
                          No transactions yet
                        </span>
                      ) : dashboardData?.changes?.netIncomeChangeSSP !== undefined &&
                        (!(
                          timeRange === "year" || timeRange === "last-3-months"
                        ) ||
                          hasPreviousPeriodSSP) ? (
                        <span
                          className={cn(
                            "text-xs font-medium",
                            dashboardData.changes.netIncomeChangeSSP > 0
                              ? "text-emerald-600"
                              : dashboardData.changes.netIncomeChangeSSP < 0
                              ? "text-red-600"
                              : "text-slate-500"
                          )}
                        >
                          {dashboardData.changes.netIncomeChangeSSP > 0
                            ? "+"
                            : ""}
                          {dashboardData.changes.netIncomeChangeSSP.toFixed(1)}% {comparisonLabel}
                        </span>
                      ) : shouldShowNoComparisonSSP ? (
                        <span className="text-xs font-medium text-slate-500">
                          No data to compare
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2.5 rounded-xl shadow-sm">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance (USD) quick nav */}
            <Link
              href={`/insurance-providers?range=${rangeToSend}${
                timeRange === "custom" &&
                customStartDate &&
                customEndDate
                  ? `&startDate=${format(
                      customStartDate,
                      "yyyy-MM-dd"
                    )}&endDate=${format(customEndDate, "yyyy-MM-dd")}`
                  : `&year=${yearToSend}&month=${monthToSend}`
              }`}
            >
              <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-xs font-medium uppercase tracking-wide">
                        Insurance (USD)
                      </p>
                      <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                        USD{" "}
                          {fmtUSD(
                            Math.round(
                              parseFloat(
                                dashboardData?.totalIncomeUSD || "0"
                              )
                            )
                          )}
                      </p>
                      <div className="flex items-center mt-1">
                        {showNoDataYetInsurance ? (
                          <span className="text-xs font-medium text-slate-500">
                            No insurance claims yet
                          </span>
                        ) : insuranceChangePct !== undefined &&
                        insuranceChangePct !== null &&
                        (!(
                          timeRange === "year" || timeRange === "last-3-months"
                        ) ||
                          hasPreviousPeriodUSD) ? (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              insuranceChangePct > 0
                                ? "text-emerald-600"
                                : insuranceChangePct < 0
                                ? "text-red-600"
                                : "text-slate-500"
                            )}
                          >
                            {insuranceChangePct > 0 ? "+" : ""}
                            {insuranceChangePct.toFixed(1)}% {comparisonLabel}
                          </span>
                        ) : shouldShowNoComparisonUSD &&
                          insuranceChangePct !== undefined &&
                          insuranceChangePct !== null ? (
                          <span className="text-xs font-medium text-slate-500">
                            No data to compare
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-purple-600">
                            {Object.keys(
                              dashboardData?.insuranceBreakdown || {}
                            ).length === 1
                              ? "1 provider"
                              : `${
                                  Object.keys(
                                    dashboardData?.insuranceBreakdown || {}
                                  ).length
                                } providers`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-purple-100 p-2.5 rounded-xl shadow-sm">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Patient Volume */}
            <Link
              href={`/patient-volume?view=monthly&year=${yearToSend}&month=${monthToSend}&range=${rangeToSend}`}
            >
              <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-600 text-xs font-medium uppercase tracking-wide">
                        Total Patients
                      </p>
                      <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                        {(dashboardData?.totalPatients || 0).toLocaleString()}
                      </p>
                      <div className="flex items-center mt-1">
                        {showNoDataYetPatients ? (
                          <span className="text-xs font-medium text-slate-500">
                            No patients recorded yet
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-teal-600">
                            Current period
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-teal-100 p-2.5 rounded-xl shadow-sm">
                      <Users className="h-5 w-5 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* ===== Main layout ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-8">
            {/* LEFT: chart + quick actions */}
            <div className="space-y-6">
              <RevenueAnalyticsDaily
                timeRange={rangeToSend}
                selectedYear={yearToSend}
                selectedMonth={monthToSend}
                customStartDate={customStartDate ?? undefined}
                customEndDate={customEndDate ?? undefined}
              />

              {/* Quick Actions */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" /> Quick
                    Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <a href="/transactions" className="block group">
                      <Button
                        variant="outline"
                        className="w-full justify-between h-auto py-4 px-4 hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 hover:border-teal-300 transition-all duration-200 group-hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-teal-100 p-2 rounded-lg group-hover:bg-teal-200 transition-colors">
                            <Plus className="h-4 w-4 text-teal-600" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-slate-900">
                              Add Transaction
                            </span>
                            <span className="text-xs text-slate-500">
                              Record new income or expense
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </a>
                    <a href="/patient-volume" className="block group">
                      <Button
                        variant="outline"
                        className="w-full justify-between h-auto py-4 px-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300 transition-all duration-200 group-hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-slate-900">
                              Patient Volume
                            </span>
                            <span className="text-xs text-slate-500">
                              Update patient count
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </a>
                    <a href="/reports" className="block group">
                      <Button
                        variant="outline"
                        className="w-full justify-between h-auto py-4 px-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-violet-50 hover:border-purple-300 transition-all duration-200 group-hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                            <FileText className="h-4 w-4 text-purple-600" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-slate-900">
                              Monthly Reports
                            </span>
                            <span className="text-xs text-slate-500">
                              View generated reports
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </a>
                    <a href="/users" className="block group">
                      <Button
                        variant="outline"
                        className="w-full justify-between h-auto py-4 px-4 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:border-orange-300 transition-all duration-200 group-hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors">
                            <Settings className="h-4 w-4 text-orange-600" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-slate-900">
                              User Management
                            </span>
                            <span className="text-xs text-slate-500">
                              Manage user accounts
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: departments + providers + system status */}
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
                    <div className="w-2 h-2 bg-blue-500 rounded-full" /> System
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Database</span>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 border-green-200 rounded-full"
                      >
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Last Sync</span>
                      <Badge
                        variant="outline"
                        className="rounded-full border-slate-200 text-slate-600"
                      >
                        {new Date().toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Active Users
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 rounded-full"
                      >
                        1 online
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Expenses drawer */}
          <ExpensesDrawer
            open={openExpenses}
            onOpenChange={setOpenExpenses}
            periodLabel={periodLabel}
            expenseBreakdown={dashboardData?.expenseBreakdown ?? {}}
            totalExpenseSSP={Number(dashboardData?.totalExpenses || 0)}
            onViewFullReport={() => {
              window.location.href = "/reports";
            }}
          />
        </div>
      </main>
    </div>
  );
}
