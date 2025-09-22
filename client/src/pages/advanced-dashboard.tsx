'use client';

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

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
import { useDateFilter } from "@/context/date-filter-context";

// Feature components kept separate so the page stays clean:
import RevenueAnalyticsDaily from "@/components/dashboard/revenue-analytics-daily";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";

/* ------------------------------ formatters ------------------------------ */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

/* --------------------------------- page --------------------------------- */
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

  // Keep backend compatibility when user uses the “month-select” UI
  const normalizedRange = timeRange === "month-select" ? "current-month" : timeRange;

  /* ------------------------- quick range + month UI ------------------------- */
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

  /* -------------------------------- queries ------------------------------- */
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      normalizedRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const { data } = await api.get(url);
      return data ?? {};
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const { data } = await api.get("/api/departments");
      return Array.isArray(data) ? data : [];
    },
  });

  // For SSP/USD monthly totals (used in the KPI cards) we reuse the daily feed
  const { data: rawIncome = [] } = useQuery({
    queryKey: [
      "/api/income-trends",
      selectedYear,
      selectedMonth,
      normalizedRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/income-trends/${selectedYear}/${selectedMonth}?range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
          customEndDate,
          "yyyy-MM-dd"
        )}`;
      }
      const { data } = await api.get(url);
      return Array.isArray(data) ? data : [];
    },
  });

  /* ------------------------ compute monthly SSP/USD ------------------------ */
  const { totalSSP, totalUSD } = useMemo(() => {
    // Build a month-contiguous array and sum
    const y = selectedYear;
    const m = selectedMonth;
    const days = new Date(y, m, 0).getDate();
    const ssp = new Array(days).fill(0);
    const usd = new Array(days).fill(0);

    for (const r of rawIncome as any[]) {
      let d: number | undefined = (r as any).day;
      if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
      if (!d && (r as any).date) d = new Date((r as any).date).getDate();
      if (typeof d === "number" && d >= 1 && d <= days) {
        ssp[d - 1] += Number((r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0);
        usd[d - 1] += Number((r as any).incomeUSD ?? 0);
      }
    }
    return {
      totalSSP: ssp.reduce((a, b) => a + b, 0),
      totalUSD: usd.reduce((a, b) => a + b, 0),
    };
  }, [rawIncome, selectedYear, selectedMonth]);

  /* ---------------------------- loading overlay --------------------------- */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  /* ------------------------------- summaries ------------------------------ */
  const sspIncomeFromAPI = Number(dashboardData?.totalIncomeSSP || 0);
  const usdIncomeFromAPI = Number(dashboardData?.totalIncomeUSD || 0);
  const totalExpenses = Number(dashboardData?.totalExpenses || 0);

  const sspRevenue = totalSSP || sspIncomeFromAPI;
  const netIncomeSSP = sspRevenue - totalExpenses;

  /* -------------------------- helper for navigation ------------------------ */
  const getPatientVolumeNavigation = () => {
    const d = new Date();
    switch (timeRange) {
      case "current-month":
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      case "last-month": {
        const x = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        return { year: x.getFullYear(), month: x.getMonth() + 1 };
      }
      case "last-3-months": {
        const x = new Date(d.getFullYear(), d.getMonth() - 2, 1);
        return { year: x.getFullYear(), month: x.getMonth() + 1 };
      }
      case "year":
        return { year: d.getFullYear(), month: 1 };
      case "month-select":
        return { year: selectedYear, month: selectedMonth };
      case "custom":
        return customStartDate
          ? { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 }
          : { year: d.getFullYear(), month: d.getMonth() + 1 };
      default:
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  };

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="bg-white p-6 dashboard-content">
      {/* Header + date filters */}
      <header className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">
              Executive Dashboard
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Key financials · {periodLabel}
              </p>
            </div>
          </div>

          {/* RIGHT controls */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
              <SelectTrigger className="h-9 w-[160px]">
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

            {/* month-select helpers */}
            {timeRange === "month-select" && (
              <>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => setSpecificMonth(Number(val), selectedMonth || 1)}
                >
                  <SelectTrigger className="h-9 w-[120px]">
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
                  onValueChange={(val) => setSpecificMonth(selectedYear || thisYear, Number(val))}
                >
                  <SelectTrigger className="h-9 w-[140px]">
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

            {/* custom range pickers */}
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

                <span aria-hidden className="text-muted-foreground">to</span>

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
        {/* Total Revenue (SSP) */}
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

        {/* Total Expenses */}
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

        {/* Net Income (SSP) */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Net Income</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {nf0.format(Math.round(netIncomeSSP))}
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

        {/* Insurance (USD) */}
        <Link
          href={`/insurance-providers?range=${normalizedRange}${
            timeRange === "custom" && customStartDate && customEndDate
              ? `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(
                  customEndDate,
                  "yyyy-MM-dd"
                )}`
              : `&year=${selectedYear}&month=${selectedMonth}`
          }`}
        >
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    USD {fmtUSD(Math.round(usdIncomeFromAPI || totalUSD))}
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
          href={`/patient-volume?view=monthly&year=${
            getPatientVolumeNavigation().year
          }&month=${getPatientVolumeNavigation().month}&range=${normalizedRange}`}
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

      {/* Main grid: keep Departments perfectly aligned with Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start auto-rows-min">
        {/* left: Revenue Analytics (spans 2) */}
        <div className="lg:col-span-2">
          <RevenueAnalyticsDaily
            timeRange={timeRange}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            customStartDate={customStartDate ?? undefined}
            customEndDate={customEndDate ?? undefined}
          />
        </div>

        {/* right: Departments (spans 1) */}
        <div className="lg:col-span-1">
          <DepartmentsPanel
            departments={Array.isArray(departments) ? (departments as any[]) : []}
            departmentBreakdown={dashboardData?.departmentBreakdown}
            totalSSP={sspRevenue}
          />
        </div>

        {/* Quick Actions — under chart (spans 2) */}
        <Card className="border border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
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

        {/* System Status — under Departments (spans 1) */}
        <Card className="border border-slate-200 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full">
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
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">
                  1 online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense drawer (click Total Expenses card to open) */}
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
