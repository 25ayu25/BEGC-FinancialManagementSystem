// client/src/pages/insurance-providers.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft, Calendar as CalendarIcon, Download
} from "lucide-react";
import { Link } from "wouter";

// Recharts for the donut
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from "recharts";

const COLORS = ["#4f46e5","#0ea5e9","#22c55e","#f59e0b","#ef4444","#a855f7","#06b6d4","#84cc16","#f97316","#10b981"];

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmtUSD = (v: number) => nf0.format(Math.round(v));

export default function InsuranceProvidersPage() {
  const currentDate = new Date();

  // —— pick up URL context passed from dashboard ——
  const urlParams = new URLSearchParams(window.location.search);
  const rangeParam = urlParams.get("range") as
    | "current-month" | "last-month" | "last-3-months" | "year" | "custom" | null;
  const startDateParam = urlParams.get("startDate");
  const endDateParam = urlParams.get("endDate");
  const yearParam = urlParams.get("year");
  const monthParam = urlParams.get("month");

  // initial YM from params or sensible default
  const getInitialYearMonth = () => {
    const now = new Date();
    if (yearParam && monthParam) {
      return { year: parseInt(yearParam), month: parseInt(monthParam) };
    }
    switch (rangeParam) {
      case "last-month": {
        const last = new Date(now.getFullYear(), now.getMonth() - 1);
        return { year: last.getFullYear(), month: last.getMonth() + 1 };
      }
      case "year":
        return { year: now.getFullYear(), month: 1 };
      default:
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
  };

  const initialYearMonth = getInitialYearMonth();
  const [selectedYear, setSelectedYear] = useState(initialYearMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(initialYearMonth.month);
  const [timeRange, setTimeRange] = useState<
    "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  >(rangeParam || "current-month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

  const handleTimeRangeChange = (range:
    "current-month" | "last-month" | "last-3-months" | "year" | "custom"
  ) => {
    setTimeRange(range);
    const now = new Date();
    switch (range) {
      case "current-month":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case "last-month": {
        const last = new Date(now.getFullYear(), now.getMonth() - 1);
        setSelectedYear(last.getFullYear());
        setSelectedMonth(last.getMonth() + 1);
        break;
      }
      case "last-3-months":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case "year":
        setSelectedYear(now.getFullYear());
        setSelectedMonth(1);
        break;
    }
  };

  // fetch dashboard (selected range)
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  // fetch comparison (prev period) only when needed
  const { data: comparisonData } = useQuery({
    queryKey: ["/api/dashboard/comparison", selectedYear, selectedMonth, timeRange],
    queryFn: async () => {
      let compYear = selectedYear;
      let compMonth = selectedMonth;
      if (timeRange === "current-month") {
        const last = new Date(selectedYear, selectedMonth - 2);
        compYear = last.getFullYear();
        compMonth = last.getMonth() + 1;
      } else if (timeRange === "last-month") {
        const now = new Date();
        compYear = now.getFullYear();
        compMonth = now.getMonth() + 1;
      }
      const url = `/api/dashboard?year=${compYear}&month=${compMonth}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: timeRange === "current-month" || timeRange === "last-month",
  });

  // ---- shape data the way the UI needs ----
  const insuranceBreakdown = (dashboardData as any)?.insuranceBreakdown || {};
  const prevInsuranceBreakdown = (comparisonData as any)?.insuranceBreakdown || {};

  const providers = useMemo(() => {
    return Object.entries(insuranceBreakdown).map(([name, amt]) => ({
      name,
      usd: parseFloat(amt as string) || 0,
      prev: parseFloat((prevInsuranceBreakdown as any)[name] as string) || 0,
    })).sort((a, b) => b.usd - a.usd);
  }, [insuranceBreakdown, prevInsuranceBreakdown]);

  const totalUSD = providers.reduce((s, p) => s + p.usd, 0);
  const prevTotalUSD = Object.values(prevInsuranceBreakdown)
    .reduce((s: number, v: any) => s + (parseFloat(v as string) || 0), 0);
  const overallChange = prevTotalUSD > 0 ? ((totalUSD - prevTotalUSD) / prevTotalUSD) * 100 : 0;

  // donut chart data
  const donutData = providers.map(p => ({ name: p.name, value: p.usd }));

  const periodLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? `Year ${selectedYear}` :
    (customStartDate && customEndDate)
      ? `${format(customStartDate, "MMM d, yyyy")} — ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  // export CSV
  const exportCSV = () => {
    const rows = [["Provider", "Revenue (USD)", "Share (%)", "Prev Period (USD)"]];
    providers.forEach((p) => {
      const share = totalUSD ? ((p.usd / totalUSD) * 100).toFixed(1) : "0.0";
      rows.push([p.name, String(Math.round(p.usd)), share, String(Math.round(p.prev || 0))]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-providers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Insurance Providers</h1>
              <p className="text-slate-600 mt-1">Detailed breakdown by insurance provider</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-[140px]">
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
                      className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000 }}
                  >
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                  </PopoverContent>
                </Popover>

                <span aria-hidden className="text-muted-foreground">to</span>

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
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000 }}
                  >
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Button variant="outline" className="h-9" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">Insurance Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">USD {fmtUSD(totalUSD)}</p>
                <p className="text-xs text-slate-500">{periodLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{providers.length}</p>
                <p className="text-xs text-slate-500">with transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                {overallChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs {timeRange === "current-month" ? "Last Month" :
                      timeRange === "last-month" ? "Current Month" : "Previous Period"}
                </p>
                <p className={cn("text-xl font-bold",
                  overallChange >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {overallChange >= 0 ? "+" : ""}{overallChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donut + Legend */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900">Share by Provider</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {providers.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-500">
              No insurance revenue in this period.
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(val: any, _name: any, p: any) => [`USD ${fmtUSD(Number(val))}`, p?.name]} />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={110}
                      paddingAngle={3}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                {providers.map((p, i) => {
                  const share = totalUSD ? (p.usd / totalUSD) * 100 : 0;
                  return (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto font-mono tabular-nums">USD {fmtUSD(p.usd)}</span>
                      <Badge variant="secondary" className="ml-2">{share.toFixed(1)}%</Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((p, idx) => {
          const share = totalUSD ? (p.usd / totalUSD) * 100 : 0;
          const change = p.prev > 0 ? ((p.usd - p.prev) / p.prev) * 100 : 0;

          return (
            <Card key={p.name} className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-50 p-1.5 rounded-md border border-purple-100">
                      <Shield className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="font-semibold text-slate-900">{p.name}</div>
                  </div>
                  <Badge variant="outline" className="rounded-full">Rank #{idx + 1}</Badge>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-slate-600">Revenue</div>
                  <div className="font-mono font-semibold text-slate-900">
                    USD {fmtUSD(p.usd)}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-violet-500"
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{share.toFixed(1)}% of total</div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="text-slate-600">
                    vs {timeRange === "current-month" ? "last month" :
                        timeRange === "last-month" ? "current month" : "previous period"}:
                  </div>
                  <div className={cn(
                    "font-medium",
                    change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-slate-500"
                  )}>
                    {change > 0 ? "+" : ""}{change.toFixed(1)}%
                  </div>
                </div>

                {p.prev > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs border-t border-slate-100 pt-1">
                    <span className="text-slate-500">Prev</span>
                    <span className="font-mono text-slate-500">USD {fmtUSD(p.prev)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {providers.length === 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Insurance Data</h3>
            <p className="text-slate-600">No insurance transactions found for the selected period.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
