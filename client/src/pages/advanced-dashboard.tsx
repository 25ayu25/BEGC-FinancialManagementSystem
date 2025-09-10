// client/src/pages/advanced-dashboard.tsx
import { useState, useMemo } from "react";
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

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

import { useDateFilter } from "@/context/date-filter-context";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";

// ---------- number formatting helpers ----------
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

export default function AdvancedDashboard() {
  const {
    timeRange, selectedYear, selectedMonth,
    customStartDate, customEndDate,
    setTimeRange, setCustomRange, periodLabel,
  } = useDateFilter();

  const [openExpenses, setOpenExpenses] = useState(false);

  const handleTimeRangeChange = (
    range: "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  ) => setTimeRange(range);

  // Dashboard data
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  const { data: rawIncome } = useQuery({
    queryKey: ["/api/income-trends", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/income-trends/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  // ---------- build income series ----------
  let incomeSeries: Array<{
    day: number; amount: number; amountSSP: number; amountUSD: number; label: string; fullDate: string;
  }> = [];
  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    incomeSeries = rawIncome.map((r: any, i: number) => ({
      day: i + 1,
      amount: Number(r.income ?? r.amount ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSP: Number(r.incomeSSP ?? 0),
      label: `Day ${i + 1}`,
      fullDate: r.dateLabel || "",
    }));
  } else if (Array.isArray(rawIncome)) {
    incomeSeries = rawIncome.map((r: any) => ({
      day: Number(r.day),
      amount: Number(r.income ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSP: Number(r.incomeSSP ?? 0),
      label: String(r.day),
      fullDate: r.dateLabel || "",
    }));
  }

  const hasAnyUSD = incomeSeries.some((d) => d.amountUSD > 0);
  const sspIncome = incomeSeries.reduce((a, b) => a + (b.amountSSP || 0), 0);
  const usdIncome = incomeSeries.reduce((a, b) => a + (b.amountUSD || 0), 0);

  const monthTotalSSP = Number(dashboardData?.totalIncomeSSP || 0);
  const monthTotalUSD = Number(dashboardData?.totalIncomeUSD || 0);
  const totalExpenses = Number(dashboardData?.totalExpenses || 0);
  const showAvgLine = incomeSeries.length >= 5;

  const monthlyAvgSSP = incomeSeries.length
    ? Math.round(incomeSeries.reduce((sum, v) => sum + (v.amountSSP || 0), 0) / incomeSeries.length)
    : 0;

  const sspRevenue = monthTotalSSP || sspIncome;
  const sspNetIncome = sspRevenue - totalExpenses;

  const getPatientVolumeNavigation = () => {
    const currentDate = new Date();
    switch (timeRange) {
      case "current-month": return { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
      case "last-month": {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }
      case "last-3-months": {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }
      case "year": return { year: currentDate.getFullYear(), month: 1 };
      case "custom":
        return customStartDate
          ? { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 }
          : { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
      default: return { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
    }
  };

  // loading
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

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Sticky Header */}
      <header
        className="sticky z-[60] bg-white/80 supports-[backdrop-filter]:bg-white/60 backdrop-blur border-b px-6 py-4"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">
              Executive Dashboard
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <p className="text-sm text-muted-foreground">Key financials · {periodLabel}</p>
            </div>
          </div>

          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
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
                      className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}
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
                    avoidCollisions={true}
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      selected={customStartDate}
                      onSelect={(d) => d && setCustomRange(d, customEndDate)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <span aria-hidden="true" className="text-muted-foreground">to</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("h-9 justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}
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
                    avoidCollisions={true}
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      selected={customEndDate}
                      onSelect={(d) => d && setCustomRange(customStartDate, d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
          {/* Total Revenue */}
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    SSP {nf0.format(Math.round(monthTotalSSP || sspIncome))}
                  </p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.incomeChangeSSP !== undefined && (
                      <span
                        className={`text-xs font-medium ${
                          dashboardData.changes.incomeChangeSSP > 0 ? "text-emerald-600" :
                          dashboardData.changes.incomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {dashboardData.changes.incomeChangeSSP > 0 ? "+" : ""}
                        {dashboardData.changes.incomeChangeSSP.toFixed(1)}% vs last month
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-emerald-50 p-1.5 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Expenses */}
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    SSP {nf0.format(Math.round(totalExpenses))}
                  </p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.expenseChangeSSP !== undefined &&
                      (dashboardData.changes.expenseChangeSSP < 0 ? (
                        <span className="text-xs font-medium text-emerald-600">
                          {dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">
                          +{dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                        </span>
                      ))}
                  </div>
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
                    SSP {nf0.format(Math.round(sspNetIncome))}
                  </p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.netIncomeChangeSSP !== undefined && (
                      <span
                        className={`text-xs font-medium ${
                          dashboardData.changes.netIncomeChangeSSP > 0 ? "text-emerald-600" :
                          dashboardData.changes.netIncomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
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

          {/* Insurance USD */}
          <Link href="/insurance-providers">
            <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                    <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                      USD {fmtUSD(monthTotalUSD || usdIncome)}
                    </p>
                    {dashboardData?.insuranceBreakdown && (
                      <div className="mt-1">
                        <span className="text-xs font-medium text-purple-600">
                          {Object.keys(dashboardData?.insuranceBreakdown || {}).length === 1
                            ? "1 provider" : `${Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-purple-50 p-1.5 rounded-lg"><Shield className="h-4 w-4 text-purple-600" /></div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Patient Volume */}
          <Link href={`/patient-volume?view=monthly&year=${getPatientVolumeNavigation().year}&month=${getPatientVolumeNavigation().month}&range=${timeRange}`}>
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
                  <div className="bg-teal-50 p-1.5 rounded-lg"><Users className="h-4 w-4 text-teal-600" /></div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Revenue vs Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start auto-rows-min">
          {/* Chart */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="p-4 sm:p-6 pb-0">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Revenue Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {incomeSeries.length ? (
                  <div>
                    <div className="h-64 lg:h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={incomeSeries} barGap={4} barSize={14}>
                          <CartesianGrid vertical={false} stroke="#eef2f7" />
                          <XAxis
                            dataKey="day"
                            ticks={[1, ...Array.from({ length: incomeSeries.length }, (_, i) => i + 1)].filter((n, i, a) => n === 1 || n === a[a.length - 1] || n % 5 === 0)}
                            tickFormatter={(v: number) => String(v)}
                            axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            height={40}
                          />
                          {/* Left Y axis (SSP) */}
                          <YAxis
                            yAxisId="ssp"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#0f766e" }}
                            tickFormatter={kfmt}
                            label={{ value: "Revenue (SSP)", angle: -90, position: "insideLeft", offset: 8, style: { fill: "#0f766e", fontSize: 11 } }}
                          />
                          {/* Right Y axis (USD) */}
                          <YAxis
                            yAxisId="usd"
                            hide={!hasAnyUSD}
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#1d4ed8" }}
                            tickFormatter={kfmt}
                            label={{ value: "Revenue (USD)", angle: -90, position: "insideRight", offset: 8, style: { fill: "#1d4ed8", fontSize: 11 } }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          {/* Avg line (SSP only) */}
                          {showAvgLine && monthlyAvgSSP > 0 && (
                            <ReferenceLine
                              yAxisId="ssp"
                              y={monthlyAvgSSP}
                              stroke="#14b8a6"
                              strokeDasharray="3 3"
                              label={{
                                value: `Avg (SSP) ${kfmt(monthlyAvgSSP)}`,
                                position: "right",
                                fill: "#0f766e",
                                fontSize: 12,
                              }}
                            />
                          )}
                          <Legend verticalAlign="top" align="center" height={24} wrapperStyle={{ fontSize: 12 }} />
                          <Bar name="SSP" yAxisId="ssp" dataKey="amountSSP" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                          {hasAnyUSD && (
                            <Bar name="USD" yAxisId="usd" dataKey="amountUSD" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Totals/Peak/Avg */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col text-center">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                        <div className="space-y-1">
                          {monthTotalSSP > 0 && <span className="block text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(monthTotalSSP)}</span>}
                          {monthTotalUSD > 0 && <span className="block text-lg font-bold text-slate-900 font-mono tabular-nums">USD {fmtUSD(monthTotalUSD)}</span>}
                          {monthTotalSSP === 0 && monthTotalUSD === 0 && <span className="text-sm text-slate-500">No revenue in this range</span>}
                        </div>
                      </div>
                      <div className="flex flex-col text-center">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Peak Day</span>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(Math.max(...incomeSeries.map(d => d.amountSSP), 0))}</span>
                          <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">Peak</Badge>
                        </div>
                        {/* Find the first max as label */}
                        <span className="text-xs text-slate-500 mt-1">
                          {(() => {
                            const max = Math.max(...incomeSeries.map(d => d.amountSSP), 0);
                            const hit = incomeSeries.find(d => d.amountSSP === max);
                            return hit?.fullDate || "";
                          })()}
                        </span>
                      </div>
                      <div className="flex flex-col text-center">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Monthly Avg</span>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(monthlyAvgSSP)}</span>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">Avg</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-80 lg:h-[420px] bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                    <div className="text-center">
                      <p className="text-slate-600 font-medium">No revenue data for this period.</p>
                      <p className="text-slate-500 text-sm">Try another date range.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Departments panel */}
          <div className="lg:col-span-1">
            <DepartmentsPanel departments={departments || []} totals={dashboardData?.departmentTotals || {}} />
          </div>
        </div>

        {/* Quick actions + system status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-2">
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
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="border-0 shadow-md bg-white">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">System Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 space-y-2">
                <div className="text-sm text-slate-600">All services operational.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Expenses drawer */}
      <ExpensesDrawer
        open={openExpenses}
        onOpenChange={setOpenExpenses}
        periodLabel={periodLabel}
        expenseBreakdown={dashboardData?.expenseBreakdown ?? {}}
        totalExpenseSSP={Number(dashboardData?.totalExpenses || 0)}
        onViewFullReport={() => { window.location.href = "/reports"; }}
      />
    </div>
  );
}

// ---------- custom tooltip ----------
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const hasSSP = p.amountSSP > 0;
  const hasUSD = p.amountUSD > 0;
  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
      <p className="font-semibold text-slate-900 mb-2">{p.fullDate}</p>
      {hasSSP && <p className="text-sm text-slate-700 font-mono">SSP {nf0.format(p.amountSSP)}</p>}
      {hasUSD && <p className="text-sm text-slate-700 font-mono">USD {fmtUSD(p.amountUSD)}</p>}
      {!hasSSP && !hasUSD && <p className="text-sm text-slate-500">No transactions</p>}
    </div>
  );
}
