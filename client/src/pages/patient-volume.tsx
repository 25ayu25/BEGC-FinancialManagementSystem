import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, addMonths, isSameMonth, startOfWeek, endOfWeek, subWeeks, subMonths, startOfQuarter, startOfYear, subDays, getDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  TrendingUp,
  TrendingDown,
  LineChart,
  AreaChart,
  Download,
  FileText,
  Target,
  Activity
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

import AppContainer from "@/components/layout/AppContainer";
import PageHeader from "@/components/layout/PageHeader";
import HeaderAction from "@/components/layout/HeaderAction";

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
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "heatmap">("bar");
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [comparisonPeriod, setComparisonPeriod] = useState<"none" | "prevMonth" | "sameMonthLastYear">("none");
  const [dateRangeFilter, setDateRangeFilter] = useState<"month" | "7days" | "30days" | "quarter" | "year">("month");
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

  // --- Additional Analytics Metrics ---
  // Median calculation
  const sortedCounts = [...dayBuckets].filter(c => c > 0).sort((a, b) => a - b);
  const medianPatients = sortedCounts.length > 0
    ? sortedCounts.length % 2 === 0
      ? (sortedCounts[sortedCounts.length / 2 - 1] + sortedCounts[sortedCounts.length / 2]) / 2
      : sortedCounts[Math.floor(sortedCounts.length / 2)]
    : 0;

  // Projected monthly total (based on current average for remaining days)
  const today = new Date();
  const currentDayOfMonth = isSameMonth(selectedMonth, today) ? today.getDate() : daysInMonth;
  const remainingDays = daysInMonth - currentDayOfMonth;
  const projectedTotal = totalPatients + (avgPerActiveDay * remainingDays);

  // Week-over-Week Growth - fetch previous week data
  const { data: prevWeekVolumes = [] } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/prevWeek", year, monthNumber],
    queryFn: async () => {
      const prevWeekStart = subWeeks(selectedMonth, 1);
      const prevYear = prevWeekStart.getFullYear();
      const prevMonth = prevWeekStart.getMonth() + 1;
      const resp = await api.get(`/api/patient-volume/period/${prevYear}/${prevMonth}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
  });

  // Calculate current week total (last 7 days of selected month)
  const currentWeekTotal = dayBuckets.slice(-7).reduce((s, n) => s + n, 0);
  const prevWeekTotal = prevWeekVolumes
    .filter(v => {
      const d = parseISO(v.date);
      return d.getMonth() === selectedMonth.getMonth() - 1;
    })
    .slice(-7)
    .reduce((s, v) => s + Number(v.patientCount || 0), 0);
  const weekOverWeekGrowth = prevWeekTotal > 0 ? ((currentWeekTotal - prevWeekTotal) / prevWeekTotal) * 100 : 0;

  // Month-over-Month Trend - fetch previous month
  const prevMonth = addMonths(selectedMonth, -1);
  const { data: prevMonthVolumes = [] } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/period", prevMonth.getFullYear(), prevMonth.getMonth() + 1],
    queryFn: async () => {
      const resp = await api.get(`/api/patient-volume/period/${prevMonth.getFullYear()}/${prevMonth.getMonth() + 1}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
  });

  const prevMonthTotal = prevMonthVolumes.reduce((s, v) => s + Number(v.patientCount || 0), 0);
  const monthOverMonthGrowth = prevMonthTotal > 0 ? ((totalPatients - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  // Weekday distribution
  const weekdayDistribution = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const counts = Array(7).fill(0);
    
    rawVolumes.forEach(v => {
      const d = parseISO(v.date);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const dayOfWeek = getDay(d);
        counts[dayOfWeek] += Number(v.patientCount || 0);
      }
    });
    
    const total = counts.reduce((s, n) => s + n, 0);
    return days.map((day, i) => ({
      day,
      count: counts[i],
      percentage: total > 0 ? (counts[i] / total) * 100 : 0
    }));
  }, [rawVolumes, year, monthIndex]);

  const chartData = useMemo(
    () => dayBuckets.map((count, idx) => ({ day: idx + 1, count: count > 0 ? count : 0 })),
    [dayBuckets]
  );
  const xTicks = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // --- Export Functions ---
  const exportToCSV = () => {
    const headers = ["Date", "Patient Count"];
    const rows = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, monthIndex, i + 1, 12);
      return [format(d, "yyyy-MM-dd"), dayBuckets[i] || 0];
    });
    
    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient-volume-${format(selectedMonth, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported successfully" });
  };

  const exportToPDF = async () => {
    try {
      // Simple PDF export using browser print
      const printContent = `
        <html>
          <head>
            <title>Patient Volume Report - ${monthTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #0D9488; }
              .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
              .metric { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
              .metric-label { font-size: 12px; color: #64748b; }
              .metric-value { font-size: 24px; font-weight: bold; margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
              th { background: #f8fafc; }
            </style>
          </head>
          <body>
            <h1>Patient Volume Report</h1>
            <p><strong>Period:</strong> ${monthTitle}</p>
            <div class="metrics">
              <div class="metric">
                <div class="metric-label">Total Patients</div>
                <div class="metric-value">${totalPatients}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Average / Active Day</div>
                <div class="metric-value">${Math.round(avgPerActiveDay * 10) / 10}</div>
              </div>
              <div class="metric">
                <div class="metric-label">Peak Day</div>
                <div class="metric-value">${peakCount}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr><th>Date</th><th>Day of Week</th><th>Patient Count</th></tr>
              </thead>
              <tbody>
                ${Array.from({ length: daysInMonth }, (_, i) => {
                  const d = new Date(year, monthIndex, i + 1, 12);
                  return `<tr><td>${format(d, "MMM d, yyyy")}</td><td>${format(d, "EEEE")}</td><td>${dayBuckets[i] || 0}</td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          toast({ title: "PDF export ready - print dialog opened" });
        }, 250);
      }
    } catch (error) {
      toast({ title: "Failed to export PDF", variant: "destructive" });
    }
  };

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
    const dayOfWeek = format(d, "EEEE");
    const diffFromAvg = p.count - avgPerActiveDay;
    const percentDiff = avgPerActiveDay > 0 ? ((diffFromAvg / avgPerActiveDay) * 100).toFixed(1) : "0";
    
    return (
      <div className="bg-white border border-slate-200 rounded-md shadow-md px-3 py-2">
        <div className="font-medium text-slate-900 mb-1">{format(d, "EEE, MMM d, yyyy")}</div>
        <div className="text-sm text-slate-700">
          Patients: <span className="font-semibold">{p.count}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {diffFromAvg >= 0 ? "+" : ""}{diffFromAvg.toFixed(1)} ({percentDiff}%) vs avg
        </div>
        {targetValue && (
          <div className="text-xs text-slate-500">
            Target: {targetValue} {p.count >= targetValue ? "✓" : ""}
          </div>
        )}
      </div>
    );
  };

  // Pie chart colors
  const WEEKDAY_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <PageHeader
        variant="patientVolume"
        title="Patient Volume Tracking"
        subtitle="Monthly & multi-period summary"
      >
        <HeaderAction
          variant="light"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setAddOpen(true)}
        >
          Add Volume
        </HeaderAction>
      </PageHeader>

      <AppContainer className="space-y-6 py-6">
        {/* KPI cards - Row 1: Existing metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* KPI cards - Row 2: Advanced analytics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Week-over-Week
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-2xl font-semibold">
                  {weekOverWeekGrowth > 0 ? "+" : ""}{weekOverWeekGrowth.toFixed(1)}%
                </div>
                {weekOverWeekGrowth > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : weekOverWeekGrowth < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                ) : null}
              </div>
              <div className="text-xs text-slate-500 mt-1">vs previous week</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Month-over-Month
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-2xl font-semibold">
                  {monthOverMonthGrowth > 0 ? "+" : ""}{monthOverMonthGrowth.toFixed(1)}%
                </div>
                {monthOverMonthGrowth > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : monthOverMonthGrowth < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                ) : null}
              </div>
              <div className="text-xs text-slate-500 mt-1">vs {format(prevMonth, "MMM yyyy")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">Median Patients/Day</div>
              <div className="text-2xl font-semibold">
                {medianPatients ? Math.round(medianPatients * 10) / 10 : 0}
              </div>
              <div className="text-xs text-slate-500">More robust metric</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Target className="w-3 h-3" />
                Projected Monthly Total
              </div>
              <div className="text-2xl font-semibold">
                {isSameMonth(selectedMonth, new Date()) 
                  ? Math.round(projectedTotal).toLocaleString()
                  : totalPatients.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                {isSameMonth(selectedMonth, new Date()) ? "Based on current trend" : "Final total"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls: month navigation + quick chips + month picker + chart controls + exports */}
        <div className="flex flex-col gap-3">
          {/* Row 1: Navigation and period selection */}
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

            {/* Export buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={exportToCSV}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={exportToPDF}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                PDF
              </Button>
            </div>
          </div>

          {/* Row 2: Chart type and view mode selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-2 flex-wrap">
              {/* Chart Type Selector */}
              <div className="flex gap-1 border border-slate-200 rounded-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2",
                    chartType === "bar" && "bg-teal-50 text-teal-700 hover:bg-teal-100"
                  )}
                  onClick={() => setChartType("bar")}
                  title="Bar Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2",
                    chartType === "line" && "bg-teal-50 text-teal-700 hover:bg-teal-100"
                  )}
                  onClick={() => setChartType("line")}
                  title="Line Chart"
                >
                  <LineChart className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2",
                    chartType === "area" && "bg-teal-50 text-teal-700 hover:bg-teal-100"
                  )}
                  onClick={() => setChartType("area")}
                  title="Area Chart"
                >
                  <AreaChart className="w-4 h-4" />
                </Button>
              </div>

              {/* Additional options */}
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8", showTrendLine && "bg-blue-50 text-blue-700 border-blue-200")}
                onClick={() => setShowTrendLine(!showTrendLine)}
              >
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                Trend Line
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Target className="w-3.5 h-3.5 mr-1.5" />
                    Target {targetValue ? `(${targetValue})` : ""}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 bg-white border border-slate-200 shadow-xl">
                  <div className="space-y-3">
                    <div className="font-medium text-sm">Set Daily Target</div>
                    <Input
                      type="number"
                      placeholder="Enter target value"
                      value={targetValue || ""}
                      onChange={(e) => setTargetValue(e.target.value ? Number(e.target.value) : null)}
                    />
                    <Button
                      size="sm"
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      onClick={() => toast({ title: "Target updated" })}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* View mode toggle */}
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
        </div>

        {/* Main Chart / Table */}
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="py-14 text-center text-slate-500">Loading…</div>
            ) : mode === "chart" ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
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
                      {targetValue && (
                        <ReferenceLine 
                          y={targetValue} 
                          stroke="#f59e0b" 
                          strokeDasharray="3 3"
                          label={{ value: `Target: ${targetValue}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                        />
                      )}
                      {showTrendLine && chartData.length > 1 && (
                        <ReferenceLine
                          segment={[
                            { x: 1, y: chartData[0].count },
                            { x: daysInMonth, y: chartData[chartData.length - 1].count }
                          ]}
                          stroke="#3b82f6"
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                      )}
                      <Bar dataKey="count" name="Patients" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={26} />
                    </BarChart>
                  ) : chartType === "line" ? (
                    <RechartsLineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
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
                      {targetValue && (
                        <ReferenceLine 
                          y={targetValue} 
                          stroke="#f59e0b" 
                          strokeDasharray="3 3"
                          label={{ value: `Target: ${targetValue}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                        />
                      )}
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#14b8a6" 
                        strokeWidth={2.5}
                        dot={{ fill: "#14b8a6", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </RechartsLineChart>
                  ) : chartType === "area" ? (
                    <RechartsAreaChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
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
                      {targetValue && (
                        <ReferenceLine 
                          y={targetValue} 
                          stroke="#f59e0b" 
                          strokeDasharray="3 3"
                          label={{ value: `Target: ${targetValue}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                        />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#14b8a6" 
                        strokeWidth={2}
                        fill="url(#colorCount)"
                      />
                    </RechartsAreaChart>
                  ) : null}
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

        {/* Weekday Distribution Analysis */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Weekday Distribution</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weekdayDistribution.filter(d => d.count > 0)}
                      dataKey="count"
                      nameKey="day"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ day, percentage }) => `${day.substring(0, 3)}: ${percentage.toFixed(1)}%`}
                      labelLine={true}
                    >
                      {weekdayDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={WEEKDAY_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        `${value} patients (${((value / totalPatients) * 100).toFixed(1)}%)`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Weekday Stats */}
              <div className="space-y-3">
                {weekdayDistribution.map((day, idx) => {
                  const isMax = day.count === Math.max(...weekdayDistribution.map(d => d.count));
                  const isMin = day.count > 0 && day.count === Math.min(...weekdayDistribution.filter(d => d.count > 0).map(d => d.count));
                  
                  return (
                    <div key={day.day} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: WEEKDAY_COLORS[idx] }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900">
                            {day.day}
                            {isMax && <span className="ml-2 text-xs text-green-600 font-semibold">BUSIEST</span>}
                            {isMin && <span className="ml-2 text-xs text-orange-600 font-semibold">SLOWEST</span>}
                          </span>
                          <span className="text-sm text-slate-700 font-semibold">{day.count}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${day.percentage}%`,
                              backgroundColor: WEEKDAY_COLORS[idx]
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">
                        {day.percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
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
  );
}
