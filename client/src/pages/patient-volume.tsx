import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type PatientVolume = {
  id: string;
  date: string;           // ISO string from API
  patientCount: number;
  notes?: string | null;
};

export default function PatientVolumePage() {
  // Read URL params coming from dashboard links (optional)
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view"); // "monthly" or null
  const yearParam = params.get("year");
  const monthParam = params.get("month");

  // Default to current month unless explicitly set via URL (from dashboard)
  const initialMonthDate = useMemo(() => {
    if (viewParam === "monthly" && yearParam && monthParam) {
      return new Date(Number(yearParam), Number(monthParam) - 1, 1, 12); // noon to avoid tz drift
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  }, [viewParam, yearParam, monthParam]);

  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonthDate);
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<{ date: Date; patientCount: string; notes: string }>({
    date: new Date(),
    patientCount: "",
    notes: "",
  });

  const queryClient = useQueryClient();

  // --- Fetch this month's volumes ---
  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth(); // 0-based
  const monthNumber = monthIndex + 1;         // 1-based

  const { data: rawVolumes = [], isLoading } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/period", year, monthNumber],
    queryFn: async () => {
      const resp = await api.get(`/api/patient-volume/period/${year}/${monthNumber}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
  });

  // --- Normalize & aggregate to days (avoid timezone “Aug 31” drift) ---
  const daysInMonth = useMemo(
    () => new Date(year, monthIndex + 1, 0).getDate(),
    [year, monthIndex]
  );

  const dayBuckets = useMemo(() => {
    const buckets = Array.from({ length: daysInMonth }, () => 0);
    for (const v of rawVolumes) {
      // Parse server ISO date in local time, then bucket by local day if it truly belongs to this month
      const d = parseISO(v.date);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate(); // 1..N local
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

  // Recharts data
  const chartData = useMemo(
    () =>
      dayBuckets.map((count, idx) => ({
        day: idx + 1,
        count: count > 0 ? count : 0, // keep bars even for zero (or set to null to hide)
      })),
    [dayBuckets]
  );

  // X-axis ticks: show all 1..N (your request)
  const xTicks = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period", year, monthNumber] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded" });
      setAddOpen(false);
      setNewEntry({ date: new Date(), patientCount: "", notes: "" });
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
    // Save as ISO; backend already expects ISO string
    createMutation.mutate({
      date: newEntry.date.toISOString(),
      departmentId: null,
      patientCount: pc,
      notes: newEntry.notes || null,
    });
  };

  // --- Rendering helpers ---
  const monthTitle = format(selectedMonth, "MMMM yyyy"); // auto updates (Sep → Oct, etc.)

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">Monthly & multi-period summary</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>

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

      {/* Section header with chip + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Patient Volume
            <span className="mx-1 text-slate-300">•</span>
            <span className="rounded-full border px-2 py-0.5 text-sm bg-slate-50 border-slate-200">
              {monthTitle}
            </span>
          </h2>
          <div className="ml-2 text-sm text-slate-500">
            Total: <span className="font-medium text-slate-800">{totalPatients}</span> patients
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === "chart" ? "default" : "outline"}
            className={cn("h-8 px-3", mode === "chart" ? "bg-slate-900 hover:bg-slate-800" : "")}
            onClick={() => setMode("chart")}
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            Chart
          </Button>
          <Button
            variant={mode === "table" ? "default" : "outline"}
            className={cn("h-8 px-3", mode === "table" ? "bg-slate-900 hover:bg-slate-800" : "")}
            onClick={() => setMode("table")}
          >
            <TableIcon className="w-4 h-4 mr-1" />
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
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 4, bottom: 22 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="day"
                    ticks={xTicks}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                    // label is optional—uncomment if you want it
                    label={{
                      value: "Day",
                      position: "insideBottomRight",
                      offset: -14,
                      style: { fill: "#64748b", fontSize: 11 },
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    label={{
                      value: "Patients",
                      angle: -90,
                      position: "insideLeft",
                      offset: 8,
                      style: { fill: "#64748b", fontSize: 11 },
                    }}
                  />
                  <Tooltip content={<TooltipBox />} />
                  <Bar dataKey="count" name="Patients" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
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
                      // match same local day (handles tz correctly)
                      return (
                        vd.getFullYear() === dayDate.getFullYear() &&
                        vd.getMonth() === dayDate.getMonth() &&
                        vd.getDate() === dayDate.getDate()
                      );
                    })?.id ?? null;

                  return (
                    <div
                      key={d}
                      className="grid grid-cols-[1fr_120px_44px] items-center px-3 py-2 hover:bg-slate-50"
                    >
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
          )}
        </CardContent>
      </Card>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl">
            <CardHeader>
              <CardTitle>Add Patient Volume</CardTitle>
            </CardHeader>
            <CardContent>
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
                    placeholder="e.g. 27"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Additional notes…"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
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
