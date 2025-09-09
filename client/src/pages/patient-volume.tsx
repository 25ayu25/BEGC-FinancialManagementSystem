import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart3,
  Table as TableIcon,
  Plus,
  Trash2,
} from "lucide-react";

import { api, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  date: string; // ISO
  patientCount: number;
  notes?: string | null;
};

type Mode = "chart" | "table";

// —————————————————————————————————————————————————————
// Helpers
// —————————————————————————————————————————————————————
const monthLabel = (y: number, m1: number) =>
  format(new Date(y, m1 - 1, 1), "MMMM yyyy");

const dayTicks = (year: number, month1: number) =>
  Array.from({ length: new Date(year, month1, 0).getDate() }, (_, i) => i + 1);

const toISODate = (d: Date) => d.toISOString().split("T")[0];

// —————————————————————————————————————————————————————
// Component
// —————————————————————————————————————————————————————
export default function PatientVolumePage() {
  // Current month (you can pass ?year=YYYY&month=MM if you like)
  const params = new URLSearchParams(window.location.search);
  const yearParam = parseInt(params.get("year") || "", 10);
  const monthParam = parseInt(params.get("month") || "", 10);

  const today = new Date();
  const year = Number.isFinite(yearParam) ? yearParam : today.getFullYear();
  const month1 = Number.isFinite(monthParam) ? monthParam : today.getMonth() + 1;

  const [mode, setMode] = useState<Mode>("chart");
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date(),
    patientCount: "",
    notes: "",
  });

  const q = useQuery({
    queryKey: ["/api/patient-volume/period", year, month1],
    queryFn: async () => {
      const res = await api.get(`/api/patient-volume/period/${year}/${month1}`);
      return Array.isArray(res.data) ? (res.data as PatientVolume[]) : [];
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/patient-volume", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume recorded successfully" });
      setShowAdd(false);
      setNewEntry({ date: new Date(), patientCount: "", notes: "" });
    },
    onError: () => toast({ title: "Failed to record patient volume", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patient-volume/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Patient volume record deleted" });
    },
    onError: () => toast({ title: "Failed to delete record", variant: "destructive" }),
  });

  // ——— Derived data
  const days = new Date(year, month1, 0).getDate();
  const ticks = dayTicks(year, month1);

  const dailyMap = useMemo(() => {
    const map = new Map<number, PatientVolume[]>();
    (q.data || []).forEach((e) => {
      const d = new Date(e.date);
      const day = d.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return map;
  }, [q.data]);

  const chartData = useMemo(
    () =>
      ticks.map((d) => ({
        day: d,
        count: (dailyMap.get(d) || []).reduce((s, r) => s + r.patientCount, 0),
      })),
    [ticks, dailyMap]
  );

  const total = chartData.reduce((s, r) => s + r.count, 0);
  const activeDays = chartData.filter((d) => d.count > 0).length;
  const avgActive = activeDays ? total / activeDays : 0;
  const peak = chartData.reduce(
    (acc, cur) => (cur.count > acc.count ? cur : acc),
    { day: 0, count: 0 }
  );

  // ——— Add form submit
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(newEntry.patientCount, 10);
    if (!Number.isFinite(n) || n < 0) {
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

  // —————————————————————————————————————————————————————
  // UI
  // —————————————————————————————————————————————————————
  return (
    <div className="p-6 space-y-6">
      {/* Header & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Volume Tracking</h1>
          <p className="text-slate-600">Monthly & multi-period summary</p>
        </div>

        <Button
          onClick={() => setShowAdd(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total Patients</p>
            <p className="text-2xl font-semibold">{total.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{monthLabel(year, month1)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Average / Active Day</p>
            <p className="text-2xl font-semibold">
              {avgActive.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{activeDays} active days</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Peak Day</p>
            <p className="text-2xl font-semibold">{peak.count}</p>
            <p className="text-xs text-slate-500 mt-1">
              {peak.day > 0 ? format(new Date(year, month1 - 1, peak.day), "EEE, MMM d, yyyy") : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section heading + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600">
            👥
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            Patient Volume <span className="mx-2 text-slate-300">•</span>
            <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-[2px] text-xs text-slate-700 bg-white">
              {monthLabel(year, month1)}
            </span>
          </h2>
          <span className="ml-2 text-sm text-slate-500">
            Total: <span className="font-semibold text-teal-600">{total}</span> patients
          </span>
        </div>

        <div className="flex gap-2">
          {/* CHART pill — explicit white text when active */}
          <Button
            variant={mode === "chart" ? "default" : "outline"}
            className={cn(
              "h-8 px-3 rounded-md",
              mode === "chart"
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "text-slate-700"
            )}
            onClick={() => setMode("chart")}
          >
            <BarChart3
              className={cn(
                "w-4 h-4 mr-1",
                mode === "chart" ? "text-white" : "text-slate-700"
              )}
            />
            Chart
          </Button>

          {/* TABLE pill — explicit white text when active */}
          <Button
            variant={mode === "table" ? "default" : "outline"}
            className={cn(
              "h-8 px-3 rounded-md",
              mode === "table"
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "text-slate-700"
            )}
            onClick={() => setMode("table")}
          >
            <TableIcon
              className={cn(
                "w-4 h-4 mr-1",
                mode === "table" ? "text-white" : "text-slate-700"
              )}
            />
            Table
          </Button>
        </div>
      </div>

      {/* Chart / Table */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="pt-4">
          {q.isLoading ? (
            <div className="text-center py-8">Loading…</div>
          ) : mode === "chart" ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 12, bottom: 24 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#eef2f7" />
                  <XAxis
                    dataKey="day"
                    ticks={ticks}
                    interval={0}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    label={{
                      value: "Day",
                      position: "insideBottomRight",
                      offset: -12,
                      style: { fill: "#94a3b8", fontSize: 11 },
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    allowDecimals={false}
                    label={{
                      value: "Patients",
                      angle: -90,
                      position: "insideLeft",
                      offset: 8,
                      style: { fill: "#94a3b8", fontSize: 11 },
                    }}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v} patients`, "Count"]}
                    labelFormatter={(d: any) =>
                      format(new Date(year, month1 - 1, Number(d)), "EEE, MMM d, yyyy")
                    }
                  />
                  <Bar
                    dataKey="count"
                    name="Patients"
                    fill="#14b8a6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1fr_120px_44px] bg-slate-50 text-slate-600 text-sm px-3 py-2">
                <div>Date</div>
                <div className="text-right pr-2">Patients</div>
                <div />
              </div>
              <div>
                {ticks.map((d) => {
                  const entries = dailyMap.get(d) || [];
                  const count = entries.reduce((s, r) => s + r.patientCount, 0);
                  const has = entries.length > 0;
                  // If you want to *only* list existing entries, replace ticks.map with (q.data || []).sort(...)
                  return (
                    <div
                      key={d}
                      className="grid grid-cols-[1fr_120px_44px] items-center border-t border-slate-100 px-3 py-2"
                    >
                      <div className="text-slate-800">
                        {format(new Date(year, month1 - 1, d), "EEE, MMM d, yyyy")}
                      </div>
                      <div className={cn("text-right pr-2 font-medium", has ? "text-slate-900" : "text-slate-400")}>
                        {count}
                      </div>
                      <div className="text-right">
                        {/* Show delete for each raw entry of that day */}
                        {entries.map((e) => (
                          <Button
                            key={e.id}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteMutation.mutate(e.id)}
                            title="Delete this entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md shadow-2xl border-0 bg-white">
            <CardHeader>
              <CardTitle>Add Patient Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {format(newEntry.date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="p-2 w-[280px] bg-white border border-slate-200 shadow-2xl"
                    >
                      <DatePicker
                        mode="single"
                        selected={newEntry.date}
                        onSelect={(d) =>
                          d && setNewEntry((p) => ({ ...p, date: new Date(toISODate(d) + "T12:00:00") }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Patient Count</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={newEntry.patientCount}
                    onChange={(e) =>
                      setNewEntry((p) => ({ ...p, patientCount: e.target.value }))
                    }
                    placeholder="Number of patients"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={newEntry.notes}
                    onChange={(e) =>
                      setNewEntry((p) => ({ ...p, notes: e.target.value }))
                    }
                    placeholder="Additional notes…"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                    disabled={createMutation.isPending}
                  >
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
