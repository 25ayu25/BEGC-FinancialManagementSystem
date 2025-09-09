import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth, endOfMonth, subMonths, addMonths, format,
  isWithinInterval, addDays, differenceInCalendarDays, startOfWeek
} from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import { api, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

import {
  CalendarIcon, Users, Plus, Trash2, BarChart2, Table as TableIcon
} from "lucide-react";

/* ----------------------------- Types & helpers ---------------------------- */

type PatientVolume = {
  id: string;
  date: string;            // ISO date
  departmentId?: string;
  patientCount: number;
  notes?: string;
  recordedBy: string;
};

type Department = { id: string; code: string; name: string; };

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = (v: number) => (v >= 1000 ? `${nf0.format(Math.round(v / 1000))}k` : nf0.format(Math.round(v)));

const enumerateDays = (start: Date, end: Date) => {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(format(d, "yyyy-MM-dd"));
    d = addDays(d, 1);
  }
  return out;
};

const monthsBetween = (start: Date, end: Date) => {
  const res: { year: number; month: number }[] = [];
  const s = startOfMonth(start);
  const e = endOfMonth(end);
  let cur = new Date(s);
  while (cur <= e) {
    res.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur = addMonths(cur, 1);
  }
  return res;
};

function bucketForChart(rows: { date: string; total: number }[], start: Date, end: Date) {
  const span = differenceInCalendarDays(end, start) + 1;
  if (span <= 62) {
    return {
      mode: "daily" as const,
      data: rows.map(r => ({
        iso: r.date,
        label: format(new Date(r.date), "MMM d"),
        count: r.total,
      }))
    };
  }

  // Weekly buckets (week starts Mon)
  const map = new Map<string, number>();
  for (const r of rows) {
    const wk = startOfWeek(new Date(r.date), { weekStartsOn: 1 });
    const k = format(wk, "yyyy-MM-dd");
    map.set(k, (map.get(k) || 0) + r.total);
  }
  const weekly = Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([iso, total]) => ({
      iso,
      label: `Week of ${format(new Date(iso), "MMM d")}`,
      count: total,
    }));
  return { mode: "weekly" as const, data: weekly };
}

/* --------------------------------- Page ---------------------------------- */

export default function PatientVolumePage() {
  /* ------------------ URL -> initial view hand-off (compatible) ------------------ */
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const yearParam = params.get("year");
  const monthParam = params.get("month");
  const rangeParam = params.get("range"); // from dashboard
  // Keep old links working:
  const defaultMode: Mode =
    rangeParam === "last-3-months" ? "last-3-months" :
    rangeParam === "year" ? "last-6-months" : // your old "year" button can map to a longer bucketed view
    "current-month";

  const initialMode: Mode =
    viewParam === "monthly" && yearParam && monthParam ? "monthly-param" : defaultMode;

  const monthlyParamDate =
    viewParam === "monthly" && yearParam && monthParam
      ? new Date(Number(yearParam), Number(monthParam) - 1, 1)
      : new Date();

  /* ------------------------------ Local state ------------------------------ */
  type Mode = "current-month" | "last-month" | "last-3-months" | "last-6-months" | "custom" | "monthly-param";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [view, setView] = useState<"chart" | "table">("chart");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState<{ date: Date; patientCount: string; notes: string }>({
    date: new Date(),
    patientCount: "",
    notes: ""
  });

  /* ------------------------------ Date range ------------------------------ */
  const { startDate, endDate, label } = useMemo(() => {
    const today = new Date();
    let s: Date, e: Date, lbl = "";

    if (mode === "current-month") {
      s = startOfMonth(today);
      e = endOfMonth(today);
      lbl = format(today, "MMMM yyyy");
    } else if (mode === "last-month") {
      const prev = subMonths(today, 1);
      s = startOfMonth(prev);
      e = endOfMonth(prev);
      lbl = format(prev, "MMMM yyyy");
    } else if (mode === "last-3-months") {
      const three = subMonths(today, 2);
      s = startOfMonth(three);
      e = endOfMonth(today);
      lbl = `${format(three, "MMM yyyy")} – ${format(today, "MMM yyyy")}`;
    } else if (mode === "last-6-months") {
      const six = subMonths(today, 5);
      s = startOfMonth(six);
      e = endOfMonth(today);
      lbl = `${format(six, "MMM yyyy")} – ${format(today, "MMM yyyy")}`;
    } else if (mode === "monthly-param") {
      s = startOfMonth(monthlyParamDate);
      e = endOfMonth(monthlyParamDate);
      lbl = format(monthlyParamDate, "MMMM yyyy");
    } else {
      s = customStart ?? startOfMonth(today);
      e = customEnd ?? endOfMonth(today);
      lbl = (customStart && customEnd)
        ? `${format(customStart, "MMM d, yyyy")} – ${format(customEnd, "MMM d, yyyy")}`
        : "Custom range";
    }

    return { startDate: s, endDate: e, label: lbl };
  }, [mode, customStart, customEnd]);

  /* --------------------------------- Fetch -------------------------------- */
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: rawRows = [], isLoading, isFetching } = useQuery({
    queryKey: ["patient-volume-range", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async (): Promise<PatientVolume[]> => {
      // Primary strategy: fetch each month using your existing endpoint
      const months = monthsBetween(startDate, endDate);
      const all: PatientVolume[] = [];

      for (const m of months) {
        try {
          const resp = await api.get(`/api/patient-volume/period/${m.year}/${m.month}`);
          if (Array.isArray(resp.data)) all.push(...resp.data);
        } catch (err) {
          // ignore; we'll try fallback below after loop
        }
      }

      if (all.length > 0) {
        // Filter to the exact range
        return all.filter(r =>
          isWithinInterval(new Date(r.date), { start: startDate, end: endDate })
        );
      }

      // Fallback: try a start/end endpoint if your prod exposes it
      try {
        const resp = await api.get(
          `/api/patient-volume?start=${format(startDate, "yyyy-MM-dd")}&end=${format(endDate, "yyyy-MM-dd")}`
        );
        const data = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];
        return data as PatientVolume[];
      } catch {
        return []; // nothing available
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  /* ------------------------------- Transform ------------------------------- */
  const dailyTotals = useMemo(() => {
    // Sum by date, then fill missing days
    const map = new Map<string, number>();
    for (const r of rawRows) {
      const iso = format(new Date(r.date), "yyyy-MM-dd");
      map.set(iso, (map.get(iso) || 0) + (Number(r.patientCount) || 0));
    }

    const allDays = enumerateDays(startDate, endDate);
    return allDays.map(iso => ({
      date: iso,
      total: map.get(iso) || 0,
    }));
  }, [rawRows, startDate, endDate]);

  const kpis = useMemo(() => {
    const total = dailyTotals.reduce((s, r) => s + r.total, 0);
    const active = dailyTotals.filter(r => r.total > 0).length;
    const avgActive = active ? total / active : 0;
    const peak = Math.max(0, ...dailyTotals.map(r => r.total));
    const peakDay = dailyTotals.find(r => r.total === peak)?.date;
    return { total, active, avgActive, peak, peakDay };
  }, [dailyTotals]);

  const chart = useMemo(() => bucketForChart(dailyTotals, startDate, endDate), [dailyTotals, startDate, endDate]);

  /* ----------------------------- Add / Delete ------------------------------ */
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-volume-range"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded successfully" });
      setShowAdd(false);
      setNewEntry({ date: new Date(), patientCount: "", notes: "" });
    },
    onError: () => toast({ title: "Failed to record patient volume", variant: "destructive" })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patient-volume/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-volume-range"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume record deleted" });
    },
    onError: () => toast({ title: "Failed to delete record", variant: "destructive" })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(newEntry.patientCount);
    if (Number.isNaN(n) || n < 0) {
      toast({ title: "Please enter a valid patient count", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      date: newEntry.date.toISOString(),
      departmentId: null,
      patientCount: n,
      notes: newEntry.notes || null,
    });
  };

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">Monthly & multi-period summary</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v: any) => setMode(v)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
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
                <Button variant="outline" className={cn("h-9", !customStart && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStart ? format(customStart, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={8} className="w-auto p-2">
                <DatePicker
                  mode="single"
                  numberOfMonths={1}
                  selected={customStart}
                  onSelect={(d) => d && setCustomStart(d)}
                />
              </PopoverContent>
            </Popover>

            <span className="text-slate-500">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9", !customEnd && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customEnd ? format(customEnd, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={8} className="w-auto p-2">
                <DatePicker
                  mode="single"
                  numberOfMonths={1}
                  selected={customEnd}
                  onSelect={(d) => d && setCustomEnd(d)}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant={view === "chart" ? "default" : "outline"} onClick={() => setView("chart")} className="h-9">
            <BarChart2 className="h-4 w-4 mr-2" />
            Chart
          </Button>
          <Button variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")} className="h-9">
            <TableIcon className="h-4 w-4 mr-2" />
            Table
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Patients</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{nf0.format(kpis.total)}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Average / Active Day</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{nf1.format(kpis.avgActive)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.active} active {kpis.active === 1 ? "day" : "days"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Peak Day</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-xl font-semibold tabular-nums">{nf0.format(kpis.peak)}</p>
              <span className="text-xs rounded-full bg-orange-100 text-orange-700 px-2 py-0.5">Peak</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{kpis.peakDay ? format(new Date(kpis.peakDay), "MMM d, yyyy") : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main view */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Patient Volume — {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading…</div>
          ) : rawRows.length === 0 && dailyTotals.every(d => d.total === 0) ? (
            <div className="text-center py-12 text-slate-500">No patient volume recorded for this range.</div>
          ) : view === "chart" ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart.data}
                  margin={{ top: 8, right: 12, left: 8, bottom: 28 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" strokeWidth={0.5} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#64748b" }}
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
                  <Bar dataKey="count" name={chart.mode === "weekly" ? "Patients / week" : "Patients / day"} fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // Table view: daily totals first, then raw entries with delete
            <div className="space-y-6">
              {/* Daily totals */}
              <div className="overflow-auto max-h-[360px] border border-slate-100 rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Patients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTotals.map(r => (
                      <tr key={r.date} className="border-t border-slate-100">
                        <td className="px-4 py-2">{format(new Date(r.date), "EEE, MMM d, yyyy")}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{nf0.format(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-2 font-semibold">Total</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{nf0.format(kpis.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Raw entries (with delete) */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">Raw entries</h4>
                <div className="space-y-2 max-h-[360px] overflow-auto">
                  {rawRows
                    .slice()
                    .sort((a, b) => (a.date < b.date ? -1 : 1))
                    .map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium">{entry.patientCount} patients</div>
                          <div className="text-sm text-slate-600">
                            {format(new Date(entry.date), "PPP")}
                          </div>
                          {entry.notes && <div className="text-xs text-slate-500 mt-1">{entry.notes}</div>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          {(isFetching || isLoading) && <div className="mt-2 text-xs text-slate-500">Refreshing…</div>}
        </CardContent>
      </Card>

      {/* Add New Entry modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md shadow-2xl border-0 bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle>Add Patient Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newEntry.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" sideOffset={8} className="w-auto p-2 z-[60] bg-white border border-slate-200 shadow-2xl">
                      <DatePicker
                        mode="single"
                        selected={newEntry.date}
                        onSelect={(d) => d && setNewEntry(prev => ({ ...prev, date: d }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Patient Count</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEntry.patientCount}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, patientCount: e.target.value }))}
                    placeholder="Number of patients"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about the day…"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
