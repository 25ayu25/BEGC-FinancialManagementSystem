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
  Shield,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ReferenceLine,
  Legend,
} from "recharts";

import { api } from "@/lib/queryClient";
import { useDateFilter } from "@/context/date-filter-context";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import DepartmentsPanel from "@/components/dashboard/DepartmentsPanel";

/* ----------------------- formatting helpers ----------------------- */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));
const fmtUSD = (v: number) => {
  const one = Number(v.toFixed(1));
  return Number.isInteger(one) ? nf0.format(one) : nf1.format(one);
};

/* -------------------- date helpers (no collisions) -------------------- */
const dateToISO = (d: Date) => d.toISOString().slice(0, 10); // yyyy-mm-dd
const startOfMonth = (y: number, m1: number) => new Date(y, m1 - 1, 1);
const endOfMonth = (y: number, m1: number) => new Date(y, m1, 0);

/* ===================================================================== */

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

  // Keep backend contract: month-select maps to current-month for queries
  const normalizedRange = timeRange === "month-select" ? "current-month" : timeRange;

  /* --------------------------- Range controls --------------------------- */
  const onChangeRange = (
    r:
      | "current-month"
      | "last-month"
      | "last-3-months"
      | "year"
      | "month-select"
      | "custom"
  ) => setTimeRange(r);

  const now = new Date();
  const thisYear = now.getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

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

  /* ------------------------------- Queries ------------------------------ */
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
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const { data } = await api.get("/api/departments");
      return data;
    },
  });

  const { data: rawIncome } = useQuery({
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
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  /* ------------------------- Build income series ------------------------ */
  type DayRow = {
    day: number;
    label: string;
    fullDate: string;
    amount: number;
    amountSSP: number;
    amountUSD: number;
    amountSSPPlot: number | null;
    amountUSDPlot: number | null;
  };

  let incomeSeries: DayRow[] = [];

  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    // Custom: rely on backend sequence
    incomeSeries = (rawIncome as any[]).map((r: any, i: number) => ({
      day: i + 1,
      label: r.date,
      fullDate: r.date,
      amount: Number(r.income ?? r.amount ?? 0),
      amountSSP: Number(r.incomeSSP ?? r.income ?? r.amount ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSPPlot: null,
      amountUSDPlot: null,
    }));
  } else {
    // Month views: build a full month shape and fill
    const y = selectedYear;
    const m = selectedMonth;
    const daysInMonth = new Date(y, m, 0).getDate();

    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(y, m - 1, i + 1);
      const full = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return {
        day: i + 1,
        label: `${i + 1}`,
        fullDate: full,
        amount: 0,
        amountSSP: 0,
        amountUSD: 0,
        amountSSPPlot: null,
        amountUSDPlot: null,
      };
    });

    if (Array.isArray(rawIncome)) {
      for (const r of rawIncome as any[]) {
        let d = (r as any).day;
        if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
        if (!d && (r as any).date) d = new Date((r as any).date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          const row = incomeSeries[d - 1];
          row.amountUSD += Number((r as any).incomeUSD ?? 0);
          row.amountSSP += Number((r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0);
          row.amount += Number((r as any).income ?? (r as any).amount ?? 0);
        }
      }
    }
  }

  // Plot-friendly fields
  incomeSeries = incomeSeries.map((d) => ({
    ...d,
    amountSSPPlot: d.amountSSP > 0 ? d.amountSSP : null,
    amountUSDPlot: d.amountUSD > 0 ? d.amountUSD : null,
  }));

  /* --------------------------- Aggregates --------------------------- */
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const daysWithSSP = incomeSeries.filter((d) => d.amountSSP > 0).length;
  const monthlyAvgSSP = daysWithSSP ? Math.round(monthTotalSSP / daysWithSSP) : 0;
  const peakSSP = Math.max(...incomeSeries.map((d) => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find((d) => d.amountSSP === peakSSP);
  const showAvgLine = daysWithSSP >= 2;
  const hasAnyUSD = incomeSeries.some((d) => d.amountUSD > 0);

  // Recharts helpers
  const xTicks = useMemo(() => {
    const n = incomeSeries.length;
    if (!n) return [];
    const base = Array.from({ length: n }, (_, i) => i + 1).filter(
      (v) => v === 1 || v === n || v % 5 === 0
    );
    if (!base.includes(n)) base.push(n);
    return base;
  }, [incomeSeries.length]);

  const formatYAxisSSP = kfmt;
  const formatYAxisUSD = kfmt;

  const CustomTooltip = ({ active, payload }: any) => {
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
  };

  /* -------------------------- Loading state -------------------------- */
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

  /* ------------------------- Top-level figures ------------------------ */
  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || "0");
  const usdIncome = parseFloat(dashboardData?.totalIncomeUSD || "0");
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || "0");
  const sspRevenue = monthTotalSSP || sspIncome;
  const sspNetIncome = sspRevenue - totalExpenses;

  /* --------------------- Build Insurance window link -------------------- */
  const getInsuranceWindow = () => {
    const current = new Date();
    let fromISO = "";
    let toISOValue = "";

    if (timeRange === "custom" && customStartDate && customEndDate) {
      fromISO = format(customStartDate, "yyyy-MM-dd");
      toISOValue = format(customEndDate, "yyyy-MM-dd");
      return { fromISO, toISO: toISOValue };
    }

    let anchorYear = selectedYear;
    let anchorMonth = selectedMonth;

    if (timeRange !== "month-select") {
      anchorYear = current.getFullYear();
      anchorMonth = current.getMonth() + 1;
    }

    switch (timeRange) {
      case "current-month": {
        const s = startOfMonth(anchorYear, anchorMonth);
        const e = endOfMonth(anchorYear, anchorMonth);
        fromISO = dateToISO(s);
        toISOValue = dateToISO(e);
        break;
      }
      case "last-month": {
        const d = new Date(anchorYear, anchorMonth - 2, 1);
        const s = startOfMonth(d.getFullYear(), d.getMonth() + 1);
        const e = endOfMonth(d.getFullYear(), d.getMonth() + 1);
        fromISO = dateToISO(s);
        toISOValue = dateToISO(e);
        break;
      }
      case "last-3-months": {
        const end = endOfMonth(anchorYear, anchorMonth);
        const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
        fromISO = dateToISO(start);
        toISOValue = dateToISO(end);
        break;
      }
      case "year": {
        const y = anchorYear;
        fromISO = `${y}-01-01`;
        toISOValue = `${y}-12-31`;
        break;
      }
      case "month-select": {
        const s = startOfMonth(selectedYear, selectedMonth);
        const e = endOfMonth(selectedYear, selectedMonth);
        fromISO = dateToISO(s);
        toISOValue = dateToISO(e);
        break;
      }
      default: {
        const s = startOfMonth(anchorYear, anchorMonth);
        const e = endOfMonth(anchorYear, anchorMonth);
        fromISO = dateToISO(s);
        toISOValue = dateToISO(e);
      }
    }
    return { fromISO, toISO: toISOValue };
  };

  const insuranceWindow = getInsuranceWindow();

  /* ===================================================================== */

  return (
    <div className="bg-white p-6 dashboard-content">
      {/* Header */}
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

          {/* RIGHT: range + month/year + custom */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            {/* Presets */}
            <Select value={timeRange} onValueChange={onChangeRange}>
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

            {/* Month-select */}
            {timeRange === "month-select" && (
              <>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) =>
                    setSpecificMonth(Number(val), selectedMonth || 1)
                  }
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
                  onValueChange={(val) =>
                    setSpecificMonth(selectedYear || thisYear, Number(val))
                  }
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

            {/* Custom date pickers */}
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
                  SSP {nf0.format(Math.round(monthTotalSSP || sspIncome))}
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

        {/* Insurance (USD) — contextual link with canonical from/to */}
        <Link
          href={`/insurance-providers?from=${insuranceWindow.fromISO}&to=${insuranceWindow.toISO}&bucket=month`}
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

        {/* Patient Volume (unchanged link semantics) */}
        <Link
          href={`/patient-volume?view=monthly&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}&range=${normalizedRange}`}
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-start auto-rows-min">
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
                <div className="h-80 lg:h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={incomeSeries}
                      margin={{
                        top: 20,
                        right: hasAnyUSD ? 60 : 20,
                        left: 10,
                        bottom: 30,
                      }}
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
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="rect"
                        wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                      />
                      <XAxis
                        dataKey="day"
                        ticks={xTicks}
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
                        tickFormatter={formatYAxisSSP}
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
                      <ReTooltip content={<CustomTooltip />} />
                      {/* Avg line (SSP) */}
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
                            offset: 8,
                          }}
                        />
                      )}
                      {/* Bars */}
                      <Bar
                        yAxisId="ssp"
                        dataKey="amountSSPPlot"
                        name="SSP"
                        fill="#14b8a6"
                        barSize={24}
                        radius={[4, 4, 0, 0]}
                      />
                      {hasAnyUSD && (
                        <Bar
                          yAxisId="usd"
                          dataKey="amountUSDPlot"
                          name="USD"
                          fill="#0ea5e9"
                          barSize={24}
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Totals */}
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
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                          Peak
                        </Badge>
                      </div>
                      {peakDaySSP && (
                        <span className="text-xs text-slate-500 mt-1">
                          {peakDaySSP.fullDate}
                        </span>
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
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">
                          Avg
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 lg:h-[420px] bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3" />
                  <p className="text-slate-600 text-sm font-medium">No revenue in this range</p>
                  <p className="text-slate-500 text-xs mt-1">Try selecting a different time period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Departments */}
        <div className="lg:col-span-1">
          <DepartmentsPanel
            departments={Array.isArray(departments) ? (departments as any[]) : []}
            departmentBreakdown={dashboardData?.departmentBreakdown}
            totalSSP={sspRevenue}
          />
        </div>

        {/* Quick Actions */}
        <Card className="border border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border border-slate-200 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" /> System Status
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
                  {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Active Users</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">
                  1 online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Drawer */}
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
