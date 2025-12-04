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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";
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
} from "lucide-react";
import { api } from "@/lib/queryClient";
import SimpleExpenseBreakdown from "@/components/dashboard/simple-expense-breakdown";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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

// Filter options for time period selection
type FilterOption = 'last-month' | 'last-quarter' | 'last-6-months' | 'last-12-months' | 'this-year' | 'last-year';

const filterOptions: Array<{ value: FilterOption; label: string }> = [
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'last-12-months', label: 'Last 12 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
];

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
  const currentCalendarMonth = now.getMonth() + 1;

  // Determine the last complete month (not the current partial month)
  // If we're in December 2025 and it's only day 4, use November as "last complete"
  const lastCompleteMonthDate = subMonths(new Date(thisYear, currentCalendarMonth - 1, 1), 1);
  const lastCompleteYear = lastCompleteMonthDate.getFullYear();
  const lastCompleteMonth = lastCompleteMonthDate.getMonth() + 1;

  // Calculate date range based on selected filter
  const { startDate: filterStartDate, endDate: filterEndDate, monthsCount } = useMemo(() => {
    // End date for trend chart - use last complete month, not current partial month
    const end = lastCompleteMonthDate;
    let start: Date;
    let months: number;
    
    switch (selectedFilter) {
      case 'last-month':
        start = lastCompleteMonthDate;
        months = 1;
        break;
      case 'last-quarter':
        start = subMonths(lastCompleteMonthDate, 2); // 3 months including end month
        months = 3;
        break;
      case 'last-6-months':
        start = subMonths(lastCompleteMonthDate, 5); // 6 months including end month
        months = 6;
        break;
      case 'last-12-months':
        start = subMonths(lastCompleteMonthDate, 11); // 12 months including end month
        months = 12;
        break;
      case 'this-year':
        start = new Date(thisYear, 0, 1);
        months = lastCompleteMonth;
        break;
      case 'last-year':
        start = new Date(thisYear - 1, 0, 1);
        months = 12;
        break;
      default:
        start = subMonths(lastCompleteMonthDate, 11);
        months = 12;
    }
    
    return { 
      startDate: start,
      endDate: end,
      monthsCount: months 
    };
  }, [selectedFilter, thisYear, lastCompleteMonth, lastCompleteMonthDate]);

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
      const startDateStr = format(filterStartDate, "yyyy-MM-dd");
      const endDateStr = format(filterEndDate, "yyyy-MM-dd");
      
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
        // Normalize category names - merge "Other", "Others", "other", "others" into "Other expenses"
        const normalizedCategory = category.toLowerCase().trim();
        let finalCategory = category;
        if (normalizedCategory === 'other' || normalizedCategory === 'others') {
          finalCategory = 'Other expenses';
        }
        combined[finalCategory] = (combined[finalCategory] || 0) + numAmount;
      }
    }
    
    // Determine period label based on filter with clearer wording
    let periodLabel: string;
    const firstMonth = monthlyTrend[0]?.fullMonth || '';
    const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.fullMonth || '';
    
    switch (selectedFilter) {
      case 'last-month':
        periodLabel = lastMonth;
        break;
      case 'last-quarter':
        periodLabel = `${firstMonth} – ${lastMonth} (Last quarter)`;
        break;
      case 'last-6-months':
        periodLabel = `${firstMonth} – ${lastMonth} (Last 6 complete months)`;
        break;
      case 'last-12-months':
        periodLabel = `${firstMonth} – ${lastMonth} (Last 12 complete months)`;
        break;
      case 'this-year':
        periodLabel = `${firstMonth} – ${lastMonth} (Year to date – last complete month)`;
        break;
      case 'last-year':
        periodLabel = `${firstMonth} – ${lastMonth} (Full year ${thisYear - 1})`;
        break;
      default:
        periodLabel = `${firstMonth} – ${lastMonth}`;
    }
    
    return {
      breakdown: combined,
      total: totalExpensesSum,
      periodLabel,
    };
  }, [monthlyTrend, currentMonthData, currentExpenses, selectedFilter, comparisonCurrentMonthLabel, thisYear]);

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

  // Calculate insights data with improved logic
  const insights = useMemo(() => {
    if (monthlyTrend.length === 0) return null;
    
    const yoyGrowth = trendStats.yoyGrowth;
    const bestMonth = trendStats.bestMonth;
    
    // Format growth values with proper sign
    const formatGrowth = (value: number) => {
      const formatted = Math.abs(value).toFixed(0);
      return value >= 0 ? `+${formatted}` : `-${formatted}`;
    };
    
    // Find departments with positive growth or that are new
    const newDepartments = departmentGrowth.filter(d => d.isNewDepartment);
    const deptWithPositiveGrowth = departmentGrowth.filter(d => d.growth > 0 && !d.isNewDepartment);
    
    // Priority: new departments first, then positive growth, then smallest decline
    const topDepartment = newDepartments.length > 0 
      ? newDepartments[0]
      : deptWithPositiveGrowth.length > 0 
        ? deptWithPositiveGrowth[0] 
        : departmentGrowth[0];
    
    // Check if all departments have negative growth (excluding new ones)
    const nonNewDepts = departmentGrowth.filter(d => !d.isNewDepartment);
    const allDepartmentsNegative = nonNewDepts.length > 0 && nonNewDepts.every(d => d.growth < 0);
    const hasAnyDepartmentData = departmentGrowth.length > 0;
    
    // Build revenue part of the insight
    const revenueDirection = yoyGrowth >= 0 ? 'grew' : 'declined';
    const revenueMessage = `Revenue ${revenueDirection} ${formatGrowth(yoyGrowth)}% over this period`;
    
    // Build department part of the insight
    let departmentMessage = '';
    if (!hasAnyDepartmentData) {
      departmentMessage = '';
    } else if (newDepartments.length > 0) {
      // Highlight new departments
      if (newDepartments.length === 1) {
        departmentMessage = `. ${newDepartments[0].name} is new this period`;
      } else {
        departmentMessage = `. ${newDepartments.length} departments are new this period`;
      }
    } else if (allDepartmentsNegative) {
      departmentMessage = `, with ${topDepartment?.name} showing the smallest decline at ${formatGrowth(topDepartment?.growth || 0)}%`;
    } else if (topDepartment && topDepartment.growth > 0) {
      departmentMessage = `, with ${topDepartment?.name} leading at ${formatGrowth(topDepartment?.growth || 0)}% growth`;
    } else if (topDepartment && topDepartment.growth === 0) {
      departmentMessage = `, with ${topDepartment?.name} remaining stable`;
    }
    
    // Build best month part of the insight
    const bestMonthMessage = bestMonth ? ` ${bestMonth} was your best performing month.` : '';
    
    // Combine into full message
    const fullMessage = `Key Insight: ${revenueMessage}${departmentMessage}.${bestMonthMessage}`;
    
    return {
      fullMessage,
      yoyGrowth: formatGrowth(yoyGrowth),
      yoyGrowthPositive: yoyGrowth >= 0,
      topDepartment: topDepartment?.name || 'N/A',
      topDepartmentGrowth: topDepartment?.isNewDepartment ? 'New' : formatGrowth(topDepartment?.growth || 0),
      topDepartmentGrowthPositive: (topDepartment?.growth || 0) >= 0 || topDepartment?.isNewDepartment,
      allDepartmentsNegative,
      departmentInsight: departmentMessage,
      bestMonth,
      hasNewDepartments: newDepartments.length > 0,
    };
  }, [monthlyTrend, departmentGrowth, trendStats]);

  // Compute clear period description for the trend chart
  const trendPeriodDescription = useMemo(() => {
    if (monthlyTrend.length === 0) return "No data available";
    
    const firstMonth = monthlyTrend[0]?.fullMonth || '';
    const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.fullMonth || '';
    
    if (firstMonth === lastMonth) {
      return firstMonth;
    }
    
    // Get filter-specific description with clearer wording
    switch (selectedFilter) {
      case 'last-month':
        return lastMonth;
      case 'last-quarter':
        return `${firstMonth} – ${lastMonth} (Last quarter)`;
      case 'last-6-months':
        return `${firstMonth} – ${lastMonth} (Last 6 complete months)`;
      case 'last-12-months':
        return `${firstMonth} – ${lastMonth} (Last 12 complete months)`;
      case 'this-year':
        return `${firstMonth} – ${lastMonth} (Year to date – last complete month)`;
      case 'last-year':
        return `${firstMonth} – ${lastMonth} (Full year ${thisYear - 1})`;
      default:
        return `${firstMonth} – ${lastMonth}`;
    }
  }, [monthlyTrend, selectedFilter, thisYear]);

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
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold leading-tight text-slate-900">
              Trends & Comparisons
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Analyze performance trends and compare across periods
            </p>
          </div>
          
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
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Insights Card */}
        {insights && (
          <Card className="bg-gradient-to-r from-teal-500 to-blue-500 text-white border-0 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">
                  {insights.fullMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Revenue Trend Chart with Tabs */}
        <Card className="border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
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
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <>
                {currencyTab === "ssp" ? (
                  <>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => {
                              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                              return v.toString();
                            }}
                          />
                          <Tooltip content={<CustomTooltipSSP />} />
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#14b8a6" 
                            strokeWidth={2}
                            fill="url(#revenueGradient)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* SSP Summary stats below chart */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn("h-4 w-4", trendStats.yoyGrowth >= 0 ? "text-green-500" : "text-red-500")} />
                        <span className="text-sm text-slate-600">YoY Growth:</span>
                        <span className={cn("font-semibold", trendStats.yoyGrowth >= 0 ? "text-green-600" : "text-red-600")}>
                          {trendStats.yoyGrowth >= 0 ? "+" : ""}{trendStats.yoyGrowth.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-slate-600">Best Month:</span>
                        <span className="font-semibold text-slate-900">{trendStats.bestMonth}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-slate-600">Monthly Avg:</span>
                        <span className="font-semibold text-slate-900">{compactSSP(trendStats.monthlyAvg)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="usdGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => {
                              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                              return v.toString();
                            }}
                          />
                          <Tooltip content={<CustomTooltipUSD />} />
                          <Area 
                            type="monotone" 
                            dataKey="revenueUSD" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            fill="url(#usdGradient)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* USD Summary stats below chart */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn("h-4 w-4", trendStatsUSD.yoyGrowth >= 0 ? "text-green-500" : "text-red-500")} />
                        <span className="text-sm text-slate-600">YoY Growth:</span>
                        <span className={cn("font-semibold", trendStatsUSD.yoyGrowth >= 0 ? "text-green-600" : "text-red-600")}>
                          {trendStatsUSD.yoyGrowth >= 0 ? "+" : ""}{trendStatsUSD.yoyGrowth.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-slate-600">Best Month:</span>
                        <span className="font-semibold text-slate-900">{trendStatsUSD.bestMonth}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-slate-600">Monthly Avg:</span>
                        <span className="font-semibold text-slate-900">{compactUSD(trendStatsUSD.monthlyAvg)}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                No revenue data available for the selected period.
              </div>
            )}
          </CardContent>
        </Card>

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
              <div className="space-y-3">
                {/* Revenue comparison */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Revenue</div>
                      <div className="font-semibold text-slate-900">{compactSSP(currentRevenue)}</div>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1", revenueChange >= 0 ? "text-green-600" : "text-red-600")}>
                    {revenueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-semibold">{revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}%</span>
                  </div>
                </div>
                
                {/* Expenses comparison */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Expenses</div>
                      <div className="font-semibold text-slate-900">{compactSSP(currentExpenses)}</div>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1", expensesChange <= 0 ? "text-green-600" : "text-red-600")}>
                    {expensesChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-semibold">{expensesChange >= 0 ? "+" : ""}{expensesChange.toFixed(1)}%</span>
                  </div>
                </div>
                
                {/* Net Income comparison */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Wallet className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Net Income</div>
                      <div className="font-semibold text-slate-900">{compactSSP(currentNetIncome)}</div>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1", netIncomeChange >= 0 ? "text-green-600" : "text-red-600")}>
                    {netIncomeChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-semibold">{netIncomeChange >= 0 ? "+" : ""}{netIncomeChange.toFixed(1)}%</span>
                  </div>
                </div>
                
                {/* Patients comparison */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">Patients</div>
                      <div className="font-semibold text-slate-900">{nf0.format(currentPatients)}</div>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1", patientsChange >= 0 ? "text-green-600" : "text-red-600")}>
                    {patientsChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-semibold">{patientsChange >= 0 ? "+" : ""}{patientsChange.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
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
              {departmentGrowth.length > 0 ? (
                <div className="space-y-3">
                  {departmentGrowth.slice(0, MAX_DEPARTMENTS_DISPLAYED).map((dept) => {
                    const Icon = dept.icon;
                    return (
                      <div key={dept.id} className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", dept.bgColor)}>
                          <Icon className={cn("h-4 w-4", dept.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">{dept.name}</span>
                            {/* Show "New this month" for departments that started this period */}
                            {dept.isNewDepartment ? (
                              <span className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                New
                              </span>
                            ) : (
                              <span className={cn("text-sm font-semibold flex items-center gap-1", dept.growth >= 0 ? "text-green-600" : "text-red-600")}>
                                {dept.growth >= 0 ? "+" : ""}{dept.growth.toFixed(1)}%
                                {dept.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                          {/* Show progress bar or new department indicator */}
                          {dept.isNewDepartment ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono">SSP 0 → {compactSSP(dept.currentValue)}</span>
                            </div>
                          ) : (
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full transition-all duration-500", dept.growth >= 0 ? "bg-green-500" : "bg-red-500")}
                                style={{ width: `${Math.min(Math.abs(dept.growth) * GROWTH_SCALE_FACTOR, MAX_GROWTH_BAR_WIDTH)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                  No department data available for comparison.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expenses Breakdown - Uses aggregated data based on filter */}
        <SimpleExpenseBreakdown
          breakdown={aggregatedExpenses.breakdown}
          total={aggregatedExpenses.total}
          title="Expenses Breakdown"
          periodLabel={aggregatedExpenses.periodLabel}
        />
      </main>
    </div>
  );
}
