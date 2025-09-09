// client/src/pages/advanced-dashboard.tsx
import { useState } from "react";
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
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend,
} from "recharts";

// 🔗 Global date filter (shared with Overview)
import { useDateFilter } from "@/context/date-filter-context";

// ✅ Expenses drawer
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";

/* ---------------- Helpers: number formatting ---------------- */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));
const formatYAxisSSP = kfmt;
const formatYAxisUSD = kfmt;
const fmtUSD = (v: number) => (Number.isInteger(v) ? nf0.format(v) : nf1.format(v));

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

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear, selectedMonth, timeRange,
      customStartDate?.toISOString(), customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await api.get(url);
      return res.data;
    },
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  const getPatientVolumeNavigation = () => {
    const now = new Date();
    switch (timeRange) {
      case "current-month": return { year: now.getFullYear(), month: now.getMonth() + 1 };
      case "last-month": {
        const d = new Date(now.getFullYear(), now.getMonth() - 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }
      case "last-3-months": {
        const d = new Date(now.getFullYear(), now.getMonth() - 2);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }
      case "year": return { year: now.getFullYear(), month: 1 };
      case "custom":
        return customStartDate
          ? { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 }
          : { year: now.getFullYear(), month: now.getMonth() + 1 };
      default: return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
  };

  const { data: rawIncome } = useQuery({
    queryKey: [
      "/api/income-trends",
      selectedYear, selectedMonth, timeRange,
      customStartDate?.toISOString(), customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/income-trends/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await api.get(url);
      return res.data;
    },
  });

  /* ---------------- Build income series ---------------- */
  let incomeSeries: Array<any> = [];
  let monthName = "";

  if (timeRange === "custom" && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    monthName = `${format(customStartDate, "MMM d, yyyy")} - ${format(customEndDate, "MMM d, yyyy")}`;
    incomeSeries = rawIncome.map((r: any, i: number) => ({
      day: i + 1,
      amount: Number(r.income ?? r.amount ?? 0),
      amountUSD: Number(r.incomeUSD ?? 0),
      amountSSP: Number(r.incomeSSP ?? r.income ?? r.amount ?? 0),
      label: r.date,
      fullDate: r.date,
    }));
  } else {
    const y = selectedYear;
    const m = selectedMonth;
    const daysInMonth = new Date(y, m, 0).getDate();
    monthName = new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: 0,
      amountUSD: 0,
      amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(y, m - 1, i + 1).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      }),
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

  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);

  // ✅ SSP average only over days with SSP
  const daysWithSSP = incomeSeries.filter((d) => d.amountSSP > 0).length;
  const monthlyAvgSSP = daysWithSSP ? Math.round(monthTotalSSP / daysWithSSP) : 0;

  const peakSSP = Math.max(...incomeSeries.map((d) => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find((d) => d.amountSSP === peakSSP);
  const showAvgLine = daysWithSSP >= 2;
  const hasAnyUSD = incomeSeries.some((d) => d.amountUSD > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasSSP = data.amountSSP > 0;
      const hasUSD = data.amountUSD > 0;
      const totalAmount = data.amount;
      const shareOfMonth =
        monthTotalSSP + monthTotalUSD > 0
          ? (totalAmount / (monthTotalSSP + monthTotalUSD)) * 100
          : 0;
      const dayIndex = incomeSeries.findIndex((d) => d.day === data.day);
      const mtdTotal = incomeSeries.slice(0, dayIndex + 1).reduce((sum, d) => sum + d.amount, 0);

      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
          <p className="font-semibold text-slate-900 mb-2">{data.fullDate}</p>
          {hasSSP && <p className="text-sm text-slate-700 font-mono">SSP {nf0.format(Math.round(data.amountSSP))}</p>}
          {hasUSD && <p className="text-sm text-slate-700 font-mono">USD {fmtUSD(data.amountUSD)}</p>}
          {totalAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">Share of period: {shareOfMonth.toFixed(1)}%</p>
              <p className="text-xs text-slate-500">MTD total: SSP {nf0.format(Math.round(mtdTotal))}</p>
            </div>
          )}
          {!hasSSP && !hasUSD && <p className="text-sm text-slate-500">No transactions</p>}
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (d: any) => {
    const row = d?.payload;
    if (row && row.amount > 0) console.log(`Open transactions for ${row.fullDate}`);
  };

  const formatXAxis = (tickItem: any, index: number) => {
    if (timeRange === "custom" && customStartDate && customEndDate) {
      const dayData = incomeSeries[index];
      if (!dayData) return "";
      const hasTx = dayData.amount > 0;
      return hasTx ? dayData.label : index % 7 === 0 ? dayData.label : "";
    } else {
      const day = parseInt(tickItem);
      const dayData = incomeSeries.find((d) => d.day === day);
      const hasTx = dayData && dayData.amount > 0;
      if (hasTx) return String(day);
      const n = incomeSeries.length;
      return n <= 28 ? String(day) : (day === 1 || day === n || day % 5 === 0 ? String(day) : "");
    }
  };

  const generateYTicksSSP = () => {
    const peak = Math.max(...incomeSeries.map((d) => d.amountSSP), 0);
    if (peak === 0) return [0, 10000, 20000, 30000, 40000];
    const maxNeeded = Math.max(peak * 1.2, 10000);
    const out = [0];
    for (let i = 10000; i <= maxNeeded + 10000; i += 10000) out.push(i);
    return out;
  };

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

  return (
    <div className="bg-white dark:bg-slate-900 p-6 dashboard-content">
      {/* Header & filters */}
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
                    <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}
                  >
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customStartDate} onSelect={(d) => setCustomRange(d ?? undefined, customEndDate)} initialFocus />
                  </PopoverContent>
                </Popover>

                <span aria-hidden className="text-muted-foreground">to</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}
                  >
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customEndDate} onSelect={(d) => setCustomRange(customStartDate, d ?? undefined)} initialFocus />
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
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.incomeChangeSSP > 0 ? "text-emerald-600"
                      : dashboardData.changes.incomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
                    }`}>
                      {dashboardData.changes.incomeChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.incomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.incomeChangeSSP !== undefined && dashboardData.changes.incomeChangeSSP < 0
                  ? <TrendingDown className="h-4 w-4 text-red-600" />
                  : <TrendingUp className="h-4 w-4 text-emerald-600" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses — clickable */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setOpenExpenses(true)} title="Click to view expense breakdown">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {nf0.format(Math.round(totalExpenses))}
                </p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.expenseChangeSSP !== undefined && (
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.expenseChangeSSP > 0 ? "text-red-600"
                      : dashboardData.changes.expenseChangeSSP < 0 ? "text-emerald-600" : "text-slate-500"
                    }`}>
                      {dashboardData.changes.expenseChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.expenseChangeSSP !== undefined && dashboardData.changes.expenseChangeSSP < 0
                  ? <TrendingDown className="h-4 w-4 text-emerald-600" />
                  : <TrendingUp className="h-4 w-4 text-red-600" />}
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
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.netIncomeChangeSSP > 0 ? "text-emerald-600"
                      : dashboardData.changes.netIncomeChangeSSP < 0 ? "text-red-600" : "text-slate-500"
                    }`}>
                      {dashboardData.changes.netIncomeChangeSSP > 0 ? "+" : ""}
                      {dashboardData.changes.netIncomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg"><DollarSign className="h-4 w-4 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue */}
        <Link href={`/insurance-providers?range=${timeRange}${
          timeRange === "custom" && customStartDate && customEndDate
            ? `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}` : ""}`}>
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    USD {fmtUSD(usdIncome)}
                  </p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.incomeChangeUSD !== undefined ? (
                      <span className={`text-xs font-medium ${
                        dashboardData.changes.incomeChangeUSD > 0 ? "text-emerald-600"
                        : dashboardData.changes.incomeChangeUSD < 0 ? "text-red-600" : "text-slate-500"
                      }`}>
                        {dashboardData.changes.incomeChangeUSD > 0 ? "+" : ""}
                        {dashboardData.changes.incomeChangeUSD.toFixed(1)}% vs last month
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-purple-600">
                        {Object.keys(dashboardData?.insuranceBreakdown || {}).length === 1
                          ? "1 provider" : `${Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers`}
                      </span>
                    )}
                  </div>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900">Revenue Analytics</CardTitle>
              {/* Data table button removed for more canvas space */}
            </div>
          </CardHeader>

          <CardContent className="pb-4">
            {(monthTotalSSP > 0 || monthTotalUSD > 0) ? (
              <div className="space-y-0">
                <div className="h-64 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 transform-gpu">
                    <span className="text-xs text-slate-500 font-medium">Revenue</span>
                  </div>

                  <div className="ml-8 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={incomeSeries}
                        margin={{ top: 20, right: 60, left: 10, bottom: 30 }}
                        barCategoryGap="28%"   // nice spacing between day groups
                        barGap={6}             // slight space between SSP & USD bars
                      >
                        <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" strokeWidth={0.3} opacity={0.3} vertical={false} />

                        {/* X axis */}
                        <XAxis
                          dataKey="day"
                          axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={formatXAxis}
                          interval={0}
                          height={40}
                        />

                        {/* Left Y axis (SSP) */}
                        <YAxis
                          yAxisId="ssp"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#0f766e" }}
                          tickFormatter={formatYAxisSSP}
                          label={{ value: "Revenue (SSP)", angle: -90, position: "insideLeft", offset: 8, style: { fill: "#0f766e", fontSize: 11 } }}
                          ticks={generateYTicksSSP()}
                          domain={[0, (dataMax: number) => Math.max(dataMax * 1.2, 10000)]}
                        />

                        {/* Right Y axis (USD) */}
                        {hasAnyUSD && (
                          <YAxis
                            yAxisId="usd"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#1d4ed8" }}
                            tickFormatter={formatYAxisUSD}
                            label={{ value: "Revenue (USD)", angle: 90, position: "insideRight", offset: 8, style: { fill: "#1d4ed8", fontSize: 11 } }}
                            domain={[0, (dataMax: number) => Math.max(Math.round(dataMax * 1.2), 10)]}
                            allowDecimals={false}
                          />
                        )}

                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }} />

                        {/* SSP bar */}
                        <Bar
                          yAxisId="ssp"
                          dataKey="amountSSP"
                          name="SSP"
                          fill="#14b8a6"
                          maxBarSize={22}
                          radius={[4, 4, 0, 0]}
                          onClick={(d: any) => handleBarClick(d)}
                        />

                        {/* USD bar (only if we actually have USD anywhere) */}
                        {hasAnyUSD && (
                          <Bar
                            yAxisId="usd"
                            dataKey="amountUSD"
                            name="USD"
                            fill="#0ea5e9"
                            maxBarSize={22}
                            radius={[4, 4, 0, 0]}
                            onClick={(d: any) => handleBarClick(d)}
                          />
                        )}

                        {/* Monthly average (SSP only) */}
                        {showAvgLine && monthlyAvgSSP > 0 && (
                          <ReferenceLine
                            yAxisId="ssp"
                            y={monthlyAvgSSP}
                            stroke="#0d9488"
                            strokeWidth={1}
                            strokeDasharray="4 2"
                            label={{ value: `Avg (SSP) ${Math.round(monthlyAvgSSP / 1000)}k`, position: "insideTopRight", style: { fontSize: 10, fill: "#0d9488", fontWeight: 500 }, offset: 8 }}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Footer summary */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                      <div className="space-y-1">
                        {monthTotalSSP > 0 && (
                          <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">
                            SSP {nf0.format(Math.round(monthTotalSSP))}
                          </span>
                        )}
                        {monthTotalUSD > 0 && (
                          <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">
                            USD {fmtUSD(monthTotalUSD)}
                          </span>
                        )}
                        {monthTotalSSP === 0 && monthTotalUSD === 0 && (
                          <span className="text-sm text-slate-500">No revenue in this range</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Peak Day</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          SSP {nf0.format(Math.round(peakSSP))}
                        </span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">Peak</Badge>
                      </div>
                      {peakDaySSP && <span className="text-xs text-slate-500 mt-1">{peakDaySSP.fullDate}</span>}
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Monthly Avg</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          SSP {nf0.format(Math.round(monthlyAvgSSP))}
                        </span>
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">Avg</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium">No revenue in this range</p>
                  <p className="text-slate-500 text-xs mt-1">Try selecting a different time period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Departments Widget */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.isArray(departments) ? departments
              .map((dept: any) => {
                const amount = parseFloat(dashboardData?.departmentBreakdown?.[dept.id] || "0");
                const percentage = sspRevenue > 0 ? (amount / sspRevenue) * 100 : 0;
                return { ...dept, amount, percentage };
              })
              .sort((a, b) => b.amount - a.amount)
              .map((dept: any, index: number) => {
                const maxAmount = Math.max(...departments.map((d: any) => parseFloat(dashboardData?.departmentBreakdown?.[d.id] || "0")));
                const proportionWidth = maxAmount > 0 ? (dept.amount / maxAmount) * 100 : 0;
                return (
                  <div key={dept.id} className="w-full flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        index === 0 ? "bg-emerald-500" :
                        index === 1 ? "bg-blue-500" :
                        index === 2 ? "bg-purple-500" :
                        index === 3 ? "bg-orange-500" :
                        "bg-slate-400"
                      }`} />
                      <span className="font-medium text-slate-700 flex-1 text-left">{dept.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 min-w-[80px]">
                      <p className="font-semibold text-slate-900 text-sm font-mono tabular-nums">
                        SSP {nf0.format(Math.round(dept.amount))}
                      </p>
                      <p className="text-xs text-slate-500">{dept.percentage.toFixed(1)}%</p>
                      <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                        <div className="bg-teal-500 h-1 rounded-full transition-all duration-300" style={{ width: `${proportionWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              }) : []}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions / System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="/transactions" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Add Transaction</span>
                    <span className="text-xs text-slate-500">Record new income or expense</span>
                  </div>
                </Button>
              </a>
              <a href="/patient-volume" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Patient Volume</span>
                    <span className="text-xs text-slate-500">Update patient count</span>
                  </div>
                </Button>
              </a>
              <a href="/reports" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Monthly Reports</span>
                    <span className="text-xs text-slate-500">View generated reports</span>
                  </div>
                </Button>
              </a>
              <a href="/users" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
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
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 rounded-full">Connected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last Sync</span>
                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                  {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Active Users</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">1 online</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Expenses drawer */}
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
