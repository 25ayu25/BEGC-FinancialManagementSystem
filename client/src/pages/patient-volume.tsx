import { useMemo, useState } from "react";
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
  ChevronRight,
  Loader2,
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

import { AppContainer } from "@/components/app-container";

type PatientVolume = {
  id: string;
  date: string;
  patientCount: number;
  notes: string | null;
};

type NewVolumeEntry = {
  date: Date;
  patientCount: string;
  notes: string;
};

function getMonthName(date: Date) {
  return format(date, "MMMM yyyy");
}

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
  const [tableViewMode, setTableViewMode] = useState<"daily" | "monthly">("daily");
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<NewVolumeEntry>({
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

  const handleQuickMonth = (type: "this" | "last") => {
    if (type === "this") {
      setSelectedMonth(thisMonthAnchor);
    } else {
      setSelectedMonth(lastMonthAnchor);
    }
  };

  const gotoPrevMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, -1));
  };
  const gotoNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

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

    // Parse and validate patient count
    const pc = parseInt(newEntry.patientCount, 10);
    if (Number.isNaN(pc) || pc < 0) {
      toast({ title: "Enter a valid patient count", variant: "destructive" });
      return;
    }

    // Prevent entering volume twice for the same calendar date
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
        description: "You can delete the existing record in the table before adding a new one.",
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

  const handleDelete = (id: string | null) => {
    if (!id || deleteMutation.isPending) return;
    deleteMutation.mutate(id);
  };

  // --- Rendering helpers ---

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setNewEntry((prev) => ({ ...prev, date }));
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setNewEntry((prev) => ({ ...prev, patientCount: value }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewEntry((prev) => ({ ...prev, notes: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppContainer>
        <div className="py-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-teal-600" />
                Patient Volume
              </h1>
              <p className="text-slate-600 max-w-xl">
                Track daily patient volume. Each calendar date can only have one entry; delete and re-enter if
                you need to correct a day.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={gotoPrevMonth}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[220px] justify-start text-left font-normal bg-white",
                        !selectedMonth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>{getMonthName(selectedMonth)}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(v) => v && setSelectedMonth(new Date(v.getFullYear(), v.getMonth(), 1, 12))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={gotoNextMonth}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickMonth("this")}
                  className={cn(
                    "border-slate-200 text-slate-700",
                    isThisMonth && "border-teal-500 text-teal-700 bg-teal-50"
                  )}
                >
                  This month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickMonth("last")}
                  className={cn(
                    "border-slate-200 text-slate-700",
                    isLastMonth && "border-teal-500 text-teal-700 bg-teal-50"
                  )}
                >
                  Last month
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
            {/* Left: metrics & summary */}
            <div className="space-y-4">
              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Total patients this month
                      </p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {isLoading ? "…" : totalPatients}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 border border-teal-100">
                        <Users className="w-3 h-3 mr-1" />
                        {activeDays} active day{activeDays === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-slate-500">
                        Avg per active day:{" "}
                        <span className="font-medium text-slate-800">
                          {activeDays ? Math.round(avgPerActiveDay) : 0}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Peak day</p>
                      <p className="font-medium text-slate-900">
                        {peakDay ? `${format(new Date(year, monthIndex, peakDay), "MMM d")}` : "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {peakDay ? `${peakCount} patients` : "No volume recorded yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Coverage</p>
                      <p className="font-medium text-slate-900">
                        {daysInMonth ? Math.round((activeDays / daysInMonth) * 100) : 0}%
                      </p>
                      <p className="text-xs text-slate-500">Days with at least 1 patient</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-500" />
                      <p className="text-sm font-medium text-slate-800">
                        Daily Volume ({getMonthName(selectedMonth)})
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">Tap bars to inspect days</span>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                          dataKey="day"
                          ticks={xTicks}
                          tick={{ fontSize: 10 }}
                          axisLine={{ stroke: "#CBD5F5" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          axisLine={{ stroke: "#CBD5F5" }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(56, 189, 248, 0.1)" }}
                          contentStyle={{
                            borderRadius: 8,
                            borderColor: "#E5E7EB",
                            padding: "6px 8px",
                          }}
                          labelFormatter={(value) =>
                            format(new Date(year, monthIndex, Number(value)), "MMM d")
                          }
                          formatter={(value: any) => [`${value} patients`, "Volume"]}
                        />
                        <Bar
                          dataKey="count"
                          radius={[3, 3, 0, 0]}
                          className="fill-sky-500 hover:fill-sky-600 transition-colors"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: table & add form trigger */}
            <div className="space-y-4">
              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Daily entries for {getMonthName(selectedMonth)}
                        </p>
                        <p className="text-xs text-slate-500">
                          One entry per calendar date. Delete and re-add to correct a day.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Volume
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-xs text-slate-500">
                            Date
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-xs text-slate-500">
                            Patient count
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-xs text-slate-500">
                            Notes (if any)
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-xs text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: daysInMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const dayDate = new Date(year, monthIndex, day);
                          const countForDay = dayBuckets[idx];

                          const existingForDay = rawVolumes.filter((v) => {
                            const d = parseISO(v.date);
                            return (
                              d.getFullYear() === dayDate.getFullYear() &&
                              d.getMonth() === dayDate.getMonth() &&
                              d.getDate() === dayDate.getDate()
                            );
                          });

                          const notesForDay =
                            existingForDay.length > 0
                              ? existingForDay
                                  .map((v) => v.notes)
                                  .filter(Boolean)
                                  .join("; ")
                              : "";

                          const idToDelete = existingForDay.length > 0 ? existingForDay[0].id : null;

                          return (
                            <tr
                              key={day}
                              className={cn(
                                "border-t border-slate-100",
                                countForDay > 0 && "bg-slate-50/60"
                              )}
                            >
                              <td className="px-3 py-2 text-xs sm:text-sm text-slate-800 whitespace-nowrap">
                                {format(dayDate, "EEE, MMM d")}
                              </td>
                              <td className="px-3 py-2 text-right text-xs sm:text-sm font-medium text-slate-900">
                                {countForDay > 0 ? countForDay : "-"}
                              </td>
                              <td className="px-3 py-2 text-xs sm:text-sm text-slate-700">
                                {notesForDay || <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {idToDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => handleDelete(idToDelete)}
                                    title="Delete this day's record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-500" />
                      <p className="text-sm font-medium text-slate-800">
                        Table view mode
                      </p>
                    </div>
                    <div className="inline-flex rounded-full bg-slate-100 p-1">
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-1 text-xs rounded-full",
                          tableViewMode === "daily"
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-600"
                        )}
                        onClick={() => setTableViewMode("daily")}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "px-3 py-1 text-xs rounded-full",
                          tableViewMode === "monthly"
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-600"
                        )}
                        onClick={() => setTableViewMode("monthly")}
                      >
                        Monthly summary
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Daily view shows each calendar day. Monthly summary aggregates months when you
                    navigate across time.
                  </p>
                  {/* For now, daily & monthly share the same table above; this section explains behavior */}
                  <p className="text-xs text-slate-500">
                    Note: This view is scoped to the selected month. Use the month selector above to
                    navigate.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Add Volume modal */}
        {addOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 border border-slate-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  <h2 className="text-sm font-semibold text-slate-900">Add patient volume</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAddOpen(false)}
                  className="text-slate-500 hover:text-slate-800"
                  disabled={createMutation.isPending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-4 py-3">
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-700">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-white",
                            !newEntry.date && "text-muted-foreground"
                          )}
                          type="button"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newEntry.date ? (
                            format(newEntry.date, "EEE, MMM d, yyyy")
                          ) : (
                            <span>Select date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newEntry.date}
                          onSelect={(d) => d && handleDateSelect(d)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patientCount" className="text-xs font-medium text-slate-700">
                      Patient count
                    </Label>
                    <Input
                      id="patientCount"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newEntry.patientCount}
                      onChange={handleCountChange}
                      className="bg-white"
                    />
                    <p className="text-xs text-slate-500">
                      Enter the total number of patients seen on that date.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-xs font-medium text-slate-700">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={newEntry.notes}
                      onChange={handleNotesChange}
                      placeholder="Add any relevant notes (e.g., clinics, outreach, special events)."
                      className="bg-white"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddOpen(false)}
                      disabled={createMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className={cn(
                        "bg-teal-600 hover:bg-teal-700",
                        createMutation.isPending && "opacity-60 cursor-not-allowed"
                      )}
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </AppContainer>
    </div>
  );
}
