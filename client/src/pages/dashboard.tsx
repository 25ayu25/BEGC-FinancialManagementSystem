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
import { format, subMonths, subQuarters } from "date-fns";
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

export default function Dashboard() {
  const now = new Date();
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("last-12-months");
  const [currencyTab, setCurrencyTab] = useState<"ssp" | "usd">("ssp");
  
  const thisYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Calculate date range based on selected filter
  const { startDate: filterStartDate, monthsCount } = useMemo(() => {
    const end = new Date(thisYear, currentMonth - 1, 1);
    let start: Date;
    let months: number;
    
    switch (selectedFilter) {
      case 'last-month':
        start = subMonths(end, 1);
        months = 1;
        break;
      case 'last-quarter':
        start = subQuarters(end, 1);
        months = 3;
        break;
      case 'last-6-months':
        start = subMonths(end, 6);
        months = 6;
        break;
      case 'last-12-months':
        start = subMonths(end, 12);
        months = 12;
        break;
      case 'this-year':
        start = new Date(thisYear, 0, 1);
        months = currentMonth;
        break;
      case 'last-year':
        start = new Date(thisYear - 1, 0, 1);
        months = 12;
        break;
      default:
        start = subMonths(end, 12);
        months = 12;
    }
    
    return { 
      startDate: start, 
      monthsCount: months 
    };
  }, [selectedFilter, thisYear, currentMonth]);

  // Display year for the selected filter
  const displayYear = selectedFilter === 'last-year' ? thisYear - 1 : thisYear;

  // Fetch dashboard data for current month (for Month vs Month comparison)
  const { data: currentMonthData, isLoading: loadingCurrent } = useQuery({
    queryKey: ["/api/dashboard", displayYear, currentMonth, "current-month"],
    queryFn: async () => {
      const url = `/api/dashboard?year=${displayYear}&month=${currentMonth}&range=current-month`;
      const { data } = await api.get(url);
      return data;
    },
  });

  // Fetch dashboard data for previous month
  const prevMonthDate = subMonths(new Date(displayYear, currentMonth - 1, 1), 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;

  const { data: prevMonthData, isLoading: loadingPrev } = useQuery({
    queryKey: ["/api/dashboard", prevYear, prevMonth, "current-month", "prev"],
    queryFn: async () => {
      const url = `/api/dashboard?year=${prevYear}&month=${prevMonth}&range=current-month`;
      const { data } = await api.get(url);
      return data;
    },
  });

  // Fetch revenue trend data based on filter
  const { data: monthlyTrend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["/api/trends/monthly-revenue", selectedFilter, displayYear],
    queryFn: async () => {
      // Fetch months based on filter
      const months: Array<{ month: string; revenue: number; revenueUSD: number; fullMonth: string }> = [];
      
      for (let i = 0; i < monthsCount; i++) {
        const date = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        try {
          const url = `/api/dashboard?year=${year}&month=${month}&range=current-month`;
          const { data } = await api.get(url);
          months.push({
            month: format(date, "MMM"),
            fullMonth: format(date, "MMMM yyyy"),
            revenue: parseFloat(data?.totalIncomeSSP || "0"),
            revenueUSD: parseFloat(data?.totalIncomeUSD || "0"),
          });
        } catch {
          months.push({
            month: format(date, "MMM"),
            fullMonth: format(date, "MMMM yyyy"),
            revenue: 0,
            revenueUSD: 0,
          });
        }
      }
      
      return months;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch patient volume for current and previous month
  const { data: currentPatients = 0 } = useQuery({
    queryKey: ["/api/patient-volume/period", displayYear, currentMonth],
    queryFn: async () => {
      try {
        const url = `/api/patient-volume/period/${displayYear}/${currentMonth}?range=current-month`;
        const { data } = await api.get(url);
        return Array.isArray(data) ? data.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0) : 0;
      } catch {
        return 0;
      }
    },
  });

  const { data: prevPatients = 0 } = useQuery({
    queryKey: ["/api/patient-volume/period", prevYear, prevMonth, "prev"],
    queryFn: async () => {
      try {
        const url = `/api/patient-volume/period/${prevYear}/${prevMonth}?range=current-month`;
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

  // Calculate department growth
  const departmentGrowth = useMemo((): DepartmentGrowthItem[] => {
    const currentBreakdown = currentMonthData?.departmentBreakdown || {};
    const prevBreakdown = prevMonthData?.departmentBreakdown || {};
    
    const deptArray: Department[] = Array.isArray(departments) ? departments : [];
    
    return deptArray.map((dept: Department) => {
      const currentVal = parseFloat(currentBreakdown[dept.id] || currentBreakdown[dept.name] || "0");
      const prevVal = parseFloat(prevBreakdown[dept.id] || prevBreakdown[dept.name] || "0");
      const growth = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : (currentVal > 0 ? 100 : 0);
      const style = getDepartmentStyle(dept.name);
      
      return {
        id: dept.id,
        name: dept.name,
        currentValue: currentVal,
        prevValue: prevVal,
        growth,
        ...style,
      };
    }).filter((d) => d.currentValue > 0 || d.prevValue > 0)
      .sort((a, b) => b.growth - a.growth);
  }, [currentMonthData, prevMonthData, departments]);

  // Calculate trend stats for SSP
  const trendStats = useMemo(() => {
    if (monthlyTrend.length === 0) return { yoyGrowth: 0, bestMonth: "", monthlyAvg: 0 };
    
    const total = monthlyTrend.reduce((sum, m) => sum + m.revenue, 0);
    const avg = total / monthlyTrend.length;
    const best = monthlyTrend.reduce((max, m) => m.revenue > max.revenue ? m : max, monthlyTrend[0]);
    
    // YoY growth: compare last month to same month last year (if available in trend)
    const currentMonthRev = monthlyTrend[monthlyTrend.length - 1]?.revenue || 0;
    const sameMonthLastYear = monthlyTrend[0]?.revenue || 0;
    const yoyGrowth = sameMonthLastYear > 0 ? ((currentMonthRev - sameMonthLastYear) / sameMonthLastYear) * 100 : 0;
    
    return {
      yoyGrowth,
      bestMonth: best?.month || "",
      monthlyAvg: avg,
    };
  }, [monthlyTrend]);

  // Calculate trend stats for USD
  const trendStatsUSD = useMemo(() => {
    if (monthlyTrend.length === 0) return { yoyGrowth: 0, bestMonth: "", monthlyAvg: 0 };
    
    const total = monthlyTrend.reduce((sum, m) => sum + m.revenueUSD, 0);
    const avg = total / monthlyTrend.length;
    const best = monthlyTrend.reduce((max, m) => m.revenueUSD > max.revenueUSD ? m : max, monthlyTrend[0]);
    
    // YoY growth: compare last month to same month last year (if available in trend)
    const currentMonthRev = monthlyTrend[monthlyTrend.length - 1]?.revenueUSD || 0;
    const sameMonthLastYear = monthlyTrend[0]?.revenueUSD || 0;
    const yoyGrowth = sameMonthLastYear > 0 ? ((currentMonthRev - sameMonthLastYear) / sameMonthLastYear) * 100 : 0;
    
    return {
      yoyGrowth,
      bestMonth: best?.month || "",
      monthlyAvg: avg,
    };
  }, [monthlyTrend]);

  // Calculate insights data
  const insights = useMemo(() => {
    if (monthlyTrend.length === 0 || departmentGrowth.length === 0) return null;
    
    const yoyGrowth = trendStats.yoyGrowth;
    const topDepartment = departmentGrowth[0];
    const bestMonth = trendStats.bestMonth;
    
    // Format growth values with proper sign
    const formatGrowth = (value: number) => {
      const formatted = Math.abs(value).toFixed(0);
      return value >= 0 ? `+${formatted}` : `-${formatted}`;
    };
    
    return {
      yoyGrowth: formatGrowth(yoyGrowth),
      yoyGrowthPositive: yoyGrowth >= 0,
      topDepartment: topDepartment?.name || 'N/A',
      topDepartmentGrowth: formatGrowth(topDepartment?.growth || 0),
      topDepartmentGrowthPositive: (topDepartment?.growth || 0) >= 0,
      bestMonth,
    };
  }, [monthlyTrend, departmentGrowth, trendStats]);

  const isLoading = loadingCurrent || loadingPrev || loadingTrend;

  const currentMonthLabel = format(new Date(displayYear, currentMonth - 1, 1), "MMMM yyyy");
  const prevMonthLabel = format(prevMonthDate, "MMMM yyyy");

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
                  Key Insight: Revenue {insights.yoyGrowthPositive ? 'grew' : 'declined'} {insights.yoyGrowth}% over this period, with {insights.topDepartment} department 
                  leading at {insights.topDepartmentGrowth}% growth. {insights.bestMonth} was your best performing month.
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
                <CardDescription>{monthsCount}-month revenue performance</CardDescription>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <div className="p-1.5 rounded-lg bg-blue-100">
                  <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                </div>
                Month vs Month
              </CardTitle>
              <CardDescription>{currentMonthLabel} compared to {prevMonthLabel}</CardDescription>
            </CardHeader>
            <CardContent>
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
              <CardDescription>Performance change vs last month (sorted by growth)</CardDescription>
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
                            <span className={cn("text-sm font-semibold flex items-center gap-1", dept.growth >= 0 ? "text-green-600" : "text-red-600")}>
                              {dept.growth >= 0 ? "+" : ""}{dept.growth.toFixed(1)}%
                              {dept.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-500", dept.growth >= 0 ? "bg-green-500" : "bg-red-500")}
                              style={{ width: `${Math.min(Math.abs(dept.growth) * GROWTH_SCALE_FACTOR, MAX_GROWTH_BAR_WIDTH)}%` }}
                            />
                          </div>
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

        {/* Expenses Breakdown - Enhanced */}
        <SimpleExpenseBreakdown
          breakdown={(currentMonthData as any)?.expenseBreakdown}
          total={currentExpenses}
          title="Expenses Breakdown"
          periodLabel={currentMonthLabel}
        />
      </main>
    </div>
  );
}
