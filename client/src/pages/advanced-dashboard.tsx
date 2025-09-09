// client/src/pages/advanced-dashboard.tsx
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
} from "lucide-react";

import { api } from "@/lib/queryClient";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";

// Global date filter (shared with Overview)
import { useDateFilter } from "@/context/date-filter-context";

// Drawer + Departments panel
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";

// ---------------- Helpers ----------------

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const kfmt = (v: number) =>
  v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v));

const fmtUSD = (v: number) =>
  Number.isInteger(v) ? nf0.format(v) : nf1.format(v);

// ---------------- Page ----------------

export default function AdvancedDashboard() {
  // 🔗 Global date state from provider
  const {
    timeRange,
    selectedYear,
    selectedMonth,
    customStartDate,
    customEndDate,
    setTimeRange,
    setCustomRange,
    periodLabel,
  } = useDateFilter();

  // Drawer state
  const [openExpenses, setOpenExpenses] = useState(false);

  const handleTimeRangeChange = (
    range: "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  ) => setTimeRange(range);

  // Dashboard summary
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  // Departments list
  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  // Daily income series
  const { data: rawIncome } = useQuery({
    queryKey: [
      "/api/income-trends",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/income-trends/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  // Build income series
  let incomeSeries: Array<{
    day: number;
    amount: number;
    amountSSP: number;
    amountUSD: number;
    label: string;
    fullDate: string;
  }> = [];
  let monthName = "";

  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    monthName = `${format(customStartDate, "MMM d, yyyy")} - ${format(
      customEndDate,
      "MMM d, yyyy"
    )}`;
    incomeSeries = rawIncome.map((r: any, index: number) => {
      const totalIncome = Number(r.income ?? r.amount ?? 0);
      return {
        day: index + 1,
        amount: totalIncome,
        amountUSD: Number(r.incomeUSD ?? 0),
        amountSSP: Number(r.incomeSSP ?? totalIncome),
        label: r.date,
        fullDate: r.date,
      };
    });
  } else {
    const displayYear = selectedYear;
    const displayMonth = selectedMonth;
    const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();
    monthName = new Date(displayYear, displayMonth - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: 0,
      amountUSD: 0,
      amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(displayYear, displayMonth - 1, i + 1).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      ),
    }));

    if (Array.isArray(rawIncome)) {
      for (const r of rawIncome as any[]) {
        let day = (r as any).day;
        if (!day && (r as any).dateISO) day = new Date((r as any).dateISO).getDate();
        if (!day && (r as any).date) day = new Date((r as any).date).getDate();
        if (day >= 1 && day <= daysInMonth) {
          incomeSeries[day - 1].amountUSD += Number((r as any).incomeUSD ?? 0);
          incomeSeries[day - 1].amountSSP += Number((r as any).incomeSSP ?? 0);
          incomeSeries[day - 1].amount += Number((r as any).income ?? (r as any).amount ?? 0);
        }
      }
    }
  }

  // Totals & chart metrics
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const daysWithSSP = incomeSeries.filter((d) => d.amountSSP > 0).length;
  const monthlyAvgSSP = daysWithSSP ? Math.round(monthTotalSSP / daysWithSSP) : 0;
  const peakSSP = Math.max(...incomeSeries.map((d) => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find((d) => d.amountSSP === peakSSP);
  const showAvgLine = daysWithSSP >= 2;
  const hasAnyUSD = incomeSeries.some((d) => d.amountUSD > 0);

  // Y axes formatting
  const formatYAxisSSP = (v: number) => kfmt(v);
  const formatYAxisUSD = (v: number) => kfmt(v);

  // X axis tick policy
  const formatXAxis = (tickItem: any, index: number) => {
    if (timeRange === "custom" && customStartDate && customEndDate) {
      const dayData = incomeSeries[index];
      if (!dayData) return "";
      const hasTransaction = dayData.amount > 0;
      if (hasTransaction) return dayData.label;
      return index % 7 === 0 ? dayData.label : "";
    } else {
      const day = parseInt(tickItem);
      const dayData = incomeSeries.find((d) => d.day === day);
      const hasTransaction = dayData && dayData.amount > 0;
      if (hasTransaction) return day.toString();
      const daysInCurrentMonth = incomeSeries.length;
      if (daysInCurrentMonth <= 28) return day.toString();
      return day === 1 || day === daysInCurrentMonth || day % 5 === 0 ? day.toString() : "";
    }
  };

  // Loading state
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

  // Summary numbers
  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || "0");
  const usdIncome = parseFloat(dashboardData?.totalIncomeUSD || "0");
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || "0");
  const sspRevenue = monthTotalSSP || sspIncome;
  const sspNetIncome = sspRevenue - totalExpenses;

  // Navigate Patient Volume month based on range
  const getPatientVolumeNavigation = () => {
    const currentDate = new Date();
    switch (timeRange) {
      case "current-month":
        return { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
      case "last-month": {
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        return { year: lastMonth.getFullYear(), month: lastMonth.getMonth() + 1 };
      }
      case "last-3-months": {
        const threeMonthsAgo = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 2
        );
        return { year: threeMonthsAgo.getFullYear(), month: threeMonthsAgo.getMonth() + 1 };
      }
      case "year":
        return { year: currentDate.getFullYear(), month: 1 };
      case "custom":
        return customStartDate
          ? { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 }
          : { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
      default:
        return { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
    }
  };

  // Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0]?.payload ?? {};
      const hasSSP = d.amountSSP > 0;
      const hasUSD = d.amountUSD > 0;
      const totalAmount = d.amount;
      const shareOfMonth =
        monthTotalSSP + monthTotalUSD > 0
          ? (totalAmount / (monthTotalSSP + monthTotalUSD)) * 100
          : 0;
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
          <p className="font-semibold text-slate-900 mb-2">{d.fullDate}</p>
          {hasSSP && (
            <p className="text-sm text-slate-700 font-mono">SSP {nf0.format(d.amountSSP)}</p>
          )}
          {hasUSD && (
            <p className="text-sm text-slate-700 font-mono">USD {fmtUSD(d.amountUSD)}</p>
          )}
          {totalAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Share of period: {nf1.format(shareOfMonth)}%
              </p>
            </div>
          )}
          {!hasSSP && !hasUSD && <p className="text-sm text-slate-500">No transactions</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 dashboard-content">
      {/* Header + date filters */}
      <header className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
              Executive Dashboard
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <p className="text-sm text-muted-foreground">Key financials · {periodLabel}</p>
            </div>
          </div>

          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: "rgb(255, 255, 255)" }}
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
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: "rgb(255, 255, 255)" }}
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
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {nf0.format(Math.round(sspRevenue))}
                </p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.incomeChangeSSP !== undefined && (
                    <span
                      className={`text-xs font-medium ${
                        dashboardData.changes.incomeChangeSSP > 0
                          ? "text-emerald-600"
                          : dashboardData.changes.incomeChangeSSP < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {dashboardData.changes.incomeChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.incomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.incomeChangeSSP !== undefined &&
                dashboardData.changes.incomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses (clickable) */}
        <Card
          className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setOpenExpenses(true)}
          title="Click to view expense breakdown"
        >
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {nf0.format(Math.round(totalExpenses))}
                </p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.expenseChangeSSP !== undefined && (
                    <span
                      className={`text-xs font-medium ${
                        dashboardData.changes.expenseChangeSSP > 0
                          ? "text-red-600"
                          : dashboardData.changes.expenseChangeSSP < 0
                          ? "text-emerald-600"
                          : "text-slate-500"
                      }`}
                    >
                      {dashboardData.changes.expenseChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.expenseChangeSSP !== undefined &&
                dashboardData.changes.expenseChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                )}
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
                  SSP {nf0.format(Math.round(sspNetIncome))}
                </p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.netIncomeChangeSSP !== undefined && (
                    <span
                      className={`text-xs font-medium ${
                        dashboardData.changes.netIncomeChangeSSP > 0
                          ? "text-emerald-600"
                          : dashboardData.changes.netIncomeChangeSSP < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {dashboardData.changes.netIncomeChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.netIncomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue (USD) */}
        <Link
          href={`/insurance-providers?range=${timeRange}${
            timeRange === "custom" && customStartDate && customEndDate
              ? `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
                  customEndDate,
                  "yyyy-MM-dd"
                )}`
              : ""
          }`}
        >
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    USD {fmtUSD(Math.round(usdIncome))}
                  </p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.incomeChangeUSD !== undefined ? (
                      <span
                        className={`text-xs font-medium ${
                          dashboardData.changes.incomeChangeUSD > 0
                            ? "text-emerald-600"
                            : dashboardData.changes.incomeChangeUSD < 0
                            ? "text-red-600"
                            : "text-slate-500"
                        }`}
                      >
                        {dashboardData.changes.incomeChangeUSD > 0 ? "+" : ""}
                        {dashboardData.changes.incomeChangeUSD.toFixed(1)}% vs last month
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-purple-600">
                        {Object.keys(dashboardData?.insuranceBreakdown || {}).length === 1
                          ? "1 provider"
                          : `${Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-1.5 rounded-lg">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Patient Volume */}
        <Link
          href={`/patient-volume?view=monthly&year=${getPatientVolumeNavigation().year}&month=${
            getPatientVolumeNavigation().month
          }&range=${timeRange}`}
        >
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Total Patients</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    {(dashboardData?.totalPatients || 0).toLocaleString()}
                  </p>
                  <div className="flex items-center mt-1">
                    <span className="text-xs font-medium text-teal-600">Current period</span>
                  </div>
                </div>
                <div className="bg-teal-50 p-1.5 rounded-lg">
                  <Users className="h-4 w-4 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Analytics */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900">
                Revenue Analytics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {monthTotalSSP > 0 || monthTotalUSD > 0 ? (
              <div className="space-y-0">
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <BarChart
                      data={incomeSeries}
                      margin={{ top: 12, right: hasAnyUSD ? 60 : 20, left: 8, bottom: 22 }}
                      barGap={6}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid
                        strokeDasharray="1 1"
                        stroke="#f1f5f9"
                        strokeWidth={0.3}
                        opacity={0.3}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={formatXAxis}
                        interval={0}
                        height={32}
                      />
                      {/* Left Y axis (SSP) */}
                      <YAxis
                        yAxisId="ssp"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#0f766e" }}
                        tickFormatter={formatYAxisSSP}
                        domain={[0, Math.max(peakSSP * 1.2, 100000)]}
                        label={{
                          value: "Revenue (SSP)",
                          angle: -90,
                          position: "insideLeft",
                          offset: 8,
                          style: { fill: "#0f766e", fontSize: 11 },
                        }}
                      />
                      {/* Right Y axis (USD) */}
                      <YAxis
                        yAxisId="usd"
                        hide={!hasAnyUSD}
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#1d4ed8" }}
                        tickFormatter={formatYAxisUSD}
                        label={{
                          value: "Revenue (USD)",
                          angle: 90,
                          position: "insideRight",
                          offset: 8,
                          style: { fill: "#1d4ed8", fontSize: 11 },
                        }}
                      />

                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="rect"
                        wrapperStyle={{ fontSize: "12px" }}
                      />

                      {/* Average line (SSP only) */}
                      {showAvgLine && monthlyAvgSSP > 0 && (
                        <ReferenceLine
                          yAxisId="ssp"
                          y={monthlyAvgSSP}
                          stroke="#0d9488"
                          strokeWidth={1}
                          strokeDasharray="4 2"
                          label={{
                            value: `Avg (SSP) ${kfmt(monthlyAvgSSP)}`,
                            position: "insideTopRight",
                            style: { fontSize: 10, fill: "#0d9488", fontWeight: 500 },
                            offset: 6,
                          }}
                        />
                      )}

                      {/* SSP (left axis) */}
                      <Bar
                        yAxisId="ssp"
                        dataKey="amountSSP"
                        name="SSP"
                        fill="#14b8a6"
                        maxBarSize={26}
                        radius={[4, 4, 0, 0]}
                      />

                      {/* USD (right axis) — render only if any USD exists */}
                      {hasAnyUSD && (
                        <Bar
                          yAxisId="usd"
                          dataKey="amountUSD"
                          name="USD"
                          fill="#0ea5e9"
                          maxBarSize={26}
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Totals below chart */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">
                        Total
                      </span>
                      <div className="space-y-1">
                        {monthTotalSSP > 0 && (
                          <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">
                            SSP {nf0.format(monthTotalSSP)}
                          </span>
                        )}
                        {monthTotalUSD > 0 && (
                          <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">
                            USD {fmtUSD(monthTotalUSD)}
                          </span>
                        )}
                        {monthTotalSSP === 0 && monthTotalUSD === 0 && (
                          <span className="text-sm text-slate-500">
                            No revenue in this range
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">
                        Peak Day
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          SSP {nf0.format(peakSSP)}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5"
                        >
                          Peak
                        </Badge>
                      </div>
                      {peakDaySSP && (
                        <span className="text-xs text-slate-500 mt-1">{peakDaySSP.fullDate}</span>
                      )}
                    </div>

                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">
                        Monthly Avg
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          SSP {nf0.format(monthlyAvgSSP)}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5"
                        >
                          Avg
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3" />
                  <p className="text-slate-600 text-sm font-medium">No revenue in this range</p>
                  <p className="text-slate-500 text-xs mt-1">Try selecting a different period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Departments Panel (new) */}
        <DepartmentsPanel
          departments={Array.isArray(departments) ? (departments as any[]) : []}
          departmentBreakdown={dashboardData?.departmentBreakdown}
          totalSSP={sspRevenue}
        />
      </div>

      {/* Quick Actions / System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="/transactions" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Add Transaction</span>
                    <span className="text-xs text-slate-500">Record new income or expense</span>
                  </div>
                </Button>
              </a>
              <a href="/patient-volume" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Patient Volume</span>
                    <span className="text-xs text-slate-500">Update patient count</span>
                  </div>
                </Button>
              </a>
              <a href="/reports" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Monthly Reports</span>
                    <span className="text-xs text-slate-500">View generated reports</span>
                  </div>
                </Button>
              </a>
              <a href="/users" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">User Management</span>
                    <span className="text-xs text-slate-500">Manage user accounts</span>
                  </div>
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              System Status
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
                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Active Users</span>
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
  );
}
