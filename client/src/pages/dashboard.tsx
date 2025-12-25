/**
 * Trends & Comparisons Page
 * 
 * Provides historical analysis and comparative insights:
 * - 12-month Revenue Trend chart with SSP/USD toggle
 * - Month vs Month comparison
 * - Department Growth rates
 * - Enhanced Expenses Breakdown
 * - Insights Summary Card
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
import { 
  getDateRange, 
  getLastCompleteMonth, 
  formatDateForAPI,
  type RangeKey,
  filterOptions as dateRangeFilterOptions,
} from "@/lib/dateRanges";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Building,
  DollarSign,
  CreditCard,
  Wallet,
  Users,
  Star,
  BarChart3,
  Stethoscope,
  FlaskConical,
  ScanLine,
  Pill,
  TestTubes,
  LucideIcon,
  Sparkles,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Receipt,
} from "lucide-react";
import { api } from "@/lib/queryClient";
import PageHeader from "@/components/layout/PageHeader";
import PremiumInsightBanner from "@/components/dashboard/PremiumInsightBanner";
import PremiumRevenueTrendChart from "@/components/dashboard/PremiumRevenueTrendChart";
import PremiumComparisonCards from "@/components/dashboard/PremiumComparisonCards";
import PremiumDepartmentGrowth from "@/components/dashboard/PremiumDepartmentGrowth";
import PremiumExpenseBreakdown from "@/components/dashboard/PremiumExpenseBreakdown";
import { generateSmartInsights } from "@/lib/insightGenerator";
import { containerVariants, cardVariants } from "@/lib/animations";

// Constants for number formatting thresholds
const BILLION = 1_000_000_000;
const TEN_BILLION = 10_000_000_000;
const MILLION = 1_000_000;
const TEN_MILLION = 10_000_000;
const THOUSAND = 1_000;

// Display configuration constants
const MAX_DEPARTMENTS_DISPLAYED = 6;
const GROWTH_SCALE_FACTOR = 2;
const MAX_GROWTH_BAR_WIDTH = 100;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function compactSSP(n: number) {
  const v = Math.abs(n);
  if (v >= BILLION) return `SSP ${(n / BILLION).toFixed(v < TEN_BILLION ? 1 : 0)}B`;
  if (v >= MILLION) return `SSP ${(n / MILLION).toFixed(v < TEN_MILLION ? 1 : 0)}M`;
  if (v >= THOUSAND) return `SSP ${nf0.format(Math.round(n / THOUSAND))}k`;
  return `SSP ${nf0.format(Math.round(n))}`;
}

function compactUSD(n: number) {
  const v = Math.abs(n);
  if (v >= MILLION) return `USD ${(n / MILLION).toFixed(v < TEN_MILLION ? 1 : 0)}M`;
  if (v >= THOUSAND) return `USD ${(n / THOUSAND).toFixed(v < (10 * THOUSAND) ? 1 : 0)}k`;
  return `USD ${nf0.format(Math.round(n))}`;
}

// Format X-axis dates from "YYYY-MM" to abbreviated month names
function formatXAxisMonth(monthStr: string): string {
  try {
    const parts = monthStr.split('-');
    if (parts.length >= 2) {
      const monthNum = parseInt(parts[1], 10);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthNum >= 1 && monthNum <= 12) {
        return monthNames[monthNum - 1];
      }
    }
    return monthStr;
  } catch {
    return monthStr;
  }
}

// Filter options for time period selection (import from centralized helper)
type FilterOption = RangeKey;
const filterOptions = dateRangeFilterOptions;

// Type definitions
interface Department {
  id: string | number;
  name: string;
}

interface DepartmentStyleConfig {
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

interface DepartmentGrowthItem extends DepartmentStyleConfig {
  id: string | number;
  name: string;
  currentValue: number;
  prevValue: number;
  growth: number;
  isNewDepartment: boolean;  // true when prev = 0 and current > 0
  hasNoActivity: boolean;    // true when both prev and current = 0
}

/** Monthly trend data item returned by the batched endpoint */
interface MonthlyTrendItem {
  month: string;
  fullMonth: string;
  year: number;
  monthNum: number;
  revenue: number;
  revenueUSD: number;
  departmentBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
  totalExpenses: number;
}

// Department icon mapping
const departmentIcons: Record<string, DepartmentStyleConfig> = {
  "Lab": { icon: FlaskConical, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  "Ultrasound": { icon: ScanLine, bgColor: "bg-purple-100", iconColor: "text-purple-600" },
  "X-Ray": { icon: ScanLine, bgColor: "bg-amber-100", iconColor: "text-amber-600" },
  "Pharmacy": { icon: Pill, bgColor: "bg-green-100", iconColor: "text-green-600" },
  "Consultation": { icon: Stethoscope, bgColor: "bg-teal-100", iconColor: "text-teal-600" },
  "Lab Tests": { icon: TestTubes, bgColor: "bg-indigo-100", iconColor: "text-indigo-600" },
};

function getDepartmentStyle(name: string): DepartmentStyleConfig {
  // Try to match department name
  for (const [key, style] of Object.entries(departmentIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return style;
    }
  }
  // Default style
  return { icon: Building, bgColor: "bg-slate-100", iconColor: "text-slate-600" };
}

// Month abbreviations for custom month picker
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Dashboard() {
  const now = new Date();
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("this-year");
  const [currencyTab, setCurrencyTab] = useState<"ssp" | "usd">("ssp");
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line");
  
  // Month vs Month custom selection state
  // Handle year boundary: if current month is January (0), compare to December of previous year
  const [customComparisonEnabled, setCustomComparisonEnabled] = useState(false);
  const [customBaseYear, setCustomBaseYear] = useState<number>(now.getFullYear());
  const [customBaseMonth, setCustomBaseMonth] = useState<number>(now.getMonth()); // 0-indexed for Date
  const [customCompareYear, setCustomCompareYear] = useState<number>(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  );
  const [customCompareMonth, setCustomCompareMonth] = useState<number>(
    now.getMonth() === 0 ? 11 : now.getMonth() - 1 // December (11) if January, otherwise previous month
  );
  
  const thisYear = now.getFullYear();

  // Use centralized date range helper for canonical date calculations
  const lastCompleteMonthDate = getLastCompleteMonth(now);
  const lastCompleteYear = lastCompleteMonthDate.getFullYear();
  const lastCompleteMonth = lastCompleteMonthDate.getMonth() + 1;

  // Calculate date range based on selected filter using centralized helper
  const dateRangeResult = useMemo(() => {
    return getDateRange(selectedFilter, now);
  }, [selectedFilter, now]);

  // Extract values from the date range result
  const { 
    startDate: filterStartDate, 
    endDate: filterEndDate, 
    monthsCount, 
    label: canonicalRangeLabel,
    isSingleMonth: isFilterSingleMonth 
  } = dateRangeResult;

  // For Month vs Month comparison
  // Use custom selection if enabled, otherwise use last two complete months
  const { comparisonCurrentDate, comparisonPrevDate, comparisonCurrentYear, comparisonCurrentMonth, comparisonPrevYear, comparisonPrevMonth, isCustomComparison } = useMemo(() => {
    if (customComparisonEnabled) {
      // Custom selection: use user-selected months
      const baseDate = new Date(customBaseYear, customBaseMonth, 1);
      const compareDate = new Date(customCompareYear, customCompareMonth, 1);
      return {
        comparisonCurrentDate: baseDate,
        comparisonPrevDate: compareDate,
        comparisonCurrentYear: customBaseYear,
        comparisonCurrentMonth: customBaseMonth + 1, // Convert to 1-indexed
        comparisonPrevYear: customCompareYear,
        comparisonPrevMonth: customCompareMonth + 1, // Convert to 1-indexed
        isCustomComparison: true,
      };
    }
    // Default: last two complete months
    const current = lastCompleteMonthDate;
    const prev = subMonths(lastCompleteMonthDate, 1);
    return {
      comparisonCurrentDate: current,
      comparisonPrevDate: prev,
      comparisonCurrentYear: current.getFullYear(),
      comparisonCurrentMonth: current.getMonth() + 1,
      comparisonPrevYear: prev.getFullYear(),
      comparisonPrevMonth: prev.getMonth() + 1,
      isCustomComparison: false,
    };
  }, [customComparisonEnabled, customBaseYear, customBaseMonth, customCompareYear, customCompareMonth, lastCompleteMonthDate]);

  // Fetch dashboard data for comparison current month (last complete month)
  const { data: currentMonthData, isLoading: loadingCurrent } = useQuery({
    queryKey: ["/api/dashboard", comparisonCurrentYear, comparisonCurrentMonth, "current-month", "comparison"],
    queryFn: async () => {
      const url = `/api/dashboard?year=${comparisonCurrentYear}&month=${comparisonCurrentMonth}&range=current-month`;
      const { data } = await api.get(url);
      return data;
    },
  });

  // Fetch dashboard data for comparison previous month (month before last complete)
  const { data: prevMonthData, isLoading: loadingPrev } = useQuery({
    queryKey: ["/api/dashboard", comparisonPrevYear, comparisonPrevMonth, "current-month", "prev"],
    queryFn: async () => {
      const url = `/api/dashboard?year=${comparisonPrevYear}&month=${comparisonPrevMonth}&range=current-month`;
      const { data } = await api.get(url);
      return data;
    },
  });

  // Fetch revenue trend data based on filter using batched endpoint (single request)
  const { data: monthlyTrend = [], isLoading: loadingTrend } = useQuery<MonthlyTrendItem[]>({
    queryKey: ["/api/trends/monthly-revenue", selectedFilter, filterStartDate?.toISOString(), filterEndDate?.toISOString()],
    queryFn: async (): Promise<MonthlyTrendItem[]> => {
      // Use the batched endpoint for better performance - single DB query instead of N queries
      const startDateStr = formatDateForAPI(filterStartDate);
      const endDateStr = formatDateForAPI(filterEndDate);
      
      try {
        const url = `/api/trends/monthly-revenue?startDate=${startDateStr}&endDate=${endDateStr}`;
        const { data } = await api.get(url);
        
        // Transform response to match expected format
        return (data || []).map((item: any): MonthlyTrendItem => ({
          month: item.month,
          fullMonth: item.fullMonth,
          year: item.year,
          monthNum: item.monthNum,
          revenue: item.revenue || 0,
          revenueUSD: item.revenueUSD || 0,
          departmentBreakdown: item.departmentBreakdown || {},
          expenseBreakdown: item.expenseBreakdown || {},
          totalExpenses: item.totalExpenses || 0,
        }));
      } catch (error) {
        console.error("Failed to fetch monthly trend data:", error);
        // Return empty array on error
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch patient volume for comparison months (last complete month vs month before)
  const { data: currentPatients = 0 } = useQuery({
    queryKey: ["/api/patient-volume/period", comparisonCurrentYear, comparisonCurrentMonth],
    queryFn: async () => {
      try {
        const url = `/api/patient-volume/period/${comparisonCurrentYear}/${comparisonCurrentMonth}?range=current-month`;
        const { data } = await api.get(url);
        return Array.isArray(data) ? data.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0) : 0;
      } catch {
        return 0;
      }
    },
  });

  const { data: prevPatients = 0 } = useQuery({
    queryKey: ["/api/patient-volume/period", comparisonPrevYear, comparisonPrevMonth, "prev"],
    queryFn: async () => {
      try {
        const url = `/api/patient-volume/period/${comparisonPrevYear}/${comparisonPrevMonth}?range=current-month`;
        const { data } = await api.get(url);
        return Array.isArray(data) ? data.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0) : 0;
      } catch {
        return 0;
      }
    },
  });

  const { data: departments = [] } = useQuery({ queryKey: ["/api/departments"] });

  // Calculate comparison metrics
  const currentRevenue = parseFloat(currentMonthData?.totalIncomeSSP || "0");
  const prevRevenue = parseFloat(prevMonthData?.totalIncomeSSP || "0");
  const currentExpenses = parseFloat(currentMonthData?.totalExpenses || "0");
  const prevExpenses = parseFloat(prevMonthData?.totalExpenses || "0");
  const currentNetIncome = currentRevenue - currentExpenses;
  const prevNetIncome = prevRevenue - prevExpenses;

  const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const expensesChange = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
  const netIncomeChange = prevNetIncome !== 0 ? ((currentNetIncome - prevNetIncome) / Math.abs(prevNetIncome)) * 100 : 0;
  const patientsChange = prevPatients > 0 ? ((currentPatients - prevPatients) / prevPatients) * 100 : 0;

  // Prepare comparison metrics for Premium Comparison Cards
  const comparisonMetrics = useMemo(() => [
    {
      id: "revenue",
      label: "Revenue",
      icon: DollarSign,
      currentValue: currentRevenue,
      prevValue: prevRevenue,
      change: revenueChange,
      formatter: compactSSP,
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      shadowColor: "rgba(16, 185, 129, 0.2)",
      isPositiveGood: true,
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: CreditCard,
      currentValue: currentExpenses,
      prevValue: prevExpenses,
      change: expensesChange,
      formatter: compactSSP,
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      shadowColor: "rgba(239, 68, 68, 0.2)",
      isPositiveGood: false, // Lower is better for expenses
    },
    {
      id: "netIncome",
      label: "Net Income",
      icon: Wallet,
      currentValue: currentNetIncome,
      prevValue: prevNetIncome,
      change: netIncomeChange,
      formatter: compactSSP,
      gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
      shadowColor: "rgba(59, 130, 246, 0.2)",
      isPositiveGood: true,
    },
    {
      id: "patients",
      label: "Patients",
      icon: Users,
      currentValue: currentPatients,
      prevValue: prevPatients,
      change: patientsChange,
      formatter: (n: number) => nf0.format(n),
      gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
      shadowColor: "rgba(168, 85, 247, 0.2)",
      isPositiveGood: true,
    },
  ], [
    currentRevenue,
    prevRevenue,
    revenueChange,
    currentExpenses,
    prevExpenses,
    expensesChange,
    currentNetIncome,
    prevNetIncome,
    netIncomeChange,
    currentPatients,
    prevPatients,
    patientsChange,
  ]);

  // Labels for Month vs Month comparison - use comparison months, not current calendar month
  // Defined here before use in useMemo hooks
  const comparisonCurrentMonthLabel = format(comparisonCurrentDate, "MMMM yyyy");
  const comparisonPrevMonthLabel = format(comparisonPrevDate, "MMMM yyyy");

  // Calculate department growth with proper handling for new and inactive departments
  const departmentGrowth = useMemo((): DepartmentGrowthItem[] => {
    const currentBreakdown = currentMonthData?.departmentBreakdown || {};
    const prevBreakdown = prevMonthData?.departmentBreakdown || {};
    
    const deptArray: Department[] = Array.isArray(departments) ? departments : [];
    
    return deptArray.map((dept: Department) => {
      const currentVal = parseFloat(currentBreakdown[dept.id] || currentBreakdown[dept.name] || "0");
      const prevVal = parseFloat(prevBreakdown[dept.id] || prevBreakdown[dept.name] || "0");
      
      // Determine if this is a new department (started this month) or has no activity
      const isNewDepartment = prevVal === 0 && currentVal > 0;
      const hasNoActivity = prevVal === 0 && currentVal === 0;
      
      // Calculate growth - for new departments, don't show misleading +100%
      let growth = 0;
      if (prevVal > 0) {
        growth = ((currentVal - prevVal) / prevVal) * 100;
      } else if (currentVal > 0) {
        // New department - we'll display "New this month" instead of percentage
        growth = 0; // Will be handled specially in UI
      }
      
      const style = getDepartmentStyle(dept.name);
      
      return {
        id: dept.id,
        name: dept.name,
        currentValue: currentVal,
        prevValue: prevVal,
        growth,
        isNewDepartment,
        hasNoActivity,
        ...style,
      };
    }).filter((d) => d.currentValue > 0 || d.prevValue > 0) // Hide departments with no activity
      .sort((a, b) => {
        // Sort new departments to top, then by growth rate
        if (a.isNewDepartment && !b.isNewDepartment) return -1;
        if (!a.isNewDepartment && b.isNewDepartment) return 1;
        return b.growth - a.growth;
      });
  }, [currentMonthData, prevMonthData, departments]);

  // Aggregate expenses based on the selected filter period
  const aggregatedExpenses = useMemo(() => {
    if (monthlyTrend.length === 0) {
      return {
        breakdown: currentMonthData?.expenseBreakdown || {},
        total: currentExpenses,
        periodLabel: comparisonCurrentMonthLabel,
      };
    }
    
    // Aggregate expense breakdowns from all months in the trend
    const combined: Record<string, number> = {};
    let totalExpensesSum = 0;
    
    for (const month of monthlyTrend) {
      totalExpensesSum += month.totalExpenses || 0;
      const breakdown = month.expenseBreakdown || {};
      for (const [category, amount] of Object.entries(breakdown)) {
        const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount) || "0");
        // Normalize category names - merge "Other", "Others", "other", "others", "Other expenses" into "Other"
        const normalizedCategory = category.toLowerCase().trim();
        let finalCategory = category;
        if (normalizedCategory === 'other' || normalizedCategory === 'others' || normalizedCategory === 'other expenses' || normalizedCategory === 'other expense') {
          finalCategory = 'Other';
        }
        combined[finalCategory] = (combined[finalCategory] || 0) + numAmount;
      }
    }
    
    // Use the canonical range label from the centralized helper
    return {
      breakdown: combined,
      total: totalExpensesSum,
      periodLabel: canonicalRangeLabel,
    };
  }, [monthlyTrend, currentMonthData, currentExpenses, canonicalRangeLabel, comparisonCurrentMonthLabel]);

  // Transform expenses for Premium Expense Breakdown component
  const premiumExpenses = useMemo(() => {
    const sortedExpenses = Object.entries(aggregatedExpenses.breakdown)
      .map(([name, amount]) => ({
        name,
        amount: Number(amount) || 0,
      }))
      .filter(e => {
        const isOther = e.name.toLowerCase().trim() === 'other' || 
                       e.name.toLowerCase().trim() === 'others' ||
                       e.name.toLowerCase().trim() === 'other expenses' ||
                       e.name.toLowerCase().trim() === 'other expense';
        return !isOther;
      })
      .sort((a, b) => b.amount - a.amount);

    // Calculate "Other" total
    const otherTotal = Object.entries(aggregatedExpenses.breakdown)
      .filter(([name]) => {
        const normalized = name.toLowerCase().trim();
        return normalized === 'other' || normalized === 'others' || 
               normalized === 'other expenses' || normalized === 'other expense';
      })
      .reduce((sum, [, amount]) => sum + (Number(amount) || 0), 0);

    // Limit to top 6 categories, combine rest into "Other"
    const maxCategories = 6;
    let finalExpenses = sortedExpenses.slice(0, maxCategories);
    
    if (sortedExpenses.length > maxCategories) {
      const remainingTotal = sortedExpenses.slice(maxCategories)
        .reduce((sum, e) => sum + e.amount, 0) + otherTotal;
      finalExpenses.push({ name: 'Other', amount: remainingTotal });
    } else if (otherTotal > 0) {
      finalExpenses.push({ name: 'Other', amount: otherTotal });
    }

    // Add percentages
    const total = aggregatedExpenses.total || finalExpenses.reduce((s, e) => s + e.amount, 0);
    return finalExpenses.map(e => ({
      ...e,
      percentage: total > 0 ? Math.round((e.amount / total) * 100) : 0,
    }));
  }, [aggregatedExpenses]);
        }
        combined[finalCategory] = (combined[finalCategory] || 0) + numAmount;
      }
    }
    
    // Use the canonical range label from the centralized helper
    return {
      breakdown: combined,
      total: totalExpensesSum,
      periodLabel: canonicalRangeLabel,
    };
  }, [monthlyTrend, currentMonthData, currentExpenses, canonicalRangeLabel, comparisonCurrentMonthLabel]);

  // Calculate trend stats for SSP with improved YoY calculation
  const trendStats = useMemo(() => {
    if (monthlyTrend.length === 0) return { yoyGrowth: 0, bestMonth: "", monthlyAvg: 0, yoyComparisonAvailable: false };
    
    const total = monthlyTrend.reduce((sum: number, m: MonthlyTrendItem) => sum + m.revenue, 0);
    const avg = total / monthlyTrend.length;
    const best = monthlyTrend.reduce((max: MonthlyTrendItem, m: MonthlyTrendItem) => m.revenue > max.revenue ? m : max, monthlyTrend[0]);
    
    // Calculate proper YoY growth:
    // Compare the most recent complete month to the same month last year
    // Only if both are within the trend window
    const lastMonthData = monthlyTrend[monthlyTrend.length - 1];
    let yoyGrowth = 0;
    let yoyComparisonAvailable = false;
    
    if (lastMonthData) {
      const targetYear = lastMonthData.year - 1; // Previous year
      const targetMonthNum = lastMonthData.monthNum;
      
      // Look for the same month in the previous year using year and monthNum for precise matching
      const sameMonthLastYearData = monthlyTrend.find((m: MonthlyTrendItem) => {
        return m.year === targetYear && m.monthNum === targetMonthNum;
      });
      
      if (sameMonthLastYearData && sameMonthLastYearData.revenue > 0) {
        yoyGrowth = ((lastMonthData.revenue - sameMonthLastYearData.revenue) / sameMonthLastYearData.revenue) * 100;
        yoyComparisonAvailable = true;
      } else if (monthlyTrend.length > 1) {
        // Fallback: compare first vs last month in trend (period growth)
        const firstMonthRev = monthlyTrend[0]?.revenue || 0;
        const lastMonthRev = lastMonthData.revenue;
        if (firstMonthRev > 0) {
          yoyGrowth = ((lastMonthRev - firstMonthRev) / firstMonthRev) * 100;
          yoyComparisonAvailable = true;
        }
      }
    }
    
    return {
      yoyGrowth,
      bestMonth: best?.fullMonth || best?.month || "",
      monthlyAvg: avg,
      yoyComparisonAvailable,
    };
  }, [monthlyTrend]);

  // Calculate trend stats for USD with improved YoY calculation
  const trendStatsUSD = useMemo(() => {
    if (monthlyTrend.length === 0) return { yoyGrowth: 0, bestMonth: "", monthlyAvg: 0, yoyComparisonAvailable: false };
    
    const total = monthlyTrend.reduce((sum: number, m: MonthlyTrendItem) => sum + m.revenueUSD, 0);
    const avg = total / monthlyTrend.length;
    const best = monthlyTrend.reduce((max: MonthlyTrendItem, m: MonthlyTrendItem) => m.revenueUSD > max.revenueUSD ? m : max, monthlyTrend[0]);
    
    // Calculate proper YoY growth for USD using year and monthNum for precise matching
    const lastMonthData = monthlyTrend[monthlyTrend.length - 1];
    let yoyGrowth = 0;
    let yoyComparisonAvailable = false;
    
    if (lastMonthData) {
      const targetYear = lastMonthData.year - 1;
      const targetMonthNum = lastMonthData.monthNum;
      
      const sameMonthLastYearData = monthlyTrend.find((m: MonthlyTrendItem) => {
        return m.year === targetYear && m.monthNum === targetMonthNum;
      });
      
      if (sameMonthLastYearData && sameMonthLastYearData.revenueUSD > 0) {
        yoyGrowth = ((lastMonthData.revenueUSD - sameMonthLastYearData.revenueUSD) / sameMonthLastYearData.revenueUSD) * 100;
        yoyComparisonAvailable = true;
      } else if (monthlyTrend.length > 1) {
        const firstMonthRev = monthlyTrend[0]?.revenueUSD || 0;
        const lastMonthRev = lastMonthData.revenueUSD;
        if (firstMonthRev > 0) {
          yoyGrowth = ((lastMonthRev - firstMonthRev) / firstMonthRev) * 100;
          yoyComparisonAvailable = true;
        }
      }
    }
    
    return {
      yoyGrowth,
      bestMonth: best?.fullMonth || best?.month || "",
      monthlyAvg: avg,
      yoyComparisonAvailable,
    };
  }, [monthlyTrend]);

  // Generate smart AI-powered insights
  const smartInsights = useMemo(() => {
    if (monthlyTrend.length === 0) return [];
    
    return generateSmartInsights(
      monthlyTrend,
      departmentGrowth,
      trendStats,
      aggregatedExpenses.breakdown,
      aggregatedExpenses.total
    );
  }, [monthlyTrend, departmentGrowth, trendStats, aggregatedExpenses]);

  // Compute clear period description for the trend chart - use canonical label from helper
  const trendPeriodDescription = useMemo(() => {
    // If we have no trend data, fall back to the canonical label since that's what we requested
    if (monthlyTrend.length === 0) {
      return canonicalRangeLabel || "No data available";
    }
    
    // Use the canonical range label from the centralized helper
    return canonicalRangeLabel;
  }, [monthlyTrend, canonicalRangeLabel]);

  const isLoading = loadingCurrent || loadingPrev || loadingTrend;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Card className="p-6"><Skeleton className="h-80 w-full" /></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
            <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
          </div>
          <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
        </main>
      </div>
    );
  }

  // Custom tooltip for SSP chart
  const CustomTooltipSSP = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const avgRevenue = trendStats.monthlyAvg;
    const isAboveAverage = data.revenue > avgRevenue;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="font-medium text-slate-900">{data.fullMonth}</p>
        <p className="text-teal-600 font-semibold">{compactSSP(data.revenue)}</p>
        <p className="text-xs text-slate-500 mt-1">
          {isAboveAverage ? '↑ Above average' : '↓ Below average'}
        </p>
      </div>
    );
  };

  // Custom tooltip for USD chart
  const CustomTooltipUSD = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const avgRevenue = trendStatsUSD.monthlyAvg;
    const isAboveAverage = data.revenueUSD > avgRevenue;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="font-medium text-slate-900">{data.fullMonth}</p>
        <p className="text-blue-600 font-semibold">{compactUSD(data.revenueUSD)}</p>
        <p className="text-xs text-slate-500 mt-1">
          {isAboveAverage ? '↑ Above average' : '↓ Below average'}
        </p>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <PageHeader
        variant="trends"
        title="Trends & Comparisons"
        subtitle="Analyze performance trends and compare across periods"
      >
        <Select value={selectedFilter} onValueChange={(v: FilterOption) => setSelectedFilter(v)}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Premium AI Insights Banner */}
        {smartInsights.length > 0 && (
          <PremiumInsightBanner
            insights={smartInsights}
            autoRotate={true}
            rotateInterval={8000}
          />
        )}
        
        {/* Premium Revenue Trend Chart */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <div className="p-1.5 rounded-lg bg-teal-100">
                      <TrendingUp className="h-5 w-5 text-teal-600" />
                    </div>
                    Revenue Trend
                  </CardTitle>
                  <CardDescription>{trendPeriodDescription}</CardDescription>
                </div>
                
                {/* Chart Type Toggle Buttons */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant={chartType === 'line' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('line')}
                    >
                      <LineChartIcon className="w-4 h-4 mr-1" />
                      Line
                    </Button>
                    <Button
                      variant={chartType === 'area' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('area')}
                    >
                      <AreaChartIcon className="w-4 h-4 mr-1" />
                      Area
                    </Button>
                    <Button
                      variant={chartType === 'bar' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('bar')}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Bar
                    </Button>
                  </div>
                  
                  {/* Currency Toggle Tabs */}
                  <Tabs value={currencyTab} onValueChange={(v) => setCurrencyTab(v as "ssp" | "usd")} className="w-auto">
                    <TabsList className="bg-slate-100">
                      <TabsTrigger value="ssp" className="data-[state=active]:bg-white">
                        SSP Revenue
                      </TabsTrigger>
                      <TabsTrigger value="usd" className="data-[state=active]:bg-white">
                        USD Insurance
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PremiumRevenueTrendChart
                data={monthlyTrend}
                currency={currencyTab}
                chartType={chartType}
                onChartTypeChange={setChartType}
                trendStats={currencyTab === "ssp" ? trendStats : trendStatsUSD}
                isFilterSingleMonth={isFilterSingleMonth}
                compactSSP={compactSSP}
                compactUSD={compactUSD}
                formatXAxisMonth={formatXAxisMonth}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Month vs Month and Department Growth Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Month vs Month Comparison */}
          <Card className="border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <div className="p-1.5 rounded-lg bg-blue-100">
                      <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                    </div>
                    Month vs Month
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {comparisonCurrentMonthLabel} vs {comparisonPrevMonthLabel}
                    {!isCustomComparison && (
                      <span className="ml-1 text-xs text-slate-400">(Last two complete months)</span>
                    )}
                    {isCustomComparison && (
                      <span className="ml-1 text-xs text-blue-500">(Selected months)</span>
                    )}
                  </CardDescription>
                </div>
                <button
                  onClick={() => setCustomComparisonEnabled(!customComparisonEnabled)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    customComparisonEnabled 
                      ? "bg-blue-50 border-blue-200 text-blue-700" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {customComparisonEnabled ? "Reset to default" : "Compare other months"}
                </button>
              </div>
              
              {/* Custom month selection controls */}
              {customComparisonEnabled && (
                <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Base Month</label>
                      <div className="flex gap-1">
                        <Select 
                          value={String(customBaseYear)} 
                          onValueChange={(v) => setCustomBaseYear(Number(v))}
                        >
                          <SelectTrigger className="h-8 text-xs w-[72px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select 
                          value={String(customBaseMonth)} 
                          onValueChange={(v) => setCustomBaseMonth(Number(v))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_NAMES_SHORT.map((m, i) => (
                              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Compare To</label>
                      <div className="flex gap-1">
                        <Select 
                          value={String(customCompareYear)} 
                          onValueChange={(v) => setCustomCompareYear(Number(v))}
                        >
                          <SelectTrigger className="h-8 text-xs w-[72px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select 
                          value={String(customCompareMonth)} 
                          onValueChange={(v) => setCustomCompareMonth(Number(v))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTH_NAMES_SHORT.map((m, i) => (
                              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Show empty state if no data for selected months */}
              {(currentRevenue === 0 && prevRevenue === 0 && currentExpenses === 0 && prevExpenses === 0) ? (
                <div className="py-8 text-center text-slate-500">
                  <ArrowLeftRight className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No data for the selected months</p>
                  <p className="text-xs text-slate-400 mt-1">Try selecting different months</p>
                </div>
              ) : (
                <PremiumComparisonCards
                  metrics={comparisonMetrics}
                  currentLabel={comparisonCurrentMonthLabel}
                  prevLabel={comparisonPrevMonthLabel}
                />
              )}
            </CardContent>
          </Card>

          {/* Department Growth */}
          <Card className="border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <div className="p-1.5 rounded-lg bg-purple-100">
                  <Building className="h-5 w-5 text-purple-600" />
                </div>
                Department Growth
              </CardTitle>
              <CardDescription>
                {comparisonCurrentMonthLabel} vs {comparisonPrevMonthLabel}
                {!isCustomComparison && (
                  <span className="ml-1 text-xs text-slate-400">(Last two complete months)</span>
                )}
                {isCustomComparison && (
                  <span className="ml-1 text-xs text-blue-500">(Selected months)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PremiumDepartmentGrowth
                departments={departmentGrowth}
                maxDisplay={MAX_DEPARTMENTS_DISPLAYED}
                compactSSP={compactSSP}
              />
            </CardContent>
          </Card>
        </div>

        {/* Premium Expenses Breakdown */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                    <Receipt className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Expenses Breakdown</CardTitle>
                    {aggregatedExpenses.periodLabel && (
                      <CardDescription>{aggregatedExpenses.periodLabel}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-xl">
                  <span className="text-sm text-slate-500">Total</span>
                  <span className="ml-2 text-lg font-bold text-slate-900">{compactSSP(aggregatedExpenses.total)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <PremiumExpenseBreakdown
                expenses={premiumExpenses}
                total={aggregatedExpenses.total}
                periodLabel={aggregatedExpenses.periodLabel}
              />
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
