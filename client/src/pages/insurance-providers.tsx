/* insurance-providers.tsx — with monthly chart aligned to active range */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft,
  Calendar as CalendarIcon, Download,
} from "lucide-react";
import { Link } from "wouter";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/* ------------------------------ Helpers ------------------------------ */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const BASE_COLORS = [
  "#6366F1","#22C55E","#F59E0B","#06B6D4","#EF4444",
  "#A855F7","#84CC16","#10B981","#F97316","#14B8A6",
];

const toRGBA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const MAX_SEGMENTS = 7;
type TimeRange = "current-month" | "last-month" | "last-3-months" | "year" | "month-select" | "custom";

/* --------------------------- Component --------------------------- */

export default function InsuranceProvidersPage() {
  // URL params for deep links from dashboard
  const url = new URLSearchParams(window.location.search);
  const rangeParam = (url.get("range") || "current-month") as Exclude<TimeRange, "month-select">;
  const startDateParam = url.get("startDate");
  const endDateParam   = url.get("endDate");
  const yearParam  = url.get("year");
  const monthParam = url.get("month");

  const now = new Date();
  const getInitialYearMonth = () => {
    if (yearParam && monthParam) return { year: +yearParam, month: +monthParam };
    if (rangeParam === "last-month") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    if (rangeParam === "year") return { year: now.getFullYear(), month: 1 };
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const init = getInitialYearMonth();
  const [selectedYear, setSelectedYear] = useState(init.year);
  const [selectedMonth, setSelectedMonth] = useState(init.month);
  const [timeRange, setTimeRange] = useState<TimeRange>(rangeParam);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startDateParam ? new Date(startDateParam) : undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endDateParam ? new Date(endDateParam) : undefined);

  // month-select choices
  const thisYear = now.getFullYear();
  const years = useMemo(() => [thisYear, thisYear - 1, thisYear - 2], [thisYear]);
  const months = [
    { label: "January", value: 1 }, { label: "February", value: 2 }, { label: "March", value: 3 },
    { label: "April", value: 4 },   { label: "May", value: 5 },      { label: "June", value: 6 },
    { label: "July", value: 7 },    { label: "August", value: 8 },   { label: "September", value: 9 },
    { label: "October", value: 10 },{ label: "November", value: 11 },{ label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    const d = new Date();
    switch (range) {
      case "current-month": setSelectedYear(d.getFullYear()); setSelectedMonth(d.getMonth() + 1); break;
      case "last-month": { const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1); setSelectedYear(lm.getFullYear()); setSelectedMonth(lm.getMonth() + 1); break; }
      case "last-3-months": setSelectedYear(d.getFullYear()); setSelectedMonth(d.getMonth() + 1); break;
      case "year": setSelectedYear(d.getFullYear()); setSelectedMonth(1); break;
      case "month-select": /* user will choose */ break;
      case "custom": /* keep custom */ break;
    }
  };

  // When month-select is active, we still send range=current-month + explicit year/month
  const normalizedRange = timeRange === "month-select" ? "current-month" : timeRange;

  /* ------------------------------- Queries ------------------------------- */

  // Dashboard (for insuranceBreakdown used in donut + cards)
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, normalizedRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
  });

  // Comparison (used for % change text)
  const { data: comparisonData } = useQuery({
    queryKey: ["/api/dashboard/comparison", selectedYear, selectedMonth, normalizedRange],
    queryFn: async () => {
      let compYear = selectedYear, compMonth = selectedMonth;
      if (normalizedRange === "current-month") { const lm = new Date(selectedYear, selectedMonth - 2, 1); compYear = lm.getFullYear(); compMonth = lm.getMonth() + 1; }
      else if (normalizedRange === "last-month") { const t = new Date(); compYear = t.getFullYear(); compMonth = t.getMonth() + 1; }
      const res = await fetch(`/api/dashboard?year=${compYear}&month=${compMonth}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: normalizedRange === "current-month" || normalizedRange === "last-month",
  });

  // --- NEW: Monthly series aligned to the ACTIVE RANGE (not hardcoded to year) ---
  const { data: monthlySeries } = useQuery({
    queryKey: ["/api/insurance/monthly", selectedYear, selectedMonth, normalizedRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/insurance/monthly?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch monthly insurance data");
      return res.json(); // expected: { data: [{ year, month, usd }, ...] }
    },
  });

  /* --------------------------- Transformations --------------------------- */

  const insuranceBreakdown: Record<string, number> = (dashboardData?.insuranceBreakdown as any) || {};
  const prevInsuranceBreakdown: Record<string, number> = (comparisonData?.insuranceBreakdown as any) || {};

  const providers = useMemo(
    () => Object.entries(insuranceBreakdown)
      .map(([name, v]) => ({ name, usd: Number(v) || 0 }))
      .sort((a, b) => b.usd - a.usd),
    [insuranceBreakdown]
  );

  const totalSelectedUSD = providers.reduce((s, p) => s + p.usd, 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce((s, v) => s + (Number(v) || 0), 0);
  const overallChange = totalComparisonUSD > 0 ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100 : 0;

  // Build start/end months for the active window (cross-year safe)
  const period = useMemo(() => {
    const month0 = (m: number) => m - 1; // JS Date month
    if (timeRange === "custom" && customStartDate && customEndDate) {
      return { start: new Date(customStartDate.getFullYear(), customStartDate.getMonth(), 1),
               end:   new Date(customEndDate.getFullYear(),   customEndDate.getMonth(),   0) };
    }
    if (normalizedRange === "last-3-months") {
      const end = new Date(selectedYear, month0(selectedMonth), 0);
      const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
      return { start, end };
    }
    if (normalizedRange === "year") {
      return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31) };
    }
    // current-month, last-month, month-select
    const anchor = new Date(selectedYear, month0(selectedMonth), 1);
    if (normalizedRange === "last-month") {
      const last = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
      return { start: last, end: new Date(last.getFullYear(), last.getMonth() + 1, 0) };
    }
    return { start: anchor, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
  }, [timeRange, normalizedRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  // Expand to a list of (year,month) pairs in the period
  const monthPairs = useMemo(() => {
    const out: Array<{ y: number; m: number }> = [];
    let y = period.start.getFullYear();
    let m = period.start.getMonth() + 1;
    const yEnd = period.end.getFullYear();
    const mEnd = period.end.getMonth() + 1;
    while (y < yEnd || (y === yEnd && m <= mEnd)) {
      out.push({ y, m });
      m += 1;
      if (m === 13) { m = 1; y += 1; }
    }
    return out;
  }, [period]);

  // Map API rows to quick lookup
  const monthlyMap = useMemo(() => {
    const map = new Map<string, number>();
    const rows: Array<{ year: number; month: number; usd: number }> = (monthlySeries?.data || []) as any;
    for (const r of rows) map.set(`${r.year}-${r.month}`, Number(r.usd) || 0);
    return map;
  }, [monthlySeries]);

  // Final chart data for the active period
  const monthlyChartData = useMemo(
    () => monthPairs.map(({ y, m }) => ({
      key: `${y}-${m}`,
      label: `${monthShort[m - 1]}`,
      usd: monthlyMap.get(`${y}-${m}`) || 0,
    })),
    [monthPairs, monthlyMap]
  );

  const monthlyTotal = monthlyChartData.reduce((s, d) => s + (d.usd || 0), 0);
  const monthlyPeak  = Math.max(...monthlyChartData.map((d) => d.usd || 0), 0);
  const monthlyAvg   = monthlyChartData.length ? Math.round(monthlyTotal / monthlyChartData.length) : 0;

  const exportCSV = () => {
    const rows = [["Month", "USD"]];
    monthlyChartData.forEach((d) => rows.push([d.label, Math.round(d.usd || 0).toString()]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-monthly-${normalizedRange}-${selectedYear}-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* -------------------------- Donut + legend data -------------------------- */

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    providers.forEach((p, i) => { m[p.name] = BASE_COLORS[i % BASE_COLORS.length]; });
    m["Other"] = "#CBD5E1"; return m;
  }, [providers]);

  const donutData = useMemo(() => {
    if (!providers.length) return [];
    const top = providers.slice(0, MAX_SEGMENTS);
    const leftover = providers.slice(MAX_SEGMENTS);
    const other = leftover.reduce((s, p) => s + p.usd, 0);
    const data = [...top]; if (other > 0) data.push({ name: "Other", usd: other });
    return data.map((d) => ({ name: d.name, value: d.usd }));
  }, [providers]);

  const donutLegend = donutData.map((d) => ({
    name: d.name, usd: d.value,
    pct: totalSelectedUSD > 0 ? (d.value / totalSelectedUSD) * 100 : 0,
    color: colorMap[d.name],
  }));

  /* -------------------------------- Render -------------------------------- */

  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    timeRange === "custom" && customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}` :
      "Custom period";

  const periodTitle = (() => {
    const first = monthPairs[0], last = monthPairs[monthPairs.length - 1];
    if (!first || !last) return "";
    const sameYear = first.y === last.y;
    return sameYear
      ? `${monthShort[first.m - 1]} – ${monthShort[last.m - 1]} ${first.y}`
      : `${monthShort[first.m - 1]} ${first.y} – ${monthShort[last.m - 1]} ${last.y}`;
  })();

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

          {/* RIGHT: range + pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
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
                  <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
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
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
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
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overview */}
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
                <p className="text-xl font-bold text-slate-900">USD {nf0.format(Math.round(providers.reduce((s,p)=>s+p.usd,0)))}</p>
                <p className="text-xs text-slate-500">{headerLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-slate-600">Active Providers</p><p className="text-xl font-bold text-slate-900">{providers.length}</p><p className="text-xs text-slate-500">with transactions</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">{overallChange >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}</div>
              <div>
                <p className="text-sm text-slate-600">vs {normalizedRange === "current-month" ? "Last Month" : normalizedRange === "last-month" ? "Current Month" : "Previous Period"}</p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>{overallChange >= 0 ? "+" : ""}{nf1.format(overallChange)}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Insurance Totals (USD) — period-aware */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-1 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Monthly Insurance Totals (USD) — {periodTitle}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="pt-2">
          {monthlyChartData.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No monthly data for this period.</div>
          ) : (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="usdFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.6} vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#eef2f7" }} tick={{ fontSize: 12, fill: "#64748b" }} />
                    <YAxis tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v/1000)}k` : `${v}`)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as any;
                      return (
                        <div className="bg-white border border-slate-200 rounded-md shadow px-3 py-2 text-sm">
                          <div className="font-medium text-slate-900">{p.label}</div>
                          <div className="text-slate-600">USD {nf0.format(Math.round(p.usd || 0))}</div>
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="usd" stroke="#6366F1" strokeWidth={2} fill="url(#usdFill)" dot={{ r: 2 }} activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">TOTAL</div>
                  <div className="text-sm font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(monthlyTotal))}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">MONTHLY AVG</div>
                  <div className="text-sm font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(monthlyAvg))}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">PEAK MONTH</div>
                  <div className="text-sm font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(monthlyPeak))}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Share by Provider (Donut + Legend) */}
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
                    }} />
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={80} outerRadius={120} stroke="#fff" strokeWidth={2}>
                      {donutData.map((d) => <Cell key={d.name} fill={colorMap[d.name]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {donutLegend.map((x) => (
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

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {providers.map((p, idx) => {
          const prev = Number(prevInsuranceBreakdown[p.name] || 0);
          const change = prev > 0 ? ((p.usd - prev) / prev) * 100 : 0;
          const pct = totalSelectedUSD > 0 ? (p.usd / totalSelectedUSD) * 100 : 0;
          const color = colorMap[p.name];

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
                    <span className="text-sm text-slate-600">
                      {normalizedRange === "last-3-months" ? "Total (3 months)" : normalizedRange === "year" ? "Total (Year)" : "Revenue"}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">USD {nf0.format(Math.round(p.usd))}</span>
                  </div>

                  <div className="h-2 w-full rounded-full" style={{ background: toRGBA(color, 0.12) }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      vs {normalizedRange === "current-month" ? "Last Month" :
                          normalizedRange === "last-month" ? "Current Month" :
                          normalizedRange === "last-3-months" ? "Previous 3 Months" :
                          normalizedRange === "year" ? "Previous Year" : "Previous Period"}
                    </span>
                    <span className={`text-sm font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-slate-500"}`}>
                      {change > 0 ? "+" : ""}{nf1.format(change)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
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
