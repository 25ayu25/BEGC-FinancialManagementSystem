import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, startOfMonth, endOfMonth, differenceInCalendarDays } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { api } from "@/lib/queryClient";
import { useDateFilter } from "@/context/date-filter-context";

import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ------------------ Helpers ------------------

type VolumeRow = {
  date: string;   // ISO "yyyy-MM-dd"
  count: number;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));

function labelForBucket(dateISO: string, bucket: "day" | "week" | "month") {
  const d = parseISO(dateISO);
  if (bucket === "day") return format(d, "MMM d");
  if (bucket === "week") return `Wk ${format(d, "I")}`; // ISO week number
  return format(d, "MMM yyyy");
}

function bucketKey(d: Date, bucket: "day" | "week" | "month") {
  if (bucket === "day") return format(d, "yyyy-MM-dd");
  if (bucket === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(startOfMonth(d), "yyyy-MM-dd");
}

// ------------------ Page ------------------

export default function PatientVolume() {
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

  const [view, setView] = useState<"chart" | "table">("chart");

  // Build API URL
  const { startDate, endDate } = useMemo(() => {
    if (timeRange === "custom" && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    // use the same month logic you use elsewhere
    const s = new Date(selectedYear, selectedMonth - 1, 1);
    const e = endOfMonth(s);
    return { startDate: s, endDate: e };
  }, [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["/api/patient-volume", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      const url = `/api/patient-volume?start=${format(startDate!, "yyyy-MM-dd")}&end=${format(
        endDate!,
        "yyyy-MM-dd"
      )}`;
      const resp = await api.get(url);
      return (resp.data || []) as VolumeRow[];
    },
    enabled: !!startDate && !!endDate,
  });

  // Totals & KPIs
  const totalPatients = rows.reduce((s, r) => s + (r.count || 0), 0);
  const daysWithData = rows.filter((r) => r.count > 0).length;
  const avgPerDay = daysWithData ? Math.round(totalPatients / daysWithData) : 0;
  const peak = rows.reduce((max, r) => (r.count > max.count ? r : max), { date: "", count: 0 });

  // Decide granularity based on duration
  const durationDays = startDate && endDate ? differenceInCalendarDays(endDate, startDate) + 1 : 0;
  const bucket: "day" | "week" | "month" = durationDays <= 45 ? "day" : durationDays <= 180 ? "week" : "month";

  // Aggregate
  const series = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const d = parseISO(r.date);
      const key = bucketKey(d, bucket);
      map.set(key, (map.get(key) || 0) + (r.count || 0));
    });
    const sorted = Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([dateISO, count]) => ({
        dateISO,
        label: labelForBucket(dateISO, bucket),
        count,
      }));
    return sorted;
  }, [rows, bucket]);

  // Group rows by month for the table
  const tableGroups = useMemo(() => {
    const groups: Record<string, VolumeRow[]> = {};
    for (const r of rows) {
      const m = format(parseISO(r.date), "MMMM yyyy");
      (groups[m] ||= []).push(r);
    }
    // sort days inside month
    Object.values(groups).forEach((arr) => arr.sort((a, b) => (a.date < b.date ? -1 : 1)));
    return Object.entries(groups).sort((a, b) => {
      const da = parseISO(a[1][0].date);
      const db = parseISO(b[1][0].date);
      return da.getTime() - db.getTime();
    });
  }, [rows]);

  // UI helpers
  const formatYAxis = (v: number) => kfmt(v);

  const ChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-slate-200 rounded-md shadow-sm text-sm">
        <div className="font-semibold text-slate-900">{p.label}</div>
        <div className="text-slate-700 mt-1 font-mono">Patients {nf0.format(p.count)}</div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-sm text-slate-500">Monthly summary · {periodLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
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
                <PopoverContent className="p-2 w-[280px]">
                  <DatePicker
                    mode="single"
                    numberOfMonths={1}
                    selected={customStartDate}
                    onSelect={(d) => setCustomRange(d ?? undefined, customEndDate)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-slate-400">to</span>

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
                <PopoverContent className="p-2 w-[280px]">
                  <DatePicker
                    mode="single"
                    numberOfMonths={1}
                    selected={customEndDate}
                    onSelect={(d) => setCustomRange(customStartDate, d ?? undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="ml-2 inline-flex rounded-lg border border-slate-200 p-0.5">
            <Button variant={view === "chart" ? "default" : "ghost"} size="sm" onClick={() => setView("chart")}>
              Chart
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")}>
              Table
            </Button>
          </div>

          <Button className="ml-2">
            <Plus className="mr-2 h-4 w-4" />
            Add Volume
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-slate-500 text-xs">Total Patients</div>
            <div className="text-xl font-semibold mt-1 font-mono tabular-nums">{nf0.format(totalPatients)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-slate-500 text-xs">Average / Active Day</div>
            <div className="text-xl font-semibold mt-1 font-mono tabular-nums">{nf0.format(avgPerDay)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-slate-500 text-xs">Peak Day</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="text-xl font-semibold font-mono tabular-nums">{nf0.format(peak.count)}</div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Peak</Badge>
            </div>
            {peak.date && <div className="text-xs text-slate-500 mt-1">{format(parseISO(peak.date), "PP")}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Chart or Table */}
      {view === "chart" ? (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Patient Volume — {bucket === "day" ? "Daily" : bucket === "week" ? "Weekly" : "Monthly"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 16, right: 16, left: 8, bottom: 24 }} barCategoryGap="25%" barGap={6}>
                  <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    height={40}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={formatYAxis}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Patients" fill="#0ea5e9" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Patient Volume — Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {tableGroups.map(([monthLabel, items]) => {
                const monthTotal = items.reduce((s, r) => s + r.count, 0);
                return (
                  <details key={monthLabel} className="group">
                    <summary className="flex items-center justify-between py-3 cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-medium">{monthLabel}</span>
                        <Badge variant="outline" className="ml-2">Total {nf0.format(monthTotal)}</Badge>
                      </div>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="pb-3">
                      {items.map((r) => (
                        <div key={r.date} className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-50">
                          <div>
                            <div className="font-medium text-slate-800">{nf0.format(r.count)} patients</div>
                            <div className="text-xs text-slate-500">{format(parseISO(r.date), "PP")}</div>
                          </div>
                          <button className="text-red-500 hover:text-red-600 p-1" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
              {tableGroups.length === 0 && !isLoading && (
                <div className="py-10 text-center text-slate-500">No records in this range</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
