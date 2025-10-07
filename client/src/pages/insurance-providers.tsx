import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/queryClient";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from "recharts";

/* ------------------------------ settings ------------------------------ */
const REVENUE_METRIC: "paid" | "claimed" = "paid"; // change to "claimed" if you want billed amounts
const CURRENCY = "USD"; // pass ?currency=USD to the backend; change to "SSP" if you need that view

/* -------------------------------- util -------------------------------- */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const BASE_COLORS = ["#6366F1","#22C55E","#F59E0B","#06B6D4","#EF4444","#A855F7","#84CC16","#10B981","#F97316","#14B8A6"];
const toRGBA = (h: string, a: number) => {
  const x = h.replace("#",""); const r = parseInt(x.slice(0,2),16), g = parseInt(x.slice(2,4),16), b = parseInt(x.slice(4,6),16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const MAX_SEGMENTS = 7;

type TimeRange = "current-month" | "last-month" | "last-3-months" | "year" | "month-select" | "custom";

const isoOnly = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0,10);
const monthStart = (y: number, m1: number) => new Date(Date.UTC(y, m1 - 1, 1));
const monthEnd   = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0));
const addMonthsUTC = (y:number,m1:number,delta:number) => { const d=new Date(Date.UTC(y,m1-1+delta,1)); return {y:d.getUTCFullYear(), m1:d.getUTCMonth()+1}; };

/* ------------------------------ component ----------------------------- */
export default function InsuranceProvidersPage() {
  const url = new URLSearchParams(window.location.search);
  const rangeParam = (url.get("range") || "current-month") as TimeRange;
  const startDateParam = url.get("startDate");
  const endDateParam   = url.get("endDate");
  const yearParam  = url.get("year");
  const monthParam = url.get("month");

  const now = new Date();
  const getInitialYearMonth = () => {
    if (yearParam && monthParam) return { year: parseInt(yearParam), month: parseInt(monthParam) };
    if (rangeParam === "last-month") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { year: lm.getFullYear(), month: lm.getMonth() + 1 };
    }
    if (rangeParam === "year") return { year: now.getFullYear(), month: 1 };
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const initial = getInitialYearMonth();
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [timeRange, setTimeRange] = useState<TimeRange>(rangeParam);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startDateParam ? new Date(startDateParam) : undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endDateParam ? new Date(endDateParam) : undefined);

  const months = [
    { label: "January", value: 1 }, { label: "February", value: 2 }, { label: "March", value: 3 },
    { label: "April", value: 4 }, { label: "May", value: 5 }, { label: "June", value: 6 },
    { label: "July", value: 7 }, { label: "August", value: 8 }, { label: "September", value: 9 },
    { label: "October", value: 10 }, { label: "November", value: 11 }, { label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const thisYear = now.getFullYear();
  const years = [thisYear, thisYear-1, thisYear-2];

  const handleTimeRangeChange = (r: TimeRange) => {
    setTimeRange(r);
    const n = new Date();
    if (r === "current-month") { setSelectedYear(n.getFullYear()); setSelectedMonth(n.getMonth()+1); }
    else if (r === "last-month") { const lm = new Date(n.getFullYear(), n.getMonth()-1, 1); setSelectedYear(lm.getFullYear()); setSelectedMonth(lm.getMonth()+1); }
    else if (r === "last-3-months") { setSelectedYear(n.getFullYear()); setSelectedMonth(n.getMonth()+1); }
    else if (r === "year") { setSelectedYear(n.getFullYear()); setSelectedMonth(1); }
  };

  /* ------------------------- compute date windows ------------------------ */
  const { startISO, endISO, prevStartISO, prevEndISO } = useMemo(() => {
    let start: Date, end: Date, pStart: Date, pEnd: Date;

    if (timeRange === "custom" && customStartDate && customEndDate) {
      start = new Date(Date.UTC(customStartDate.getFullYear(), customStartDate.getMonth(), customStartDate.getDate()));
      end   = new Date(Date.UTC(customEndDate.getFullYear(), customEndDate.getMonth(), customEndDate.getDate()));
      const msSpan = end.getTime() - start.getTime() + 86400000;
      pEnd = new Date(start.getTime() - 86400000);
      pStart = new Date(pEnd.getTime() - (msSpan - 86400000));
    } else if (timeRange === "last-3-months") {
      end = monthEnd(selectedYear, selectedMonth);
      const a = addMonthsUTC(selectedYear, selectedMonth, -2);
      start = monthStart(a.y, a.m1);
      const b = addMonthsUTC(selectedYear, selectedMonth, -3);
      const c = addMonthsUTC(selectedYear, selectedMonth, -5);
      pEnd = monthEnd(b.y, b.m1); pStart = monthStart(c.y, c.m1);
    } else if (timeRange === "year") {
      start = monthStart(selectedYear, 1); end = monthEnd(selectedYear, 12);
      pStart = monthStart(selectedYear - 1, 1); pEnd = monthEnd(selectedYear - 1, 12);
    } else {
      start = monthStart(selectedYear, selectedMonth); end = monthEnd(selectedYear, selectedMonth);
      const pm = addMonthsUTC(selectedYear, selectedMonth, -1);
      pStart = monthStart(pm.y, pm.m1); pEnd = monthEnd(pm.y, pm.m1);
    }
    return { startISO: isoOnly(start), endISO: isoOnly(end), prevStartISO: isoOnly(pStart), prevEndISO: isoOnly(pEnd) };
  }, [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  /* ------------------------------ queries ------------------------------- */
  type BalanceRow = { providerId: string; providerName: string; claimed: number; paid: number; balance: number };
  type BalancesResponse = { providers: BalanceRow[]; claims: any[] };

  const { data: balances } = useQuery<BalancesResponse>({
    queryKey: ["/api/insurance-balances", startISO, endISO, CURRENCY],
    queryFn: async () => {
      const params = new URLSearchParams({ start: startISO, end: endISO, currency: CURRENCY });
      const { data } = await api.get(`/api/insurance-balances?${params.toString()}`);
      return data;
    },
  });

  // fallback to /api/dashboard breakdown for the same period
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, startISO, endISO],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange === "month-select" ? "current-month" : timeRange}`;
      if (timeRange === "custom") url += `&startDate=${startISO}&endDate=${endISO}`;
      const { data } = await api.get(url);
      return data;
    },
  });

  /* ------------------------------ transform ----------------------------- */
  const primary = useMemo(() => {
    const rows = balances?.providers ?? [];
    const items = rows
      .map(r => ({ name: r.providerName, usd: Number((r as any)[REVENUE_METRIC]) || 0 }))
      .filter(r => r.usd > 0)
      .sort((a, b) => b.usd - a.usd);
    return { items, total: items.reduce((s, x) => s + x.usd, 0) };
  }, [balances]);

  const fallback = useMemo(() => {
    const bd = (dashboardData?.insuranceBreakdown || {}) as Record<string, number>;
    const items = Object.entries(bd)
      .map(([name, v]) => ({ name, usd: Number(v) || 0 }))
      .filter(r => r.usd > 0)
      .sort((a, b) => b.usd - a.usd);
    return { items, total: items.reduce((s, x) => s + x.usd, 0) };
  }, [dashboardData]);

  // choose data source
  const providers = primary.items.length ? primary.items : fallback.items;
  const totalSelectedUSD = primary.items.length ? primary.total : fallback.total;

  // comparison window
  const { data: prevBalances } = useQuery<BalancesResponse>({
    queryKey: ["/api/insurance-balances/prev", prevStartISO, prevEndISO, CURRENCY],
    queryFn: async () => {
      const params = new URLSearchParams({ start: prevStartISO, end: prevEndISO, currency: CURRENCY });
      const { data } = await api.get(`/api/insurance-balances?${params.toString()}`);
      return data;
    },
    enabled: !!prevStartISO && !!prevEndISO,
  });

  const prevTotalUSD = useMemo(() => {
    if (prevBalances?.providers?.length) {
      return prevBalances.providers.reduce((s, r) => s + (Number((r as any)[REVENUE_METRIC]) || 0), 0);
    }
    const prevBD = (dashboardData?.previousInsuranceBreakdown || {}) as Record<string, number>;
    return Object.values(prevBD).reduce((s, v) => s + (Number(v) || 0), 0);
  }, [prevBalances, dashboardData]);

  const overallChange = prevTotalUSD > 0 ? ((totalSelectedUSD - prevTotalUSD) / prevTotalUSD) * 100 : 0;

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    providers.forEach((p, i) => { m[p.name] = BASE_COLORS[i % BASE_COLORS.length]; });
    m["Other"] = "#CBD5E1"; return m;
  }, [providers]);

  const donutData = useMemo(() => {
    if (!providers.length) return [];
    const top = providers.slice(0, MAX_SEGMENTS);
    const leftover = providers.slice(MAX_SEGMENTS);
    const otherTotal = leftover.reduce((s, p) => s + p.usd, 0);
    const data = [...top];
    if (otherTotal > 0) data.push({ name: "Other", usd: otherTotal });
    return data.map(d => ({ name: d.name, value: d.usd }));
  }, [providers]);

  const donutLegend = donutData.map(d => ({
    name: d.name, usd: d.value,
    pct: totalSelectedUSD > 0 ? (d.value / totalSelectedUSD) * 100 : 0,
    color: colorMap[d.name],
  }));

  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    timeRange === "custom" && customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  /* -------------------------------- render ------------------------------- */
  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      <header className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-start gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">Insurance<br className="hidden md:block" /> Providers</h1>
              <p className="text-slate-600 mt-1 md:mt-2">Detailed breakdown · {headerLabel}</p>
            </div>
          </div>

          <div className="relative z-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="hidden md:block w-[280px]" aria-hidden="true" />
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
                <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
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
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                      <SelectTrigger className="h-9 w-full sm:w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                      <SelectTrigger className="h-9 w-full sm:w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {timeRange === "custom" && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-9 justify-start text-left font-normal w-full sm:w-auto", !customStartDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl" style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}>
                        <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                      </PopoverContent>
                    </Popover>

                    <span aria-hidden className="text-muted-foreground mx-1 hidden sm:inline">to</span>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-9 justify-start text-left font-normal w-full sm:w-auto", !customEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl" style={{ zIndex: 50000 }} avoidCollisions collisionPadding={15}>
                        <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Overview */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold text-slate-900">Insurance Revenue Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg"><Shield className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">USD {nf0.format(Math.round(totalSelectedUSD))}</p>
                <p className="text-xs text-slate-500">{headerLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{providers.length}</p>
                <p className="text-xs text-slate-500">with {REVENUE_METRIC}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                {overallChange >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs {timeRange === "current-month" ? "Last Month" :
                      timeRange === "last-month"   ? "Current Month" :
                      timeRange === "last-3-months" ? "Previous 3 Months" :
                      timeRange === "year" ? "Previous Year" : "Previous Period"}
                </p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {overallChange >= 0 ? "+" : ""}{nf1.format(overallChange)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share by Provider */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1"><CardTitle className="text-lg font-semibold text-slate-900">Share by Provider</CardTitle></CardHeader>
        <CardContent className="pt-2">
          {providers.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No insurance data for this period.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as any;
                      const pct = totalSelectedUSD > 0 ? ((p.value / totalSelectedUSD) * 100).toFixed(1) : "0.0";
                      return (
                        <div className="bg-white border border-slate-200 rounded-md shadow px-3 py-2 text-sm">
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-slate-600">USD {nf0.format(Math.round(p.value))} · {pct}%</div>
                        </div>
                      );
                    }}/>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={80} outerRadius={120} stroke="#fff" strokeWidth={2}>
                      {donutData.map(d => <Cell key={d.name} fill={colorMap[d.name]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {donutLegend.map(x => (
                  <div key={x.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />
                    <span className="text-slate-800">{x.name}</span>
                    <span className="ml-auto text-slate-600">USD {nf0.format(Math.round(x.usd))}</span>
                    <span className="w-14 text-right text-slate-500">{nf1.format(x.pct)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((p, idx) => {
          const color = BASE_COLORS[idx % BASE_COLORS.length];
          const pct = totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;
          return (
            <Card key={p.name} className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: toRGBA(color, 0.12) }}>
                      <Shield className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{p.name}</h3>
                      <Badge variant="secondary" style={{ background: toRGBA(color, 0.12), color, borderColor: toRGBA(color, 0.24) }} className="text-xs">
                        {nf1.format(pct)}% of total
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Rank #{idx + 1}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Revenue</span>
                    <span className="font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(p.usd))}</span>
                  </div>
                  <div className="h-2 w-full rounded-full" style={{ background: toRGBA(color, 0.12) }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
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
            <p className="text-slate-600">No insurance {REVENUE_METRIC} found for the selected period.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
