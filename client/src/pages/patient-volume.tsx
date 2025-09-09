// client/src/pages/patient-volume.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, addDays, startOfWeek } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { api } from "@/lib/queryClient";

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

import { CalendarIcon, Plus, Table as TableIcon, BarChart2 } from "lucide-react";

// ---------------- Types ----------------
type VolumeRow = { date: string; count: number };

// ---------------- Helpers ----------------
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));

function clampToDay(d: Date | undefined): Date | undefined {
  if (!d) return d;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Build an array of ISO days between start and end (inclusive) */
function enumerateDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(format(cur, "yyyy-MM-dd"));
    cur = addDays(cur, 1);
  }
  return days;
}

/** Bucket daily rows into weekly rows when needed */
function bucketIfLongRange(rows: VolumeRow[], start: Date, end: Date) {
  const spanDays = differenceInCalendarDays(end, start) + 1;
  if (spanDays <= 62) {
    // Daily
    return {
      mode: "daily" as const,
      data: rows.map(r => ({
        label: format(new Date(r.date), "MMM d"),
        iso: r.date,
        count: r.count,
      })),
    };
  }

  // Weekly
  // Start weeks on Monday for readability
  const weekMap = new Map<string, number>();
  for (const r of rows) {
    const d = startOfWeek(new Date(r.date), { weekStartsOn: 1 });
    const key = format(d, "yyyy-MM-dd");
    weekMap.set(key, (weekMap.get(key) || 0) + (r.count || 0));
  }
  const weeks = Array.from(weekMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([iso, count]) => ({
      iso,
      count,
      label: `Week of ${format(new Date(iso), "MMM d")}`,
    }));

  return { mode: "weekly" as const, data: weeks };
}

/** Merge/normalize raw server payload(s) into {date,count} */
function normalizeRows(raw: any[], year: number, month: number): VolumeRow[] {
  const rows: VolumeRow[] = raw.map((r: any) => {
    const count = Number(
      r.count ?? r.volume ?? r.patients ?? r.value ?? r.total ?? r.number ?? 0
    ) || 0;

    const iso =
      r.date ||
      r.dateISO ||
      r.dayISO ||
      (r.day ? format(new Date(year, month - 1, Number(r.day)), "yyyy-MM-dd") : undefined);

    return iso ? { date: iso, count } : null;
  }).filter(Boolean) as VolumeRow[];

  // De-dup same date by summing
  const byDate = new Map<string, number>();
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) || 0) + (r.count || 0));
  }

  return Array.from(byDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------- Page ----------------
export default function PatientVolumePage() {
  // Range control
  const [mode, setMode] = useState<"current-month" | "last-month" | "last-3-months" | "last-6-months" | "custom">("current-month");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [view, setView] = useState<"chart" | "table">("chart");

  // Compute start/end based on mode
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const today = new Date();
    let start: Date, end: Date, label = "";

    if (mode === "current-month") {
      start = startOfMonth(today);
      end = endOfMonth(today);
      label = format(today, "MMMM yyyy");
    } else if (mode === "last-month") {
      const lm = subMonths(today, 1);
      start = startOfMonth(lm);
      end = endOfMonth(lm);
      label = `${format(lm, "MMMM yyyy")}`;
    } else if (mode === "last-3-months") {
      const three = subMonths(today, 2);
      start = startOfMonth(three);
      end = endOfMonth(today);
      label = `${format(three, "MMM yyyy")} – ${format(today, "MMM yyyy")}`;
    } else if (mode === "last-6-months") {
      const six = subMonths(today, 5);
      start = startOfMonth(six);
      end = endOfMonth(today);
      label = `${format(six, "MMM yyyy")} – ${format(today, "MMM yyyy")}`;
    } else {
      const s = clampToDay(customStart);
      const e = clampToDay(customEnd);
      start = s ?? startOfMonth(today);
      end = e ?? endOfMonth(today);
      label =
        s && e
          ? `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
          : "Custom range";
    }

    return { startDate: start, endDate: end, periodLabel: label };
  }, [mode, customStart, customEnd]);

  // ---------------- Data fetch (prod-safe) ----------------
  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ["/api/patient-volume", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async (): Promise<VolumeRow[]> => {
      const y = startDate.getFullYear();
      const m = startDate.getMonth() + 1;

      const urls = [
        `/api/patient-volume?start=${format(startDate, "yyyy-MM-dd")}&end=${format(endDate, "yyyy-MM-dd")}`,
        `/api/patient-volume/${y}/${m}`,
        `/api/patient-volume?year=${y}&month=${m}`,
      ];

      let lastErr: any = null;

      for (const url of urls) {
        try {
          const resp = await api.get(url);
          const raw = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? resp.data ?? [];
          const normalized = normalizeRows(raw, y, m);

          // Fill missing days with zeros inside selected range
          const allDays = enumerateDays(startDate, endDate);
          const byDate = new Map(normalized.map(d => [d.date, d.count]));
          const completed = allDays.map(iso => ({ date: iso, count: byDate.get(iso) || 0 }));

          return completed;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("No compatible patient-volume endpoint found");
    },
  });

  // ---------------- Metrics ----------------
  const total = useMemo(() => rows.reduce((s, r) => s + (r.count || 0), 0), [rows]);
  const activeDays = useMemo(() => rows.filter(r => r.count > 0).length, [rows]);
  const avgPerActive = activeDays ? total / activeDays : 0;
  const peak = useMemo(() => Math.max(0, ...rows.map(r => r.count || 0)), [rows]);
  const peakDay = rows.find(r => r.count === peak);

  // ---------------- Chart Data ----------------
  const chartPrep = useMemo(() => bucketIfLongRange(rows, startDate, endDate), [rows, startDate, endDate]);

  // X-axis tick policy
  const xtickFmt = (val: string) => val;

  // ---------------- UI ----------------
  return (
    <div className="p-6">
      {/* Header / Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={mode} onValueChange={(v: any) => setMode(v)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current-month">Current Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            <SelectItem value="last-6-months">Last 6 Months</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>

        {mode === "custom" && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("h-9 justify-start text-left font-normal", !customStart && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStart ? format(customStart, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={8} className="w-auto p-2">
                <DatePicker
                  mode="single"
                  numberOfMonths={1}
                  selected={customStart}
                  onSelect={setCustomStart}
                />
              </PopoverContent>
            </Popover>

            <span className="text-slate-500">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("h-9 justify-start text-left font-normal", !customEnd && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEnd ? format(customEnd, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={8} className="w-auto p-2">
                <DatePicker
                  mode="single"
                  numberOfMonths={1}
                  selected={customEnd}
                  onSelect={setCustomEnd}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={view === "chart" ? "default" : "outline"}
            className="h-9"
            onClick={() => setView("chart")}
          >
            <BarChart2 className="h-4 w-4 mr-2" />
            Chart
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            className="h-9"
            onClick={() => setView("table")}
          >
            <TableIcon className="h-4 w-4 mr-2" />
            Table
          </Button>
          <Button className="h-9">
            <Plus className="h-4 w-4 mr-2" />
            Add Volume
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Patients</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{nf0.format(total)}</p>
            <p className="text-xs text-slate-500 mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Average / Active Day</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{nf1.format(avgPerActive)}</p>
            <p className="text-xs text-slate-500 mt-1">{activeDays} active {activeDays === 1 ? "day" : "days"}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Peak Day</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-xl font-semibold tabular-nums">{nf0.format(peak)}</p>
              <span className="text-xs rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">Peak</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{peakDay ? format(new Date(peakDay.date), "MMM d, yyyy") : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4">
          {view === "chart" ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartPrep.data}
                  margin={{ top: 8, right: 12, left: 8, bottom: 28 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" strokeWidth={0.5} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={xtickFmt}
                    interval="preserveStartEnd"
                    height={40}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#0f172a" }}
                    tickFormatter={kfmt}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => nf0.format(Number(v || 0))}
                    labelFormatter={(l: any) => l}
                    wrapperStyle={{ outline: "none" }}
                  />
                  <Bar dataKey="count" name={chartPrep.mode === "weekly" ? "Patients / week" : "Patients / day"} fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px] border border-slate-100 rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Patients</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.date} className="border-t border-slate-100">
                      <td className="px-4 py-2">{format(new Date(r.date), "EEE, MMM d, yyyy")}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{nf0.format(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{nf0.format(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {(isLoading || isFetching) && (
            <div className="mt-3 text-xs text-slate-500">Loading…</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
