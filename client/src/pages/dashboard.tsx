/**
 * Trends & Comparisons Page
 * 
 * Provides historical analysis and comparative insights:
 * - 12-month Revenue Trend chart
 * - Month vs Month comparison
 * - Department Growth rates
 * - Enhanced Expenses Breakdown
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function compactSSP(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `SSP ${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `SSP ${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `SSP ${nf0.format(Math.round(n / 1_000))}k`;
  return `SSP ${nf0.format(Math.round(n))}`;
}

type YearOption = "this-year" | "last-year";

// Department icon mapping
const departmentIcons: Record<string, { icon: React.ComponentType<any>; bgColor: string; iconColor: string }> = {
  "Lab": { icon: FlaskConical, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  "Ultrasound": { icon: ScanLine, bgColor: "bg-purple-100", iconColor: "text-purple-600" },
  "X-Ray": { icon: ScanLine, bgColor: "bg-amber-100", iconColor: "text-amber-600" },
  "Pharmacy": { icon: Pill, bgColor: "bg-green-100", iconColor: "text-green-600" },
  "Consultation": { icon: Stethoscope, bgColor: "bg-teal-100", iconColor: "text-teal-600" },
  "Lab Tests": { icon: TestTubes, bgColor: "bg-indigo-100", iconColor: "text-indigo-600" },
};

function getDepartmentStyle(name: string) {
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
  const [selectedYear, setSelectedYear] = useState<YearOption>("this-year");
  
  const thisYear = now.getFullYear();
  const displayYear = selectedYear === "this-year" ? thisYear : thisYear - 1;
  const currentMonth = now.getMonth() + 1;

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

  // Fetch 12-month revenue trend data
  const { data: monthlyTrend = [], isLoading: loadingTrend } = useQuery({
    queryKey: ["/api/trends/monthly-revenue", displayYear],
    queryFn: async () => {
      // Fetch last 12 months of data
      const months: Array<{ month: string; revenue: number; fullMonth: string }> = [];
      const startDate = subMonths(new Date(displayYear, currentMonth - 1, 1), 11);
      
      for (let i = 0; i < 12; i++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        try {
          const url = `/api/dashboard?year=${year}&month=${month}&range=current-month`;
          const { data } = await api.get(url);
          months.push({
            month: format(date, "MMM"),
            fullMonth: format(date, "MMMM yyyy"),
            revenue: parseFloat(data?.totalIncomeSSP || "0"),
          });
        } catch {
          months.push({
            month: format(date, "MMM"),
            fullMonth: format(date, "MMMM yyyy"),
            revenue: 0,
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
  const departmentGrowth = useMemo(() => {
    const currentBreakdown = currentMonthData?.departmentBreakdown || {};
    const prevBreakdown = prevMonthData?.departmentBreakdown || {};
    
    const deptArray = Array.isArray(departments) ? departments : [];
    
    return deptArray.map((dept: any) => {
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
    }).filter((d: any) => d.currentValue > 0 || d.prevValue > 0)
      .sort((a: any, b: any) => b.growth - a.growth);
  }, [currentMonthData, prevMonthData, departments]);

  // Calculate trend stats
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

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
        <div className="text-sm font-semibold text-slate-900">{data.fullMonth}</div>
        <div className="text-sm font-mono tabular-nums text-teal-600">{compactSSP(data.revenue)}</div>
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
          
          <Select value={selectedYear} onValueChange={(v: YearOption) => setSelectedYear(v)}>
            <SelectTrigger className="h-10 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* 12-Month Revenue Trend Chart */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <div className="p-1.5 rounded-lg bg-teal-100">
                <TrendingUp className="h-5 w-5 text-teal-600" />
              </div>
              Revenue Trend
            </CardTitle>
            <CardDescription>12-month revenue performance</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
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
                      <Tooltip content={<CustomTooltip />} />
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
                
                {/* Summary stats below chart */}
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
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                No revenue data available for the selected period.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month vs Month and Department Growth Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Month vs Month Comparison */}
          <Card className="border border-slate-200 shadow-sm">
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
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-green-600" />
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
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-red-600" />
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
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-blue-600" />
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
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
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
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <div className="p-1.5 rounded-lg bg-purple-100">
                  <Building className="h-5 w-5 text-purple-600" />
                </div>
                Department Growth
              </CardTitle>
              <CardDescription>Performance change vs last month</CardDescription>
            </CardHeader>
            <CardContent>
              {departmentGrowth.length > 0 ? (
                <div className="space-y-3">
                  {departmentGrowth.slice(0, 6).map((dept: any) => {
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
                              style={{ width: `${Math.min(Math.abs(dept.growth) * 2, 100)}%` }}
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
