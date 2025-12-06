import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, addMonths, isSameMonth } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { apiRequest, api } from "@/lib/queryClient";
import {
  Calendar as CalendarIcon,
  Users,
  Plus,
  Trash2,
  BarChart3,
  Table as TableIcon,
  X,
  Save,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import AppContainer from "@/components/layout/AppContainer";

type PatientVolume = {
  id: string;
  date: string;           // ISO string from API
  patientCount: number;
  notes?: string | null;
};

export default function PatientVolumePage() {
  // URL deep-link support from dashboards (optional)
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view"); // "monthly" or null
  const yearParam = params.get("year");
  const monthParam = params.get("month");

  // Default to current month unless explicitly set via URL (from dashboard)
  const initialMonthDate = useMemo(() => {
    if (viewParam === "monthly" && yearParam && monthParam) {
      return new Date(Number(yearParam), Number(monthParam) - 1, 1, 12);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  }, [viewParam, yearParam, monthParam]);

  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonthDate);
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<{ date: Date; patientCount: string; notes: string }>({
    date: new Date(),
    patientCount: "0",
    notes: "",
  });

  const queryClient = useQueryClient();

  // --- Derived helpers for quick chips ---
  const now = new Date();
  const thisMonthAnchor = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const lastMonthAnchor = addMonths(thisMonthAnchor, -1);

  const isThisMonth = isSameMonth(selectedMonth, thisMonthAnchor);
  const isLastMonth = isSameMonth(selectedMonth, lastMonthAnchor);

  const goPrevMonth = () => setSelectedMonth(addMonths(selectedMonth, -1));
  const goNextMonth = () => setSelectedMonth(addMonths(selectedMonth, +1));
  const jumpThisMonth = () => setSelectedMonth(thisMonthAnchor);
  const jumpLastMonth = () => setSelectedMonth(lastMonthAnchor);

  // --- Fetch the selected month's volumes ---
  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth(); // 0-based
  const monthNumber = monthIndex + 1;          // 1-based

  const { data: rawVolumes = [], isLoading } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/period", year, monthNumber],
    queryFn: async () => {
      const resp = await api.get(`/api/patient-volume/period/${year}/${monthNumber}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
  });

  // --- Normalize & aggregate to days ---
  const daysInMonth = useMemo(
    () => new Date(year, monthIndex + 1, 0).getDate(),
    [year, monthIndex]
  );

  const dayBuckets = useMemo(() => {
    const buckets = Array.from({ length: daysInMonth }, () => 0);
    for (const v of rawVolumes) {
      const d = parseISO(v.date);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        buckets[day - 1] += Number(v.patientCount || 0);
      }
    }
    return buckets;
  }, [rawVolumes, daysInMonth, year, monthIndex]);

  const activeDays = dayBuckets.filter((c) => c > 0).length;
  const totalPatients = dayBuckets.reduce((s, n) => s + n, 0);
  const avgPerActiveDay = activeDays ? totalPatients / activeDays : 0;
  const peakCount = Math.max(0, ...dayBuckets);
  const peakDay = peakCount > 0 ? dayBuckets.findIndex((n) => n === peakCount) + 1 : null;

  const chartData = useMemo(
    () => dayBuckets.map((count, idx) => ({ day: idx + 1, count: count > 0 ? count : 0 })),
    [dayBuckets]
  );
  const xTicks = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period", year, monthNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded" });
      setAddOpen(false);
      setNewEntry({ date: new Date(), patientCount: "0", notes: "" });
    },
    onError: () => toast({ title: "Failed to record patient volume", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patient-volume/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period", year, monthNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const pc = parseInt(newEntry.patientCount, 10);
    if (Number.isNaN(pc) || pc < 0) {
      toast({ title: "Enter a valid patient count", variant: "destructive" });
      return;
    }

    // 🚫 Prevent double entry for the same calendar date (same year/month/day)
    const newDate = newEntry.date;
    const alreadyExistsForDay = rawVolumes.some((v) => {
      const d = parseISO(v.date);
      return (
        d.getFullYear() === newDate.getFullYear() &&
        d.getMonth() === newDate.getMonth() &&
        d.getDate() === newDate.getDate()
      );
    });

    if (alreadyExistsForDay) {
      toast({
        title: "Patient volume already recorded for this date",
        description:
          "To change the value, delete the existing entry for this date in the table, then add a new one.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      date: newEntry.date.toISOString(),
      departmentId: null,
      patientCount: pc,
      notes: newEntry.notes || null,
    });
  };

  // --- Rendering helpers ---
  const monthTitle = format(selectedMonth, "MMMM yyyy");

  const TooltipBox = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const d = new Date(year, monthIndex, p.day, 12);
    return (
      <div className="bg-white border border-slate-200 rounded-md shadow-md px-3 py-2">
        <div className="font-medium text-slate-900 mb-1">{format(d, "EEE, MMM d, yyyy")}</div>
        <div className="text-sm text-slate-700">
          Patients: <span className="font-semibold">{p.count}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* World-class header */}
      <PageHeader
        title="Patient Volume"
        subtitle="Daily patient statistics"
      >
        <Button
          className="bg-white hover:bg-slate-100 text-slate-900 rounded-full"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </PageHeader>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <AppContainer className="space-y-6 py-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">Total Patients</div>
              <div className="text-2xl font-semibold">{totalPatients.toLocaleString()}</div>
              <div className="text-xs text-slate-500">{monthTitle}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">Average / Active Day</div>
              <div className="text-2xl font-semibold">
                {activeDays ? (Math.round(avgPerActiveDay * 10) / 10).toLocaleString() : 0}
              </div>
              <div className="text-xs text-slate-500">{activeDays} active days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">Peak Day</div>
              <div className="text-2xl font-semibold">{peakCount}</div>
              <div className="text-xs text-slate-500">
                {peakDay ? format(new Date(year, monthIndex, peakDay, 12), "EEE, MMM d, yyyy") : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls: month navigation + quick chips + month picker */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrevMonth} title="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {monthTitle}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(d) => d && setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNextMonth} title="Next month">
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div className="mx-1 h-6 w-px bg-slate-200" />

            <Button
              variant={isThisMonth ? "default" : "outline"}
              className={cn("h-8", isThisMonth ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
              onClick={jumpThisMonth}
            >
              This month
            </Button>
            <Button
              variant={isLastMonth ? "default" : "outline"}
              className={cn("h-8", isLastMonth ? "bg-slate-900 text-white hover:bg-slate-800" : "")}
              onClick={jumpLastMonth}
            >
              Last month
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={mode === "chart" ? "default" : "outline"}
              className={cn(
                "h-8 px-3",
                mode === "chart"
                  ? "bg-slate-900 hover:bg-slate-800 text-white [&>svg]:text-white"
                  : "text-slate-700"
              )}
              onClick={() => setMode("chart")}
            >
              <BarChart3 className="w-4 h-4 mr-1 shrink-0" />
              Chart
            </Button>
            <Button
              variant={mode === "table" ? "default" : "outline"}
              className={cn(
                "h-8 px-3",
                mode === "table"
                  ? "bg-slate-900 hover:bg-slate-800 text-white [&>svg]:text-white"
                  : "text-slate-700"
              )}
              onClick={() => setMode("table")}
            >
              <TableIcon className="w-4 h-4 mr-1 shrink-0" />
              Table
            </Button>
          </div>
        </div>

        {/* Chart / Table */}
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="py-14 text-center text-slate-500">Loading…</div>
            ) : mode === "chart" ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.5} vertical={false} />
                    <XAxis
                      dataKey="day"
                      ticks={xTicks}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickLine={false}
                      label={{ value: "Day", position: "insideBottomRight", offset: -14, style: { fill: "#64748b", fontSize: 11 } }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      label={{ value: "Patients", angle: -90, position: "insideLeft", offset: 8, style: { fill: "#64748b", fontSize: 11 } }}
                    />
                    <Tooltip content={<TooltipBox />} />
                    <Bar dataKey="count" name="Patients" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  <div className="grid grid-cols-[1fr_120px_44px] bg-slate-50 text-slate-600 text-sm px-3 py-2 font-medium">
                    <div>Date</div>
                    <div className="text-right pr-6">Patients</div>
                    <div />
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const count = dayBuckets[d - 1] || 0;
                      const dayDate = new Date(year, monthIndex, d, 12);
                      const idToDelete =
                        rawVolumes.find((v) => {
                          const vd = parseISO(v.date);
                          return (
                            vd.getFullYear() === dayDate.getFullYear() &&
                            vd.getMonth() === dayDate.getMonth() &&
                            vd.getDate() === dayDate.getDate()
                          );
                        })?.id ?? null;

                      return (
                        <div key={d} className="grid grid-cols-[1fr_120px_44px] items-center px-3 py-2 hover:bg-slate-50">
                          <div className="text-slate-900">{format(dayDate, "EEE, MMM d, yyyy")}</div>
                          <div className="text-right font-medium text-slate-900 pr-6">{count}</div>
                          <div className="flex justify-end">
                            {idToDelete ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                onClick={() => deleteMutation.mutate(idToDelete)}
                                title="Delete entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : (
                              <div className="h-8 w-8" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add modal */}
        {addOpen && (
          <div className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center p-4">
            <div className="mt-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">Add Patient Volume</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddOpen(false)}>
                  <X className="h-4 h-4" />
                </Button>
              </div>

              <div className="px-5 py-4">
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {format(newEntry.date, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl">
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
                      min={0}
                      value={newEntry.patientCount}
                      onChange={(e) => setNewEntry((p) => ({ ...p, patientCount: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Enter any additional notes (optional)…"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700"
                      disabled={createMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {createMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        </AppContainer>
      </div>
    </div>
  );
}
