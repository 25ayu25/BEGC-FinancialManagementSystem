"use client";

import { useState, useMemo, useEffect, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

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
import { AnimatedNumber } from "@/components/ui/animated-number";
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
  Moon,
  Sun,
} from "lucide-react";
import { api } from "@/lib/queryClient";

import { useDateFilter } from "@/context/date-filter-context";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import RevenueAnalyticsDaily from "@/components/dashboard/revenue-analytics-daily";
import {
  kpiContainerVariants,
  kpiCardVariants,
  chartVariants,
  containerVariants,
  cardVariants,
} from "@/lib/animations";
import { SkeletonCard, SkeletonChart, SkeletonList } from "@/components/ui/skeletons";

/* ========= number helpers ========= */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

/* ========= header styles ========= */
const headerControlStyles =
  "h-9 bg-slate-900/60 text-slate-100 border border-slate-600/50 hover:border-cyan-400/80 hover:bg-slate-800/80 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-0";

/* ========= helper: normalize range ========= */
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
  
  // ADDED: Logic for Last Year
  if (timeRange === "last-year") {
    return {
      rangeToSend: "year", // Reuse 'year' range logic in backend
      yearToSend: today.getFullYear() - 1, // Set to previous year
      monthToSend: fallbackM,
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

/* ========= Insurance Providers Card ========= */
function InsuranceProvidersUSD({
  breakdown,
  totalUSD,
  isDarkMode = false,
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
  isDarkMode?: boolean;
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

  return (
    <Card
      className={cn(
        "shadow-sm",
        isDarkMode
          ? "bg-white/3 border border-white/10"
          : "border border-slate-200"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle
          className={cn(
            "text-lg font-semibold flex items-center gap-2",
            isDarkMode ? "text-white/95" : "text-slate-900"
          )}
        >
          <div className="w-2 h-2 bg-purple-500 rounded-full" /> Insurance
          Providers
        </CardTitle>
        {displayTotal > 0 && (
          <span className={cn("text-xs", isDarkMode ? "text-white/70" : "text-slate-500")}>
            Total:{" "}
            <span
              className={cn(
                "font-mono font-semibold",
                isDarkMode ? "text-white/90" : "text-slate-700"
              )}
            >
              ${fmtUSD(displayTotal)}
            </span>
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className={cn("text-sm", isDarkMode ? "text-white/65" : "text-slate-500")}>
            No insurance receipts for this period.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((item, idx) => {
              const pct = displayTotal > 0 ? (item.amount / displayTotal) * 100 : 0;
              const color = palette[idx % palette.length];
              return (
                <div
                  key={`${item.name}-${idx}`}
                  className={cn(
                    "p-3 rounded-lg transition-colors border-l-4",
                    isDarkMode
                      ? "bg-white/2 border border-white/8 hover:bg-white/5"
                      : "hover:bg-slate-50"
                  )}
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDarkMode ? "text-white/90" : "text-slate-700"
                        )}
                      >
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-base font-bold font-mono tabular-nums",
                          isDarkMode ? "text-white/95" : "text-slate-900"
                        )}
                      >
                        ${fmtUSD(item.amount)}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          isDarkMode
                            ? "text-white/65 bg-white/10"
                            : "text-slate-500 bg-slate-100"
                        )}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className={cn("h-2.5 rounded-full overflow-hidden", isDarkMode ? "bg-white/10" : "bg-slate-100")}>
                    <div
                      className="h-2.5 rounded-full transition-all duration-500 ease-out"
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

/* ========= Quick Actions Card ========= */
function QuickActionsCard({ isDarkMode = false }: { isDarkMode?: boolean }) {
  return (
    <Card
      className={cn(
        "shadow-sm",
        isDarkMode
          ? "bg-white/3 border border-white/10"
          : "border border-slate-200"
      )}
    >
      <CardHeader>
        <CardTitle
          className={cn(
            "text-lg font-semibold flex items-center gap-2",
            isDarkMode ? "text-white/95" : "text-slate-900"
          )}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a href="/transactions" className="block group">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4 transition-all duration-200 group-hover:shadow-sm",
                isDarkMode
                  ? "bg-white/4 border-white/12 text-white/90 hover:bg-white/8 hover:border-white/25"
                  : "hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 hover:border-teal-300"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isDarkMode
                      ? "bg-teal-500/20 group-hover:bg-teal-500/30"
                      : "bg-teal-100 group-hover:bg-teal-200"
                  )}
                >
                  <Plus className={cn("h-4 w-4", isDarkMode ? "text-teal-400" : "text-teal-600")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className={cn("font-medium", isDarkMode ? "text-white/95" : "text-slate-900")}>
                    Add Transaction
                  </span>
                  <span className={cn("text-xs", isDarkMode ? "text-white/65" : "text-slate-500")}>
                    Record new income or expense
                  </span>
                </div>
              </div>
              <ArrowRight
                className={cn(
                  "h-4 w-4 group-hover:translate-x-1 transition-all",
                  isDarkMode ? "text-white/50 group-hover:text-teal-400" : "text-slate-400 group-hover:text-teal-600"
                )}
              />
            </Button>
          </a>
          <a href="/patient-volume" className="block group">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4 transition-all duration-200 group-hover:shadow-sm",
                isDarkMode
                  ? "bg-white/4 border-white/12 text-white/90 hover:bg-white/8 hover:border-white/25"
                  : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-300"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isDarkMode
                      ? "bg-blue-500/20 group-hover:bg-blue-500/30"
                      : "bg-blue-100 group-hover:bg-blue-200"
                  )}
                >
                  <Users className={cn("h-4 w-4", isDarkMode ? "text-blue-400" : "text-blue-600")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className={cn("font-medium", isDarkMode ? "text-white/95" : "text-slate-900")}>
                    Patient Volume
                  </span>
                  <span className={cn("text-xs", isDarkMode ? "text-white/65" : "text-slate-500")}>
                    Update patient count
                  </span>
                </div>
              </div>
              <ArrowRight
                className={cn(
                  "h-4 w-4 group-hover:translate-x-1 transition-all",
                  isDarkMode ? "text-white/50 group-hover:text-blue-400" : "text-slate-400 group-hover:text-blue-600"
                )}
              />
            </Button>
          </a>
          <a href="/reports" className="block group">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4 transition-all duration-200 group-hover:shadow-sm",
                isDarkMode
                  ? "bg-white/4 border-white/12 text-white/90 hover:bg-white/8 hover:border-white/25"
                  : "hover:bg-gradient-to-r hover:from-purple-50 hover:to-violet-50 hover:border-purple-300"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isDarkMode
                      ? "bg-purple-500/20 group-hover:bg-purple-500/30"
                      : "bg-purple-100 group-hover:bg-purple-200"
                  )}
                >
                  <FileText className={cn("h-4 w-4", isDarkMode ? "text-purple-400" : "text-purple-600")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className={cn("font-medium", isDarkMode ? "text-white/95" : "text-slate-900")}>
                    Monthly Reports
                  </span>
                  <span className={cn("text-xs", isDarkMode ? "text-white/65" : "text-slate-500")}>
                    View generated reports
                  </span>
                </div>
              </div>
              <ArrowRight
                className={cn(
                  "h-4 w-4 group-hover:translate-x-1 transition-all",
                  isDarkMode ? "text-white/50 group-hover:text-purple-400" : "text-slate-400 group-hover:text-purple-600"
                )}
              />
            </Button>
          </a>
          <a href="/users" className="block group">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between h-auto py-4 px-4 transition-all duration-200 group-hover:shadow-sm",
                isDarkMode
                  ? "bg-white/4 border-white/12 text-white/90 hover:bg-white/8 hover:border-white/25"
                  : "hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 hover:border-orange-300"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isDarkMode
                      ? "bg-orange-500/20 group-hover:bg-orange-500/30"
                      : "bg-orange-100 group-hover:bg-orange-200"
                  )}
                >
                  <Settings className={cn("h-4 w-4", isDarkMode ? "text-orange-400" : "text-orange-600")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className={cn("font-medium", isDarkMode ? "text-white/95" : "text-slate-900")}>
                    User Management
                  </span>
                  <span className={cn("text-xs", isDarkMode ? "text-white/65" : "text-slate-500")}>
                    Manage user accounts
                  </span>
                </div>
              </div>
              <ArrowRight
                className={cn(
                  "h-4 w-4 group-hover:translate-x-1 transition-all",
                  isDarkMode ? "text-white/50 group-hover:text-orange-400" : "text-slate-400 group-hover:text-orange-600"
                )}
              />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

/* ========= Page ========= */
export default function AdvancedDashboard() {
  // Dark mode state - default to dark
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("executiveDashboard-darkMode");
    // If user has a saved preference, respect it; otherwise default to dark
    if (saved !== null) {
      return saved === "true";
    }
    return true; // Default to dark mode
  });

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem("executiveDashboard-darkMode", isDarkMode.toString());
  }, [isDarkMode]);

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
      | "last-year" // ADDED: type for Last Year
      | "month-select"
      | "custom"
  ) => setTimeRange(range);

  const now = new Date();
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

  // still used for "Last Sync" in System Status, but not in header anymore
  const lastUpdatedLabel = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  /* ---------- data ---------- */
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
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const { data } = await api.get(url);
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const { data } = await api.get("/api/departments");
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const { data } = await api.get(url);
      return data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: prevRawIncome } = useQuery({
    queryKey: ["/api/income-trends", "prev-month", yearToSend, monthToSend],
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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  /* ---------- income series ---------- */
  let incomeSeries: Array<{
    day: number;
    amount: number;
    amountSSP: number;
    amountUSD: number;
    label: string;
    fullDate: string;
  }> = [];

  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
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
        if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
        if (!d && (r as any).date) d = new Date((r as any).date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          incomeSeries[d - 1].amountUSD += Number((r as any).incomeUSD ?? 0);
          incomeSeries[d - 1].amountSSP += Number(
            (r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0
          );
          incomeSeries[d - 1].amount += Number((r as any).income ?? (r as any).amount ?? 0);
        }
      }
    }
  }

  const isCurrentMonthRange = timeRange === "current-month";

  const daysInCurrentMonth = new Date(yearToSend, monthToSend, 0).getDate();
  const lastDayWithIncome = incomeSeries.reduce(
    (max, d) => (d.amountSSP !== 0 || d.amountUSD !== 0 ? Math.max(max, d.day) : max),
    0
  );

  const today = new Date();
  const isThisCalendarMonth =
    yearToSend === today.getFullYear() && monthToSend === today.getMonth() + 1;

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

  let prevIncomeByDay: Record<number, { amountSSP: number; amountUSD: number }> = {};

  if (Array.isArray(prevRawIncome)) {
    const prevDays = daysInPrevMonth;
    for (const r of prevRawIncome as any[]) {
      let d = (r as any).day;
      if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
      if (!d && (r as any).date) d = new Date((r as any).date).getDate();
      if (typeof d === "number" && d >= 1 && d <= prevDays) {
        const ssp = Number((r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0);
        const usd = Number((r as any).incomeUSD ?? 0);
        const existing = prevIncomeByDay[d] ?? { amountSSP: 0, amountUSD: 0 };
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
    incomeChangeSSP_MTD = ((currentMTDIncomeSSP - prevMTDIncomeSSP) / prevMTDIncomeSSP) * 100;
  }

  if (isCurrentMonthRange && daysToCompare > 0 && prevMTDIncomeUSD > 0) {
    incomeChangeUSD_MTD = ((currentMTDIncomeUSD - prevMTDIncomeUSD) / prevMTDIncomeUSD) * 100;
  }

  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || "0");
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || "0");
  const sspRevenue = monthTotalSSP || sspIncome;
  const sspNetIncome = sspRevenue - totalExpenses;

  const isCurrent = isCurrentMonthRange;

  const revenueChangePct =
    isCurrent && incomeChangeSSP_MTD !== null ? incomeChangeSSP_MTD : dashboardData?.changes?.incomeChangeSSP;

  const insuranceChangePct =
    isCurrent && incomeChangeUSD_MTD !== null ? incomeChangeUSD_MTD : dashboardData?.changes?.incomeChangeUSD;

  const prevMonthLabel = `${prevMonthDate.toLocaleString("default", { month: "short" })} ${prevMonthDate.getFullYear()}`;

  const comparisonLabel = (() => {
    if (isCurrent) return `vs same days last month (${prevMonthLabel})`;
    switch (timeRange) {
      case "last-3-months":
        return "vs previous 3 months";
      case "year":
        return "vs last year";
      case "last-year": // ADDED: Label for Last Year
        return "vs previous year";
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
    !!dashboardData?.previousPeriod && dashboardData.previousPeriod.totalIncomeUSD !== 0;

  const shouldShowNoComparisonSSP =
    (timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") && !hasPreviousPeriodSSP;

  const shouldShowNoComparisonUSD =
    (timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") && !hasPreviousPeriodUSD;

  const currentRevenueValue = monthTotalSSP || parseFloat(dashboardData?.totalIncomeSSP || "0");
  const currentExpenseValue = parseFloat(dashboardData?.totalExpenses || "0");
  const currentInsuranceValue = monthTotalUSD || parseFloat(dashboardData?.totalIncomeUSD || "0");
  const currentPatientsValue = Number(dashboardData?.totalPatients ?? 0);

  const showNoDataYetRevenue = currentRevenueValue === 0;
  const showNoDataYetExpenses = currentExpenseValue === 0;
  const showNoDataYetNetIncome = currentRevenueValue === 0 && currentExpenseValue === 0;
  const showNoDataYetInsurance = currentInsuranceValue === 0;
  const showNoDataYetPatients = currentPatientsValue === 0;

  if (isLoading) {
    return (
      <div
        className={cn(
          "grid h-screen grid-rows-[auto,1fr] overflow-hidden transition-colors duration-300",
          isDarkMode ? "bg-[#0f172a] dark" : "bg-slate-950"
        )}
      >
        {/* HEADER (same as normal render) */}
        <header className="sticky top-0 z-40">
          <div
            className={cn(
              "relative shadow-[0_20px_60px_rgba(15,23,42,0.9)]",
              isDarkMode
                ? "bg-[linear-gradient(135deg,#1a2332_0%,#2d3748_50%,#1e3a5f_100%)]"
                : "bg-[linear-gradient(120deg,#020617_0%,#020617_20%,#0b1120_60%,#020617_100%)]"
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.38),_transparent_70%)] opacity-90" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-6 py-4 gap-4">
              <div className="flex-shrink-0">
                <h1 className={cn("text-2xl font-semibold tracking-tight", isDarkMode ? "text-white/95" : "text-white")}>
                  Executive Dashboard
                </h1>
                <p className={cn("mt-1 text-sm", isDarkMode ? "text-white/70" : "text-slate-300")}>
                  Loading dashboard data...
                </p>
              </div>
            </div>
            <div className="relative z-10 h-[3px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_0_26px_rgba(34,211,238,0.95),0_0_42px_rgba(59,130,246,0.8)]" />
          </div>
        </header>

        {/* MAIN with skeleton loaders */}
        <main
          className={cn(
            // ✅ FIX: reserve scrollbar space so right gutter doesn’t look larger
            "relative min-h-0 overflow-y-auto transition-colors duration-300 [scrollbar-gutter:stable_both-edges]",
            isDarkMode ? "bg-gradient-to-b from-[#0f172a] to-[#1e293b]" : "bg-slate-50"
          )}
        >
          <div className="relative z-10 px-4 md:px-6 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-8">
            <div
              className={cn(
                "relative rounded-3xl overflow-hidden p-6",
                isDarkMode ? "bg-white/5 backdrop-blur-lg border border-white/10" : "bg-white border border-slate-100"
              )}
            >
              {/* KPI Cards Skeletons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-7">
                {[...Array(5)].map((_, i) => (
                  <SkeletonCard key={i} className="h-[120px]" />
                ))}
              </div>

              {/* Charts Row Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
                <SkeletonChart />
                <SkeletonChart />
              </div>

              {/* Bottom Section Skeletons */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <SkeletonList count={6} />
                </div>
                <div className="space-y-6">
                  <SkeletonList count={4} />
                  <SkeletonList count={4} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleExpensesKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenExpenses(true);
    }
  };

  /* ========= RENDER ========= */

  return (
    <div
      className={cn(
        "grid h-screen grid-rows-[auto,1fr] overflow-hidden transition-colors duration-300",
        isDarkMode ? "bg-[#0f172a] dark" : "bg-slate-950"
      )}
    >
      {/* HEADER */}
      <header className="sticky top-0 z-40">
        <div
          className={cn(
            "relative shadow-[0_20px_60px_rgba(15,23,42,0.9)]",
            isDarkMode
              ? "bg-[linear-gradient(135deg,#1a2332_0%,#2d3748_50%,#1e3a5f_100%)]"
              : "bg-[linear-gradient(120deg,#020617_0%,#020617_20%,#0b1120_60%,#020617_100%)]"
          )}
        >
          {/* header glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.38),_transparent_70%)] opacity-90" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-6 py-4 gap-4">
            <div className="flex-shrink-0">
              <h1 className={cn("text-2xl font-semibold tracking-tight", isDarkMode ? "text-white/95" : "text-white")}>
                Executive Dashboard
              </h1>
              <p className={cn("mt-1 text-sm", isDarkMode ? "text-white/70" : "text-slate-300")}>
                Key financials · {periodLabel}
              </p>
            </div>

            {/* controls (no search bar) */}
            <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2 w-full md:w-auto justify-end">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110",
                  isDarkMode
                    ? "bg-white/10 border border-white/20 hover:bg-white/15 hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
                    : "bg-white/90 border border-black/10 hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                )}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <Sun className="h-5 w-5 text-yellow-300" /> : <Moon className="h-5 w-5 text-slate-700" />}
              </button>

              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger
                  className={cn(
                    headerControlStyles,
                    "w-full sm:w-[170px] rounded-full px-3",
                    isDarkMode && "bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                  )}
                  aria-label="Select time range"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Current Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem> {/* ADDED: Menu Item */}
                  <SelectItem value="month-select">Select Month…</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {timeRange === "month-select" && (
                <>
                  <Select value={String(selectedYear)} onValueChange={(val) => setSpecificMonth(Number(val), selectedMonth || 1)}>
                    <SelectTrigger
                      className={cn(
                        headerControlStyles,
                        "w-full sm:w-[110px] rounded-full px-3",
                        isDarkMode && "bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                      )}
                    >
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

                  <Select value={String(selectedMonth)} onValueChange={(val) => setSpecificMonth(selectedYear || thisYear, Number(val))}>
                    <SelectTrigger
                      className={cn(
                        headerControlStyles,
                        "w-full sm:w-[140px] rounded-full px-3",
                        isDarkMode && "bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                      )}
                    >
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
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          headerControlStyles,
                          "justify-start text-left font-normal px-3 rounded-full",
                          isDarkMode && "bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "MMM d") : "Start"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-auto p-0", isDarkMode ? "bg-slate-800 border-white/20" : "bg-white")} align="end">
                      <DatePicker
                        mode="single"
                        selected={customStartDate}
                        onSelect={(d) => setCustomRange(d ?? undefined, customEndDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className={isDarkMode ? "text-white/50" : "text-slate-500"}>–</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          headerControlStyles,
                          "justify-start text-left font-normal px-3 rounded-full",
                          isDarkMode && "bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:border-white/30"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "MMM d") : "End"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-auto p-0", isDarkMode ? "bg-slate-800 border-white/20" : "bg-white")} align="end">
                      <DatePicker
                        mode="single"
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

          {/* neon horizon line */}
          <div className="relative z-10 h-[3px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_0_26px_rgba(34,211,238,0.95),0_0_42px_rgba(59,130,246,0.8)]" />
        </div>
      </header>

      {/* MAIN: light background, slight sidebar-edge glow */}
      <main
        className={cn(
          // ✅ FIX: reserve scrollbar space so right gutter doesn’t look larger
          "relative min-h-0 overflow-y-auto transition-colors duration-300 [scrollbar-gutter:stable_both-edges]",
          isDarkMode ? "bg-gradient-to-b from-[#0f172a] to-[#1e293b]" : "bg-slate-50"
        )}
      >
        {/* soft glow under header into content */}
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-20 bg-gradient-to-b from-cyan-400/20 via-sky-400/10 to-transparent" />

        {/* subtle vertical glow echoing the header along sidebar edge – slightly reduced */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-sky-500/10 via-cyan-400/4 to-transparent" />

        <div className="relative z-10 px-4 md:px-6 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-8">
          {/* full-width main surface with slightly softer hover */}
          <div
            className={cn(
              "relative rounded-3xl overflow-hidden transition-all duration-300",
              isDarkMode
                ? "bg-white/5 backdrop-blur-lg shadow-[0_18px_55px_rgba(0,0,0,0.3)] border border-white/10 hover:shadow-[0_22px_72px_rgba(0,0,0,0.4)] hover:border-white/20"
                : "bg-white shadow-[0_18px_55px_rgba(15,23,42,0.16)] border border-slate-100 hover:shadow-[0_22px_72px_rgba(15,23,42,0.22)] hover:border-slate-200"
            )}
          >
            {/* inner top glow so KPI cards look lit */}
            <div className="pointer-events-none absolute -top-16 left-0 right-0 h-24 bg-gradient-to-b from-cyan-400/18 via-sky-400/8 to-transparent" />

            <div className="relative px-4 md:px-6 pt-6 pb-10">
              {/* KPI CARDS */}
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-7"
                variants={kpiContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Total Revenue */}
                <motion.div variants={kpiCardVariants}>
                  <Card
                    className={cn(
                      "border-0 shadow-md transition-all duration-200 hover:scale-[1.02]",
                      isDarkMode
                        ? "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                        : "bg-gradient-to-br from-emerald-50 to-green-50 hover:shadow-lg"
                    )}
                  >
                    <CardContent className="p-4 sm:p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide",
                              isDarkMode ? "text-white/75" : "text-slate-600"
                            )}
                          >
                            Total Revenue
                          </p>
                          <p
                            className={cn(
                              "text-xl font-bold font-mono tabular-nums",
                              isDarkMode ? "text-white/95" : "text-slate-900"
                            )}
                          >
                            SSP{" "}
                            <AnimatedNumber
                              value={Math.round(
                                monthTotalSSP ||
                                  parseFloat(dashboardData?.totalIncomeSSP || "0")
                              )}
                              duration={1500}
                              formatFn={(n) => nf0.format(Math.round(n))}
                            />
                          </p>
                          <div className="flex items-center mt-1">
                            {showNoDataYetRevenue ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No transactions yet
                              </span>
                            ) : revenueChangePct !== undefined &&
                              revenueChangePct !== null &&
                              (!(timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") || hasPreviousPeriodSSP) ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  revenueChangePct > 0
                                    ? isDarkMode
                                      ? "text-emerald-300"
                                      : "text-emerald-600"
                                    : revenueChangePct < 0
                                    ? isDarkMode
                                      ? "text-red-300"
                                      : "text-red-600"
                                    : isDarkMode
                                    ? "text-white/75"
                                    : "text-slate-500"
                                )}
                                style={
                                  isDarkMode
                                    ? {
                                        color:
                                          revenueChangePct > 0
                                            ? "#6ee7b7"
                                            : revenueChangePct < 0
                                            ? "#fca5a5"
                                            : undefined,
                                        fontWeight: 700,
                                        textShadow:
                                          revenueChangePct < 0
                                            ? "0 0 10px rgba(252, 165, 165, 0.5)"
                                            : "0 0 10px rgba(110, 231, 183, 0.4)",
                                      }
                                    : {}
                                }
                              >
                                <span className="font-bold">
                                  {revenueChangePct > 0 ? "+" : ""}
                                  {revenueChangePct.toFixed(1)}%
                                </span>{" "}
                                <span className={cn("font-normal", isDarkMode ? "text-white/85" : "text-slate-600")}>
                                  {comparisonLabel}
                                </span>
                              </span>
                            ) : shouldShowNoComparisonSSP ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No data to compare
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-2.5 rounded-xl shadow-sm",
                            isDarkMode && "opacity-80",
                            revenueChangePct !== undefined &&
                              revenueChangePct !== null &&
                              revenueChangePct < 0
                              ? "bg-red-100"
                              : "bg-emerald-100"
                          )}
                        >
                          {revenueChangePct !== undefined && revenueChangePct !== null && revenueChangePct < 0 ? (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Total Expenses */}
                <motion.div variants={kpiCardVariants}>
                  <Card
                    className={cn(
                      "border-0 shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer",
                      isDarkMode
                        ? "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                        : "bg-gradient-to-br from-red-50 to-rose-50 hover:shadow-lg"
                    )}
                    onClick={() => setOpenExpenses(true)}
                    onKeyDown={handleExpensesKeyDown}
                    role="button"
                    tabIndex={0}
                    aria-label="View expense breakdown"
                    title="Click to view expense breakdown"
                  >
                    <CardContent className="p-4 sm:p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("text-xs font-medium uppercase tracking-wide", isDarkMode ? "text-white/75" : "text-slate-600")}>
                            Total Expenses
                          </p>
                          <p className={cn("text-xl font-bold font-mono tabular-nums", isDarkMode ? "text-white/95" : "text-slate-900")}>
                            SSP{" "}
                            <AnimatedNumber
                              value={Math.round(parseFloat(dashboardData?.totalExpenses || "0"))}
                              duration={1500}
                              formatFn={(n) => nf0.format(Math.round(n))}
                            />
                          </p>
                          <div className="flex items-center mt-1">
                            {showNoDataYetExpenses ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No expenses yet
                              </span>
                            ) : dashboardData?.changes?.expenseChangeSSP !== undefined &&
                              (!(timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") || hasPreviousPeriodSSP) ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  dashboardData.changes.expenseChangeSSP > 0
                                    ? isDarkMode
                                      ? "text-red-300"
                                      : "text-red-600"
                                    : dashboardData.changes.expenseChangeSSP < 0
                                    ? isDarkMode
                                      ? "text-emerald-300"
                                      : "text-emerald-600"
                                    : isDarkMode
                                    ? "text-white/75"
                                    : "text-slate-500"
                                )}
                                style={
                                  isDarkMode
                                    ? {
                                        color:
                                          dashboardData.changes.expenseChangeSSP > 0
                                            ? "#fca5a5"
                                            : dashboardData.changes.expenseChangeSSP < 0
                                            ? "#6ee7b7"
                                            : undefined,
                                        fontWeight: 700,
                                        textShadow:
                                          dashboardData.changes.expenseChangeSSP > 0
                                            ? "0 0 10px rgba(252, 165, 165, 0.5)"
                                            : "0 0 10px rgba(110, 231, 183, 0.4)",
                                      }
                                    : {}
                                }
                              >
                                <span className="font-bold">
                                  {dashboardData.changes.expenseChangeSSP > 0 ? "+" : ""}
                                  {dashboardData.changes.expenseChangeSSP.toFixed(1)}%
                                </span>{" "}
                                <span className={cn("font-normal", isDarkMode ? "text-white/85" : "text-slate-600")}>
                                  {comparisonLabel}
                                </span>
                              </span>
                            ) : shouldShowNoComparisonSSP ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No data to compare
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-2.5 rounded-xl shadow-sm",
                            isDarkMode && "opacity-80",
                            dashboardData?.changes?.expenseChangeSSP !== undefined && dashboardData.changes.expenseChangeSSP < 0
                              ? "bg-emerald-100"
                              : "bg-red-100"
                          )}
                        >
                          {dashboardData?.changes?.expenseChangeSSP !== undefined && dashboardData.changes.expenseChangeSSP < 0 ? (
                            <TrendingDown className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Net Income */}
                <motion.div variants={kpiCardVariants}>
                  <Card
                    className={cn(
                      "border-0 shadow-md transition-all duration-200 hover:scale-[1.02]",
                      isDarkMode
                        ? "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                        : "bg-gradient-to-br from-blue-50 to-indigo-50 ring-1 ring-blue-100 hover:shadow-lg"
                    )}
                  >
                    <CardContent className="p-4 sm:p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("text-xs font-semibold uppercase tracking-wide flex items-center gap-1", isDarkMode ? "text-white/85" : "text-blue-700")}>
                            <span className={isDarkMode ? "text-cyan-400" : "text-blue-500"}>★</span> Net Income
                          </p>
                          <p className={cn("text-xl font-bold font-mono tabular-nums", isDarkMode ? "text-white/95" : "text-blue-900")}>
                            SSP{" "}
                            <AnimatedNumber
                              value={Math.round(sspNetIncome)}
                              duration={1500}
                              formatFn={(n) => nf0.format(Math.round(n))}
                            />
                          </p>
                          {sspRevenue > 0 && (
                            <p
                              className={cn(
                                "text-xs mt-0.5 font-medium",
                                sspNetIncome >= 0
                                  ? isDarkMode
                                    ? "text-cyan-400"
                                    : "text-blue-600"
                                  : isDarkMode
                                  ? "text-red-300"
                                  : "text-red-600"
                              )}
                              style={
                                isDarkMode && sspNetIncome < 0
                                  ? {
                                      color: "#fca5a5",
                                      fontWeight: 700,
                                      textShadow: "0 0 10px rgba(252, 165, 165, 0.5)",
                                    }
                                  : {}
                              }
                            >
                              {sspNetIncome >= 0 ? "Profit" : "Loss"} Margin:{" "}
                              {((sspNetIncome / sspRevenue) * 100).toFixed(1)}%
                            </p>
                          )}
                          <div className="flex items-center mt-1">
                            {showNoDataYetNetIncome ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No transactions yet
                              </span>
                            ) : dashboardData?.changes?.netIncomeChangeSSP !== undefined &&
                              (!(timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") || hasPreviousPeriodSSP) ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  dashboardData.changes.netIncomeChangeSSP > 0
                                    ? isDarkMode
                                      ? "text-emerald-300"
                                      : "text-emerald-600"
                                    : dashboardData.changes.netIncomeChangeSSP < 0
                                    ? isDarkMode
                                      ? "text-red-300"
                                      : "text-red-600"
                                    : isDarkMode
                                    ? "text-white/75"
                                    : "text-slate-500"
                                )}
                                style={
                                  isDarkMode
                                    ? {
                                        color:
                                          dashboardData.changes.netIncomeChangeSSP > 0
                                            ? "#6ee7b7"
                                            : dashboardData.changes.netIncomeChangeSSP < 0
                                            ? "#fca5a5"
                                            : undefined,
                                        fontWeight: 700,
                                        textShadow:
                                          dashboardData.changes.netIncomeChangeSSP < 0
                                            ? "0 0 10px rgba(252, 165, 165, 0.5)"
                                            : "0 0 10px rgba(110, 231, 183, 0.4)",
                                      }
                                    : {}
                                }
                              >
                                <span className="font-bold">
                                  {dashboardData.changes.netIncomeChangeSSP > 0 ? "+" : ""}
                                  {dashboardData.changes.netIncomeChangeSSP.toFixed(1)}%
                                </span>{" "}
                                <span className={cn("font-normal", isDarkMode ? "text-white/85" : "text-slate-600")}>
                                  {comparisonLabel}
                                </span>
                              </span>
                            ) : shouldShowNoComparisonSSP ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No data to compare
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-2.5 rounded-xl shadow-sm",
                            isDarkMode && "opacity-80",
                            dashboardData?.changes?.netIncomeChangeSSP !== undefined && dashboardData.changes.netIncomeChangeSSP > 0
                              ? "bg-emerald-100"
                              : dashboardData?.changes?.netIncomeChangeSSP !== undefined && dashboardData.changes.netIncomeChangeSSP < 0
                              ? "bg-red-100"
                              : isDarkMode
                              ? "bg-cyan-500/20"
                              : "bg-blue-100"
                          )}
                        >
                          {dashboardData?.changes?.netIncomeChangeSSP !== undefined &&
                          dashboardData?.changes?.netIncomeChangeSSP > 0 ? (
                            <TrendingUp className={cn("h-5 w-5", isDarkMode ? "text-emerald-400" : "text-emerald-600")} />
                          ) : dashboardData?.changes?.netIncomeChangeSSP !== undefined &&
                            dashboardData?.changes?.netIncomeChangeSSP < 0 ? (
                            <TrendingDown className={cn("h-5 w-5", isDarkMode ? "text-red-400" : "text-red-600")} />
                          ) : (
                            <DollarSign className={cn("h-5 w-5", isDarkMode ? "text-cyan-400" : "text-blue-600")} />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Insurance (USD) */}
                <motion.div variants={kpiCardVariants}>
                  <Card
                    className={cn(
                      "border-0 shadow-md transition-all duration-200",
                      isDarkMode
                        ? "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                        : "bg-gradient-to-br from-purple-50 to-violet-50 hover:shadow-lg"
                    )}
                  >
                    <CardContent className="p-4 sm:p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("text-xs font-medium uppercase tracking-wide", isDarkMode ? "text-white/75" : "text-slate-600")}>
                            Insurance (USD)
                          </p>
                          <p className={cn("text-xl font-bold font-mono tabular-nums", isDarkMode ? "text-white/95" : "text-slate-900")}>
                            USD{" "}
                            <AnimatedNumber
                              value={Math.round(parseFloat(dashboardData?.totalIncomeUSD || "0"))}
                              duration={1500}
                              formatFn={(n) => fmtUSD(Math.round(n))}
                            />
                          </p>
                          <div className="flex items-center mt-1">
                            {showNoDataYetInsurance ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No insurance claims yet
                              </span>
                            ) : insuranceChangePct !== undefined &&
                              insuranceChangePct !== null &&
                              (!(timeRange === "year" || timeRange === "last-year" || timeRange === "last-3-months") || hasPreviousPeriodUSD) ? (
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  insuranceChangePct > 0
                                    ? isDarkMode
                                      ? "text-emerald-400"
                                      : "text-emerald-600"
                                    : insuranceChangePct < 0
                                    ? isDarkMode
                                      ? "text-red-400"
                                      : "text-red-600"
                                    : isDarkMode
                                    ? "text-white/75"
                                    : "text-slate-500"
                                )}
                                style={
                                  isDarkMode
                                    ? {
                                        color:
                                          insuranceChangePct > 0
                                            ? "#4ade80"
                                            : insuranceChangePct < 0
                                            ? "#fca5a5"
                                            : undefined,
                                        fontWeight: 700,
                                        textShadow:
                                          insuranceChangePct < 0 ? "0 0 8px rgba(252, 165, 165, 0.3)" : undefined,
                                      }
                                    : {}
                                }
                              >
                                <span className="font-bold">
                                  {insuranceChangePct > 0 ? "+" : ""}
                                  {insuranceChangePct.toFixed(1)}%
                                </span>{" "}
                                <span className={cn("font-normal", isDarkMode ? "text-white/85" : "text-slate-600")}>
                                  {comparisonLabel}
                                </span>
                              </span>
                            ) : shouldShowNoComparisonUSD ? (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                No data to compare
                              </span>
                            ) : (
                              <span className={cn("text-xs font-medium", isDarkMode ? "text-purple-400" : "text-purple-600")}>
                                {Object.keys(dashboardData?.insuranceBreakdown || {}).length === 1
                                  ? "1 provider"
                                  : `${Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-2.5 rounded-xl shadow-sm",
                            isDarkMode && "opacity-80",
                            insuranceChangePct !== undefined && insuranceChangePct > 0
                              ? "bg-emerald-100"
                              : insuranceChangePct !== undefined && insuranceChangePct < 0
                              ? "bg-red-100"
                              : isDarkMode
                              ? "bg-purple-500/20"
                              : "bg-purple-100"
                          )}
                        >
                          {insuranceChangePct !== undefined && insuranceChangePct > 0 ? (
                            <TrendingUp className={cn("h-5 w-5", isDarkMode ? "text-emerald-400" : "text-emerald-600")} />
                          ) : insuranceChangePct !== undefined && insuranceChangePct < 0 ? (
                            <TrendingDown className={cn("h-5 w-5", isDarkMode ? "text-red-400" : "text-red-600")} />
                          ) : (
                            <DollarSign className={cn("h-5 w-5", isDarkMode ? "text-purple-400" : "text-purple-600")} />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Patient Volume */}
                <motion.div variants={kpiCardVariants}>
                  <Link
                    href={`/patient-volume?view=monthly&year=${yearToSend}&month=${monthToSend}&range=${rangeToSend}`}
                    aria-label="View patient volume details"
                  >
                    <Card
                      className={cn(
                        "border-0 shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer",
                        isDarkMode
                          ? "bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/8 hover:border-white/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                          : "bg-gradient-to-br from-teal-50 to-cyan-50 hover:shadow-lg"
                      )}
                    >
                      <CardContent className="p-4 sm:p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={cn("text-xs font-medium uppercase tracking-wide", isDarkMode ? "text-white/75" : "text-slate-600")}>
                              Total Patients
                            </p>
                            <p className={cn("text-xl font-bold font-mono tabular-nums", isDarkMode ? "text-white/95" : "text-slate-900")}>
                              <AnimatedNumber
                                value={dashboardData?.totalPatients || 0}
                                duration={1500}
                                formatFn={(n) => nf0.format(Math.round(n))}
                              />
                            </p>
                            <div className="flex items-center mt-1">
                              {showNoDataYetPatients ? (
                                <span className={cn("text-xs font-medium", isDarkMode ? "text-white/75" : "text-slate-500")}>
                                  No patients recorded yet
                                </span>
                              ) : (
                                <span className={cn("text-xs font-medium", isDarkMode ? "text-teal-400" : "text-teal-600")}>
                                  Current period
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={cn("p-2.5 rounded-xl shadow-sm", isDarkMode && "opacity-80 bg-teal-500/20")}>
                            <Users className={cn("h-5 w-5", isDarkMode ? "text-teal-400" : "text-teal-600")} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              </motion.div>

              {/* MAIN GRID INSIDE SURFACE - Full Width Charts */}
              <div className="space-y-6 mb-8">
                {/* Revenue Analytics - Full Width */}
                <motion.div variants={chartVariants} initial="hidden" animate="visible">
                  <RevenueAnalyticsDaily
                    timeRange={rangeToSend}
                    selectedYear={yearToSend}
                    selectedMonth={monthToSend}
                    customStartDate={customStartDate ?? undefined}
                    customEndDate={customEndDate ?? undefined}
                    isDarkMode={isDarkMode}
                  />
                </motion.div>

                {/* Departments and Insurance - Side by Side on Large Screens */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <motion.div variants={cardVariants}>
                      <DepartmentsPanel
                        departments={Array.isArray(departments) ? (departments as any[]) : []}
                        departmentBreakdown={dashboardData?.departmentBreakdown}
                        totalSSP={sspRevenue}
                        isDarkMode={isDarkMode}
                      />
                    </motion.div>
                  </motion.div>

                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <motion.div variants={cardVariants}>
                      <InsuranceProvidersUSD
                        breakdown={dashboardData?.insuranceBreakdown}
                        totalUSD={parseFloat(dashboardData?.totalIncomeUSD || "0")}
                        isDarkMode={isDarkMode}
                      />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Quick Actions and System Status - Side by Side on Large Screens */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <QuickActionsCard isDarkMode={isDarkMode} />
                  </motion.div>

                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <motion.div variants={cardVariants}>
                      <Card
                        className={cn(
                          "shadow-sm self-start",
                          isDarkMode ? "bg-white/3 border border-white/10" : "border border-slate-200"
                        )}
                      >
                        <CardHeader>
                          <CardTitle
                            className={cn(
                              "text-lg font-semibold flex items-center gap-2",
                              isDarkMode ? "text-white/95" : "text-slate-900"
                            )}
                          >
                            <div className="w-2 h-2 bg-blue-500 rounded-full" /> System Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={cn("text-sm", isDarkMode ? "text-white/70" : "text-slate-600")}>Database</span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "rounded-full",
                                  isDarkMode
                                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                                    : "bg-green-100 text-green-700 border-green-200"
                                )}
                              >
                                Connected
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={cn("text-sm", isDarkMode ? "text-white/70" : "text-slate-600")}>Last Sync</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full",
                                  isDarkMode ? "border-white/20 text-white/90" : "border-slate-200 text-slate-600"
                                )}
                              >
                                {lastUpdatedLabel}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={cn("text-sm", isDarkMode ? "text-white/70" : "text-slate-600")}>Active Users</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full",
                                  isDarkMode
                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                1 online
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </motion.div>
                </div>
              </div>

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
          </div>
        </div>
      </main>
    </div>
  );
}
