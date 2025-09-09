// client/src/pages/patient-volume.tsx  (or your current file name)
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format as dfFormat, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval } from "date-fns";
import { CalendarIcon, Users, Plus, Trash2, BarChart3, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { apiRequest, api } from "@/lib/queryClient";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface PatientVolume {
  id: string;
  date: string;
  departmentId?: string;
  patientCount: number;
  notes?: string;
  recordedBy: string;
}

export default function PatientVolumePage() {
  // --- URL params for deep-links from the dashboard ---
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get("view");               // 'monthly' | null
  const yearParam = urlParams.get("year");               // '2025'
  const monthParam = urlParams.get("month");             // '9'
  const dateParam = urlParams.get("date");               // '2025-09-06'
  const rangeParam = urlParams.get("range");             // 'last-3-months' | 'year' | null

  const isMonthlyView = viewParam === "monthly" && !!yearParam && !!monthParam;
  const isMultiPeriodView = rangeParam === "last-3-months" || rangeParam === "year";
  const shouldDefaultToMonthly = !dateParam && !isMonthlyView;

  // initial date
  const initialDate = dateParam
    ? new Date(`${dateParam}T12:00:00`)
    : isMonthlyView
      ? new Date(parseInt(yearParam as string, 10), parseInt(monthParam as string, 10) - 1, 1)
      : new Date();

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uiView, setUiView] = useState<"chart" | "table">("chart"); // toggle for monthly page section

  const [newEntry, setNewEntry] = useState({
    date: new Date(),
    patientCount: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  // --- Fetch data (single month, single day, or multi period) ---
  const { data: volumeData = [], isLoading } = useQuery<PatientVolume[]>({
    queryKey: isMultiPeriodView
      ? ["/api/patient-volume/multi-period", rangeParam, yearParam, monthParam]
      : isMonthlyView
        ? ["/api/patient-volume/period", selectedDate.getFullYear(), selectedDate.getMonth() + 1]
        : ["/api/patient-volume/period", selectedDate.getFullYear(), selectedDate.getMonth() + 1], // we show monthly by default
    queryFn: async () => {
      if (isMultiPeriodView) {
        const now = new Date();
        const months: Array<{ year: number; month: number }> = [];

        if (rangeParam === "last-3-months") {
          for (let i = 2; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
          }
        } else {
          // full year
          const y = parseInt(yearParam || String(now.getFullYear()), 10);
          for (let m = 1; m <= 12; m++) months.push({ year: y, month: m });
        }

        const all: PatientVolume[] = [];
        for (const { year, month } of months) {
          try {
            const r = await api.get(`/api/patient-volume/period/${year}/${month}`);
            if (Array.isArray(r.data)) all.push(...r.data);
          } catch (e) {
            console.warn("Fetch month failed:", year, month, e);
          }
        }
        return all;
      } else {
        const y = isMonthlyView ? parseInt(yearParam as string, 10) : selectedDate.getFullYear();
        const m = isMonthlyView ? parseInt(monthParam as string, 10) : selectedDate.getMonth() + 1;
        const r = await api.get(`/api/patient-volume/period/${y}/${m}`);
        return Array.isArray(r.data) ? r.data : [];
      }
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // --- Create / Delete ---
  const createVolumeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded successfully" });
      setShowAddForm(false);
      setNewEntry({ date: new Date(), patientCount: "", notes: "" });
    },
    onError: () => toast({ title: "Failed to record patient volume", variant: "destructive" }),
  });

  const deleteVolumeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patient-volume/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume record deleted" });
    },
    onError: () => toast({ title: "Failed to delete record", variant: "destructive" }),
  });

  // --- Month-aggregated helpers (strict 1..last-day; no "Aug 31") ---
  const mStart = startOfMonth(selectedDate);
  const mEnd = endOfMonth(selectedDate);

  // Index totals by ISO date
  const totalsByISO: Record<string, number> = useMemo(() => {
    const idx: Record<string, number> = {};
    (volumeData || []).forEach((r) => {
      const iso = dfFormat(new Date(r.date), "yyyy-MM-dd");
      idx[iso] = (idx[iso] ?? 0) + (r.patientCount ?? 0);
    });
    return idx;
  }, [volumeData]);

  // Build chart rows (month only)
  const chartData = useMemo(() => {
    return eachDayOfInterval({ start: mStart, end: mEnd }).map((d) => {
      const iso = dfFormat(d, "yyyy-MM-dd");
      return {
        dayNum: d.getDate(),                               // numeric tick
        dateISO: iso,
        label: dfFormat(d, "EEE, MMM d, yyyy"),            // tooltip label
        count: totalsByISO[iso] ?? 0,
      };
    });
  }, [mStart, mEnd, totalsByISO]);

  // Nice weekly ticks (numeric) + last day
  const weeklyTicks = useMemo(() => {
    const ticks = eachWeekOfInterval({ start: mStart, end: mEnd }, { weekStartsOn: 1 }).map((d) => d.getDate());
    const lastDay = mEnd.getDate();
    if (!ticks.includes(lastDay)) ticks.push(lastDay);
    return ticks;
  }, [mStart, mEnd]);

  // KPIs
  const totalPatients = (volumeData || []).reduce((s, r) => s + (r.patientCount ?? 0), 0);
  const activeDays = chartData.filter((d) => d.count > 0).length;
  const avgPerActive = activeDays ? (totalPatients / activeDays) : 0;
  const peak = chartData.reduce((p, d) => (d.count > p.count ? d : p), { dayNum: 0, dateISO: "", label: "", count: 0 });

  // Group for multi-period list
  const groupedByMonth: Record<string, { monthName: string; entries: PatientVolume[]; total: number }> = useMemo(() => {
    if (!isMultiPeriodView) return {};
    return (volumeData || []).reduce((acc, entry) => {
      const d = new Date(entry.date);
      const key = dfFormat(d, "yyyy-MM");
      if (!acc[key]) acc[key] = { monthName: dfFormat(d, "MMMM yyyy"), entries: [], total: 0 };
      acc[key].entries.push(entry);
      acc[key].total += entry.patientCount ?? 0;
      return acc;
    }, {} as Record<string, { monthName: string; entries: PatientVolume[]; total: number }>);
  }, [isMultiPeriodView, volumeData]);

  // Header labels (auto updates every month)
  const monthLabel = dfFormat(selectedDate, "MMMM yyyy");

  // Save form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(newEntry.patientCount, 10);
    if (Number.isNaN(n) || n < 0) {
      toast({ title: "Please enter a valid patient count", variant: "destructive" });
      return;
    }
    createVolumeMutation.mutate({
      date: newEntry.date.toISOString(),
      departmentId: null,
      patientCount: n,
      notes: newEntry.notes || null,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">
            {isMultiPeriodView
              ? rangeParam === "last-3-months"
                ? "Monthly & multi-period summary · Last 3 months"
                : `Monthly & multi-period summary · ${dfFormat(selectedDate, "yyyy")}`
              : "Monthly & multi-period summary"}
          </p>
        </div>

        <Button onClick={() => setShowAddForm(true)} className="bg-teal-600 hover:bg-teal-700" data-testid="button-add-volume">
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>

      {/* Small KPI strip (only meaningful for single-month view) */}
      {!isMultiPeriodView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Total Patients</p>
              <p className="text-xl font-semibold">{totalPatients}</p>
              <p className="text-xs text-slate-400">{monthLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Average / Active Day</p>
              <p className="text-xl font-semibold">{avgPerActive.toFixed(1)}</p>
              <p className="text-xs text-slate-400">{activeDays} active days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Peak Day</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold">{peak.count}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Peak</span>
              </div>
              <p className="text-xs text-slate-400">{peak.label || "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main section header — modernized (no long em-dash) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Patient Volume <span className="ml-1 text-slate-500 font-normal">• {monthLabel}</span>
          </h2>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />
        {!isMultiPeriodView && (
          <div className="flex items-center gap-2">
            <Button
              variant={uiView === "chart" ? "default" : "outline"}
              size="sm"
              className={cn("h-8", uiView === "chart" ? "bg-slate-900 hover:bg-slate-800 text-white" : "")}
              onClick={() => setUiView("chart")}
              title="Chart"
            >
              <BarChart3 className="w-4 h-4 mr-1" /> Chart
            </Button>
            <Button
              variant={uiView === "table" ? "default" : "outline"}
              size="sm"
              className={cn("h-8", uiView === "table" ? "bg-slate-900 hover:bg-slate-800 text-white" : "")}
              onClick={() => setUiView("table")}
              title="Table"
            >
              <Table className="w-4 h-4 mr-1" /> Table
            </Button>
          </div>
        )}
      </div>

      {/* Date picker + total (single month) */}
      {!isMultiPeriodView && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {dfFormat(selectedDate, "MMMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl" sideOffset={8} align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-slate-600">
              Total:&nbsp;<span className="font-semibold text-teal-600">{totalPatients}</span>&nbsp;patients
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : isMultiPeriodView ? (
            // Multi-period stacked lists by month
            <div className="space-y-4">
              {Object.entries(groupedByMonth)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, grp]) => (
                  <div key={key} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-slate-900">{grp.monthName}</h3>
                      <span className="text-lg font-semibold text-teal-600">{grp.total} patients</span>
                    </div>
                    <div className="space-y-2">
                      {grp.entries
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                            <span className="text-slate-600">{dfFormat(new Date(entry.date), "MMM d, yyyy")}</span>
                            <span className="font-medium">{entry.patientCount} patients</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : uiView === "chart" ? (
            // Chart view (month-only, numeric day ticks)
            chartData.length === 0 ? (
              <div className="text-center py-10 text-slate-500">No data this month</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 12, right: 8, left: 8, bottom: 24 }}
                    barGap={6}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" strokeWidth={0.3} opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="dayNum"
                      ticks={weeklyTicks}
                      tickFormatter={(v: number) => String(v)}
                      axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      height={32}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#0f766e" }}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${v} patients`, "Patients"]}
                      labelFormatter={(_, payload: any[]) => payload?.[0]?.payload?.label || ""}
                    />
                    <Bar
                      dataKey="count"
                      name="Patients"
                      fill="#14b8a6"
                      stroke="none"
                      barSize={24}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            // Table view (month-only)
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[1fr_100px_40px] bg-slate-50 text-xs font-medium text-slate-600 px-3 py-2">
                <div>Date</div>
                <div className="text-right">Patients</div>
                <div></div>
              </div>
              {chartData.map((d) => {
                const entry = (volumeData as PatientVolume[]).find(
                  (e) => dfFormat(new Date(e.date), "yyyy-MM-dd") === d.dateISO
                );
                return (
                  <div key={d.dateISO} className="grid grid-cols-[1fr_100px_40px] items-center px-3 py-2 border-t">
                    <div className="text-sm text-slate-700">{d.label}</div>
                    <div className="text-right font-medium">{d.count}</div>
                    <div className="flex justify-end">
                      {entry ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVolumeMutation.mutate(entry.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Entry Modal */}
      {showAddForm && (
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
                        {dfFormat(newEntry.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60] bg-white border border-slate-200 shadow-2xl" sideOffset={8}>
                      <Calendar
                        mode="single"
                        selected={newEntry.date}
                        onSelect={(d) => d && setNewEntry((p) => ({ ...p, date: d }))}
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
                    onChange={(e) => setNewEntry((p) => ({ ...p, patientCount: e.target.value }))}
                    placeholder="Number of patients"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Additional notes about the day..."
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={createVolumeMutation.isPending}>
                    {createVolumeMutation.isPending ? "Saving..." : "Save"}
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
