// client/src/pages/advanced-dashboard.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";

import {
  TrendingUp, TrendingDown, DollarSign, Users, CalendarIcon, Shield, RefreshCw,
} from "lucide-react";

import { api } from "@/lib/queryClient";
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

  // ---------- queries ----------
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
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
      amountSSP: Number(r.incomeSSP ?? (r.income ?? r.amount ?? 0)),
      label: r.date,
      fullDate: r.date,
    }));
  } else {
    const y = selectedYear;
    const m = selectedMonth;
    const daysInMonth = new Date(y, m, 0).getDate();
    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1, amount: 0, amountUSD: 0, amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(y, m - 1, i + 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }));
    if (Array.isArray(rawIncome)) {
      for (const r of rawIncome as any[]) {
        let d = (r as any).day;
        if (!d && (r as any).dateISO) d = new Date((r as any).dateISO).getDate();
        if (!d && (r as any).date) d = new Date((r as any).date).getDate();
        if (d >= 1 && d <= daysInMonth) {
          incomeSeries[d - 1].amountUSD += Number((r as any).incomeUSD ?? 0);
          incomeSeries[d - 1].amountSSP += Number((r as any).incomeSSP ?? (r as any).income ?? (r as any).amount ?? 0);
          incomeSeries[d - 1].amount += Number((r as any).income ?? (r as any).amount ?? 0);
        }
      }
    }
  }

  // ---------- totals & metrics ----------
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const daysWithSSP = incomeSeries.filter(d => d.amountSSP > 0).length;
  const monthlyAvgSSP = daysWithSSP ? Math.round(monthTotalSSP / daysWithSSP) : 0;
  const peakSSP = Math.max(...incomeSeries.map(d => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find(d => d.amountSSP === peakSSP);
  const showAvgLine = daysWithSSP >= 2;
  const hasAnyUSD = incomeSeries.some(d => d.amountUSD > 0);

  // hide zero bars: null skips drawing
  const chartData = useMemo(
    () => incomeSeries.map(d => ({
      ...d,
      amountSSPPlot: d.amountSSP > 0 ? d.amountSSP : null,
      amountUSDPlot: d.amountUSD > 0 ? d.amountUSD : null,
    })),
    [incomeSeries]
  );

  const xTicks = useMemo(() => {
    const n = incomeSeries.length;
    if (!n) return [];
    const base = Array.from({ length: n }, (_, i) => i + 1).filter(v => v === 1 || v === n || v % 5 === 0);
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

  // ---------- robust department breakdown mapping ----------
  /**
   * The API might return department breakdown keyed by:
   *   - department id (preferred) e.g. {"1": 100000}
   *   - department code e.g. {"LAB": 100000}
   *   - department name e.g. {"Laboratory": 100000}
   *
   * This function normalizes it into { [dept.id]: amount }
   */
  const normalizedDeptBreakdown: Record<string, number> = useMemo(() => {
    const raw = (dashboardData as any)?.departmentBreakdown ?? (dashboardData as any)?.departmentTotals ?? {};
    if (!raw || !departments) return raw ?? {};

    const list = Array.isArray(departments) ? (departments as any[]) : [];
    const idSet = new Set(list.map((d) => String(d.id)));

    // If at least one key matches an id, assume it's id-keyed and return as-is.
    const keys = Object.keys(raw || {});
    if (keys.some((k) => idSet.has(String(k)))) {
      const byId: Record<string, number> = {};
      for (const k of keys) byId[String(k)] = Number(raw[k] ?? 0);
      return byId;
    }

    // Otherwise, remap by name/code -> id.
    const byId: Record<string, number> = {};
    for (const d of list) {
      const v = raw[d.name] ?? raw[d.code] ?? 0;
      byId[String(d.id)] = Number(v || 0);
    }
    return byId;
  }, [(dashboardData as any)?.departmentBreakdown, (dashboardData as any)?.departmentTotals, departments]);

  const sspRevenue =
    Number((dashboardData as any)?.totalRevenueSSP ?? (dashboardData as any)?.sspRevenue ?? 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Simple header (kept as your working version) */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">Executive Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Key financials · {periodLabel}</p>
          </div>

          {/* Time range + custom dates */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            <Select
              value={timeRange}
              onValueChange={(v: any) => handleTimeRangeChange(v)}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Current Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === "custom" && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI band */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-600 text-sm">Total Revenue</div>
                  <div className="text-slate-900 font-bold text-xl font-mono tabular-nums">
                    SSP {nf0.format(Number((dashboardData as any)?.totalRevenueSSP || 0))}
                  </div>
                  <div className="text-slate-500 text-xs">0.0% vs last month</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-600 text-sm">Total Expenses</div>
                  <div className="text-slate-900 font-bold text-xl font-mono tabular-nums">
                    SSP {nf0.format(Number((dashboardData as any)?.totalExpenses || 0))}
                  </div>
                  <div className="text-slate-500 text-xs">0.0% vs last month</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 border border-rose-200">
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-600 text-sm">Net Income</div>
                  <div className="text-slate-900 font-bold text-xl font-mono tabular-nums">
                    SSP {nf0.format(Number((dashboardData as any)?.netIncome || 0))}
                  </div>
                  <div className="text-slate-500 text-xs">0.0% vs last month</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 border border-indigo-200">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-600 text-sm">Insurance (USD)</div>
                  <div className="text-slate-900 font-bold text-xl font-mono tabular-nums">
                    USD {fmtUSD(Number((dashboardData as any)?.insuranceRevenueUSD || 0))}
                  </div>
                  <div className="text-slate-500 text-xs">0.0% vs last month</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 border border-purple-200">
                  <Shield className="h-4 w-4 text-purple-600" />
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-600 text-sm">Total Patients</div>
                  <div className="text-slate-900 font-bold text-xl font-mono tabular-nums">
                    {Number((dashboardData as any)?.patientCount || 0)}
                  </div>
                  <div className="text-slate-500 text-xs">Current period</div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 border border-teal-200">
                  <Users className="h-4 w-4 text-teal-600" />
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-900">Revenue Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeSeries.length > 0 ? (
              <div className="space-y-3">
                <div className="h-80 lg:h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="day"
                        ticks={xTicks}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        height={40}
                      />
                      <YAxis
                        yAxisId="ssp"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#0f766e" }}
                        tickFormatter={formatYAxisSSP}
                        label={{ value: "Revenue (SSP)", angle: -90, position: "insideLeft", offset: 8, style: { fill: "#0f766e", fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="usd"
                        hide={!hasAnyUSD}
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#1d4ed8" }}
                        tickFormatter={formatYAxisUSD}
                        label={{ value: "Revenue (USD)", angle: 90, position: "insideRight", offset: 8, style: { fill: "#1d4ed8", fontSize: 11 } }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {showAvgLine && monthlyAvgSSP > 0 && (
                        <ReferenceLine
                          yAxisId="ssp"
                          y={monthlyAvgSSP}
                          stroke="#0d9488"
                          strokeWidth={1}
                          strokeDasharray="4 2"
                          label={{ value: `Avg (SSP) ${kfmt(monthlyAvgSSP)}`, position: "insideTopRight", style: { fontSize: 10, fill: "#0d9488", fontWeight: 500 }, offset: 8 }}
                        />
                      )}
                      <Bar yAxisId="ssp" dataKey="amountSSPPlot" name="SSP" fill="#14b8a6" barSize={24} radius={[4, 4, 0, 0]} />
                      {hasAnyUSD && (
                        <Bar yAxisId="usd" dataKey="amountUSDPlot" name="USD" fill="#0ea5e9" barSize={24} radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Totals */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                      <div className="space-y-1">
                        {monthTotalSSP > 0 && <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(monthTotalSSP)}</span>}
                        {monthTotalUSD > 0 && <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">USD {fmtUSD(monthTotalUSD)}</span>}
                        {monthTotalSSP === 0 && monthTotalUSD === 0 && <span className="text-sm text-slate-500">No revenue in this range</span>}
                      </div>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Peak Day</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(peakSSP)}</span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">Peak</Badge>
                      </div>
                      {peakDaySSP && <span className="text-xs text-slate-500 mt-1">{peakDaySSP.fullDate}</span>}
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Monthly Avg</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {nf0.format(monthlyAvgSSP)}</span>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">Avg</Badge>
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

        {/* Right column — Departments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2" />
          <div className="lg:col-span-1">
            <DepartmentsPanel
              departments={Array.isArray(departments) ? (departments as any[]) : []}
              departmentBreakdown={normalizedDeptBreakdown}
              totalSSP={sspRevenue}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="border border-slate-200 shadow-sm">
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
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-blue-50 hover:border-blue-200">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Patient Volume</span>
                    <span className="text-xs text-slate-500">Update patient count</span>
                  </div>
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Drawer (unchanged) */}
      <ExpensesDrawer
        open={openExpenses}
        onOpenChange={setOpenExpenses}
        expenses={(dashboardData as any)?.expenseBreakdown ?? {}}
        total={Number((dashboardData as any)?.totalExpenses ?? 0)}
        periodLabel={periodLabel}
      />
    </div>
  );
}
