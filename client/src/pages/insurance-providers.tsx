import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import {
  ArrowLeft, Calendar as CalendarIcon, Shield, DollarSign,
  TrendingUp, TrendingDown,
} from "lucide-react";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
} from "recharts";

/* ----------------------------- helpers ----------------------------- */

type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const startOfMonth = (y: number, m1: number) => new Date(y, m1 - 1, 1);
const endOfMonth   = (y: number, m1: number) => new Date(y, m1, 0);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

const COLORS = ["#6366F1","#22C55E","#F59E0B","#06B6D4","#EF4444","#A855F7","#84CC16","#10B981","#F97316","#14B8A6"];

/* ------------------------------ page ------------------------------ */

export default function InsuranceProviders() {
  // independent filter state
  const now = new Date();
  const [timeRange, setTimeRange] = useState<TimeRange>("current-month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const months = [
    { label: "January", value: 1 }, { label: "February", value: 2 }, { label: "March", value: 3 },
    { label: "April", value: 4 },   { label: "May", value: 5 },      { label: "June", value: 6 },
    { label: "July", value: 7 },    { label: "August", value: 8 },   { label: "September", value: 9 },
    { label: "October", value: 10 },{ label: "November", value: 11 },{ label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const onRange = (r: TimeRange) => {
    setTimeRange(r);
    if (r === "current-month") {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
    }
    if (r === "last-month") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setSelectedYear(lm.getFullYear());
      setSelectedMonth(lm.getMonth() + 1);
    }
    if (r === "last-3-months" || r === "year") {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
    }
  };

  /* --- IMPORTANT: single source of truth for API params (matches UI) --- */
  const paramsString = useMemo(() => {
    const p = new URLSearchParams();
    switch (timeRange) {
      case "current-month":
      case "last-month":
      case "last-3-months":
      case "year":
        p.set("range", timeRange);
        break;
      case "month-select": {
        const s = startOfMonth(selectedYear, selectedMonth);
        const e = endOfMonth(selectedYear, selectedMonth);
        p.set("range", "custom");
        p.set("startDate", format(s, "yyyy-MM-dd"));
        p.set("endDate",   format(e, "yyyy-MM-dd"));
        break;
      }
      case "custom":
        p.set("range", "custom");
        if (customStartDate) p.set("startDate", format(customStartDate, "yyyy-MM-dd"));
        if (customEndDate)   p.set("endDate",   format(customEndDate,   "yyyy-MM-dd"));
        break;
    }
    return p.toString();
  }, [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  /* ----------------------------- queries ----------------------------- */
  // Using /api/dashboard because it already returns insuranceBreakdown in your app.
  const { data: dashboardData, isFetching } = useQuery({
    queryKey: ["/api/dashboard", paramsString],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?${paramsString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch insurance data");
      return res.json();
    },
  });

  // Optional: monthly series if your backend supports it (kept; uses same params)
  const { data: monthlySeries } = useQuery({
    queryKey: ["/api/insurance/monthly", paramsString],
    queryFn: async () => {
      const res = await fetch(`/api/insurance/monthly?${paramsString}`, { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  /* -------------------------- computed values -------------------------- */
  const breakdown: Record<string, number> =
    (dashboardData?.insuranceBreakdown as any) || {};
  const providers = Object.entries(breakdown)
    .map(([name, v]) => ({ name, usd: Number(v) || 0 }))
    .sort((a, b) => b.usd - a.usd);

  const totalUSD = providers.reduce((s, p) => s + p.usd, 0);

  const donutData = providers.slice(0, 7);
  if (providers.length > 7) {
    const other = providers.slice(7).reduce((s, p) => s + p.usd, 0);
    donutData.push({ name: "Other", usd: other });
  }

  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    (customStartDate && customEndDate)
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  /* ------------------------------- render ------------------------------- */

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
              <p className="text-slate-600 mt-1">Detailed breakdown · {headerLabel}</p>
            </div>
          </div>

          {/* RIGHT: filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeRange} onValueChange={onRange}>
              <SelectTrigger className="w-[160px] h-9">
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

            {timeRange === "month-select" && (
              <>
                <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {timeRange === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl">
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
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
                  <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl">
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false}
                      selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overview cards */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">Insurance Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg"><Shield className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">USD {nf0.format(Math.round(totalUSD))}</p>
                <p className="text-xs text-slate-500">{headerLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{providers.length}</p>
                <p className="text-xs text-slate-500">with transactions</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">{/* dummy change for illustration */}<TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-slate-600">vs Last Month</p>
                <p className="text-xl font-bold text-emerald-600">+0%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donut */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1">
          <CardTitle className="text-lg font-semibold text-slate-900">Share by Provider</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {providers.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              {isFetching ? "Loading…" : "No insurance data for this period."}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as any;
                        const pct = totalUSD > 0 ? ((p.value / totalUSD) * 100).toFixed(1) : "0.0";
                        return (
                          <div className="bg-white border border-slate-200 rounded-md shadow px-3 py-2 text-sm">
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="text-slate-600">USD {nf0.format(Math.round(p.value))} · {pct}%</div>
                          </div>
                        );
                      }}
                    />
                    <Pie data={donutData} dataKey="usd" nameKey="name" innerRadius={80} outerRadius={120} stroke="#fff" strokeWidth={2}>
                      {donutData.map((d, i) => (
                        <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {donutData.map((d, i) => {
                  const pct = totalUSD > 0 ? (d.usd / totalUSD) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-800">{d.name}</span>
                      <span className="ml-auto text-slate-600">USD {nf0.format(Math.round(d.usd))}</span>
                      <span className="w-14 text-right text-slate-500">{nf1.format(pct)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional monthly list (if your API returns it) */}
      {monthlySeries?.data?.length > 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardHeader><CardTitle>Insurance Revenue by Month</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-700 space-y-1">
              {monthlySeries.data.map((m: any) => (
                <li key={`${m.year}-${m.month}`}>
                  {m.month} {m.year}: USD {nf0.format(Math.round(m.usd))}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
