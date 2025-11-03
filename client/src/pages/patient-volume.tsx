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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Save,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { AppContainer } from "@/components/layout/app-container";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useLocation, useNavigate } from "wouter";
import { useSession } from "@/hooks/use-session";

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
  const yearParam = params.get("year")
    ? parseInt(params.get("year") as string, 10)
    : undefined;
  const monthParam = params.get("month")
    ? parseInt(params.get("month") as string, 10) - 1
    : undefined;

  const initialMonth =
    yearParam && monthParam !== undefined
      ? new Date(yearParam, monthParam, 1, 12)
      : new Date();

  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonth);
  const [mode, setMode] = useState<"monthly" | "daily">(
    viewParam === "monthly" ? "monthly" : "daily"
  );
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

  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const monthNumber = monthIndex + 1;

  useDocumentTitle("Patient Volume | BEGC Insights");
  const [, navigate] = useLocation();
  const { user } = useSession();

  // --- Data fetching ---
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
        if (day >= 1 && day <= daysInMonth) {
          buckets[day - 1] += Number(v.patientCount || 0);
        }
      }
    }
    return buckets;
  }, [rawVolumes, year, monthIndex, daysInMonth]);

  const totalPatients = useMemo(
    () => dayBuckets.reduce((sum, v) => sum + v, 0),
    [dayBuckets]
  );

  const averagePerDay = useMemo(() => {
    const daysWithData = dayBuckets.filter((d) => d > 0).length || 1;
    return totalPatients / daysWithData;
  }, [dayBuckets, totalPatients]);

  const chartData = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        patients: dayBuckets[i],
      })),
    [daysInMonth, dayBuckets]
  );

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (body: { date: string; departmentId: string | null; patientCount: number; notes: string | null }) => {
      const res = await apiRequest("POST", "/api/patient-volume", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Patient volume recorded", variant: "default" });
      queryClient.invalidateQueries({
        queryKey: ["/api/patient-volume/period", year, monthNumber],
      });
      setNewEntry((prev) => ({
        ...prev,
        patientCount: "0",
        notes: "",
      }));
    },
    onError: (err: any) => {
      console.error(err);
      toast({
        title: "Failed to save patient volume",
        description: "Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/patient-volume/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Entry deleted", variant: "default" });
      queryClient.invalidateQueries({
        queryKey: ["/api/patient-volume/period", year, monthNumber],
      });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" },
      );
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const pc = parseInt(newEntry.patientCount, 10);
    if (Number.isNaN(pc) || pc < 0) {
      toast({ title: "Enter a valid patient count", variant: "destructive" });
      return;
    }

    // Prevent double entry for the same calendar date in this month
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
      <div className="bg-white border border-slate-200 rounded-md shadow-md px-3 py-2 text-xs">
        <div className="font-semibold">{format(d, "EEE, MMM d")}</div>
        <div className="text-slate-600">{p.patients} patients</div>
      </div>
    );
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    setSelectedMonth((prev) => addMonths(prev, direction === "prev" ? -1 : 1));
  };

  const handleQuickJump = (type: "this-month" | "last-month") => {
    setSelectedMonth(type === "this-month" ? thisMonthAnchor : lastMonthAnchor);
  };

  const handleNewEntryDateChange = (date: Date | undefined) => {
    if (!date) return;
    setNewEntry((prev) => ({ ...prev, date }));
    // Auto-jump calendar month to the chosen date's month for better context
    if (!isSameMonth(selectedMonth, date)) {
      setSelectedMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    }
  };

  const handleNavigateBack = () => {
    // If user came from the executive dashboard with view=monthly, go back there
    if (viewParam === "monthly") {
      navigate("/executive-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const isOwnerOrAdmin = user?.role === "admin" || user?.role === "owner";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <AppContainer>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleNavigateBack}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-teal-600" />
                Patient Volume
              </h1>
              <p className="text-sm text-slate-500">
                Track daily patient counts at the clinic for operational insights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("daily")}
            >
              Daily view
            </Button>
            <Button
              variant={mode === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("monthly")}
            >
              Monthly summary
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <Card className="flex-1 border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Selected month</h2>
                  <p className="text-sm text-slate-500">{monthTitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleMonthChange("prev")}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleMonthChange("next")}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant={isSameMonth(selectedMonth, thisMonthAnchor) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickJump("this-month")}
                >
                  This month
                </Button>
                <Button
                  variant={isSameMonth(selectedMonth, lastMonthAnchor) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickJump("last-month")}
                >
                  Last month
                </Button>
              </div>

              <div className="border rounded-md p-2">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(d) => d && setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12))}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-slate-800 mb-1">
                Summary for {monthTitle}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Use this summary to understand seasonal patterns and staffing needs.
              </p>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : totalPatients === 0 ? (
                <EmptyState
                  title="No patient volume recorded"
                  description="Use the form on the right to record daily counts. Data will appear here as you add entries."
                  icon={Users}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Total patients this month</div>
                      <div className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                        {totalPatients.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-xs text-slate-500">Average per active day</div>
                      <div className="text-xl font-semibold text-slate-900">
                        {averagePerDay.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "#e5e7eb" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "#e5e7eb" }}
                        />
                        <Tooltip content={<TooltipBox />} />
                        <Line
                          type="monotone"
                          dataKey="patients"
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-4">
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-800">Daily entries</h2>
                <Badge variant="outline" className="text-xs">
                  {daysInMonth} days · {totalPatients.toLocaleString()} patients
                </Badge>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="max-h-[420px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Date
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Patients
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Notes
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const dayDate = new Date(year, monthIndex, day, 12);
                          const count = dayBuckets[i];
                          const notesForDay =
                            rawVolumes
                              .filter((v) => {
                                const vd = parseISO(v.date);
                                return (
                                  vd.getFullYear() === dayDate.getFullYear() &&
                                  vd.getMonth() === dayDate.getMonth() &&
                                  vd.getDate() === dayDate.getDate()
                                );
                              })
                              .map((v) => v.notes)
                              .filter(Boolean)
                              .join(" • ") || null;
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
                            <tr
                              key={day}
                              className={cn(
                                "border-b border-slate-100",
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                              )}
                            >
                              <td className="px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                                {format(dayDate, "EEE, MMM d")}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900 text-xs md:text-sm">
                                {count > 0 ? count.toLocaleString() : "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">
                                {notesForDay || (
                                  <span className="text-slate-400 italic">No notes</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {isOwnerOrAdmin && idToDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMutation.mutate(idToDelete)}
                                  >
                                    {deleteMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    )}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    Add / update patient volume
                  </h2>
                  <p className="text-xs text-slate-500">
                    Each calendar date can only have one entry. Use delete in the table to correct mistakes.
                  </p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSave}>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between text-left font-normal",
                          !newEntry.date && "text-slate-400"
                        )}
                      >
                        {newEntry.date ? (
                          format(newEntry.date, "EEE, MMM d, yyyy")
                        ) : (
                          <span>Select date</span>
                        )}
                        <CalendarIcon className="w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newEntry.date}
                        onSelect={(d) => d && handleNewEntryDateChange(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient-count" className="text-xs text-slate-600">
                    Patient count
                  </Label>
                  <Input
                    id="patient-count"
                    type="number"
                    min={0}
                    value={newEntry.patientCount}
                    onChange={(e) =>
                      setNewEntry((prev) => ({ ...prev, patientCount: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs text-slate-600">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={newEntry.notes}
                    onChange={(e) =>
                      setNewEntry((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="e.g. Outreach day, public holiday, half-day schedule..."
                    className="text-sm min-h-[80px]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500">
                    Only admins and owners can delete entries. Use this form to add new counts.
                  </p>
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
            </CardContent>
          </Card>
        </div>
      </AppContainer>
    </div>
  );
}
