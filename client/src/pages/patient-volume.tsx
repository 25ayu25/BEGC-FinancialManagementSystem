import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  parseISO,
  addMonths,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  subWeeks,
  subMonths,
  startOfQuarter,
  startOfYear,
  subDays,
  getDay,
  endOfMonth,
  startOfMonth,
  subQuarters,
  subYears,
  differenceInDays,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  isWithinInterval,
  addDays,
} from "date-fns";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
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
  Activity,
  Grid3x3,
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
  LabelList,
} from "recharts";

import AppContainer from "@/components/layout/AppContainer";
import PageHeader from "@/components/layout/PageHeader";
import HeaderAction from "@/components/layout/HeaderAction";

type PatientVolume = {
  id: string;
  date: string; // ISO string from API
  patientCount: number;
  notes?: string | null;
};

type WeekdayDistributionRow = { day: string; count: number; percentage: number };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// Bar label styling constant for consistency
const BAR_LABEL_STYLE = { fontSize: 12, fill: '#475569', fontWeight: 600 } as const;

/** ---------- SAFETY HELPERS (prevents Recharts reduce() crash) ---------- */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function toLabel(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
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
    const now0 = new Date();
    return new Date(now0.getFullYear(), now0.getMonth(), 1, 12);
  }, [viewParam, yearParam, monthParam]);

  const [selectedMonth, setSelectedMonth] = useState<Date>(initialMonthDate);
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "heatmap">("bar");
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [targetValue, setTargetValue] = useState<number | null>(null);

  // (kept from your original; some of these are not used yet, but harmless)
  const [comparisonPeriod, setComparisonPeriod] = useState<"none" | "prevMonth" | "sameMonthLastYear">("none");
  const [dateRangeFilter, setDateRangeFilter] = useState<"month" | "7days" | "30days" | "quarter" | "year">("month");

  const [timePeriod, setTimePeriod] = useState<string>("thisMonth");
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonTimePeriod, setComparisonTimePeriod] = useState<string>("previousPeriod");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<{ date: Date; patientCount: string; notes: string }>({
    date: new Date(),
    patientCount: "0",
    notes: "",
  });

  const queryClient = useQueryClient();

  /**
   * ✅ IMPORTANT FIX:
   * When navigating to this page via SPA (no refresh) with query params,
   * state does NOT reinitialize. Refresh makes it work, navigation can break.
   * This sync makes navigation behave like refresh.
   */
  useEffect(() => {
    if (viewParam === "monthly" && yearParam && monthParam) {
      const y = Number(yearParam);
      const m = Number(monthParam);

      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        const monthStart = startOfMonth(new Date(y, m - 1, 1, 12));
        const monthEnd = endOfMonth(monthStart);

        setSelectedMonth(monthStart);
        setTimePeriod("custom");
        setCustomDateRange({ start: monthStart, end: monthEnd });
      }
    }
  }, [viewParam, yearParam, monthParam]);

  // --- Helper functions for date range calculation ---
  const getDateRangeForPeriod = (
    period: string,
    customStart?: Date,
    customEnd?: Date
  ): { start: Date; end: Date } => {
    const now = new Date();
    const currentYear = now.getFullYear();

    switch (period) {
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth": {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case "last3Months": {
        const threeMonthsAgo = subMonths(now, 2);
        return { start: startOfMonth(threeMonthsAgo), end: endOfMonth(now) };
      }
      case "last6Months": {
        const sixMonthsAgo = subMonths(now, 5);
        return { start: startOfMonth(sixMonthsAgo), end: endOfMonth(now) };
      }
      case "thisQuarter":
        return { start: startOfQuarter(now), end: endOfMonth(now) };
      case "lastQuarter": {
        const lastQuarter = subQuarters(now, 1);
        return {
          start: startOfQuarter(lastQuarter),
          end: endOfMonth(addMonths(startOfQuarter(lastQuarter), 2)),
        };
      }
      case "thisYear":
        return { start: startOfYear(now), end: endOfMonth(now) };
      case "lastYear": {
        const lastYear = subYears(now, 1);
        return { start: startOfYear(lastYear), end: new Date(currentYear - 1, 11, 31) };
      }
      case "custom":
        return { start: customStart || startOfMonth(now), end: customEnd || endOfMonth(now) };
      default:
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
    }
  };

  const getAggregationLevel = (start: Date, end: Date): "daily" | "weekly" | "monthly" => {
    const days = differenceInDays(end, start);
    if (days <= 31) return "daily";
    if (days <= 180) return "weekly";
    return "monthly";
  };

  // --- Derived helpers for quick chips ---
  const now = new Date();
  const thisMonthAnchor = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const lastMonthAnchor = addMonths(thisMonthAnchor, -1);

  const isThisMonth = isSameMonth(selectedMonth, thisMonthAnchor);
  const isLastMonth = isSameMonth(selectedMonth, lastMonthAnchor);

  const goPrevMonth = () => setSelectedMonth(addMonths(selectedMonth, -1));
  const goNextMonth = () => setSelectedMonth(addMonths(selectedMonth, +1));
  const jumpThisMonth = () => {
    setSelectedMonth(thisMonthAnchor);
    setTimePeriod("thisMonth");
  };
  const jumpLastMonth = () => {
    setSelectedMonth(lastMonthAnchor);
    setTimePeriod("lastMonth");
  };

  // Calculate date range based on current selection
  const dateRange = useMemo(() => {
    return getDateRangeForPeriod(timePeriod, customDateRange.start, customDateRange.end);
  }, [timePeriod, customDateRange, selectedMonth]);

  const aggregationLevel = useMemo(() => getAggregationLevel(dateRange.start, dateRange.end), [dateRange]);

  // --- Fetch data for the selected period ---
  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth(); // 0-based
  const monthNumber = monthIndex + 1; // 1-based

  // Determine which API query to use based on period
  const apiQueryParams = useMemo(() => {
    const startYear = dateRange.start.getFullYear();
    const startMonth = dateRange.start.getMonth() + 1;
    const endYear = dateRange.end.getFullYear();
    const endMonth = dateRange.end.getMonth() + 1;

    // If it's a single month, use the simple endpoint
    if (startYear === endYear && startMonth === endMonth) {
      return { year: startYear, month: startMonth, range: "current-month" as const };
    }

    // For multiple months, we'll fetch and combine
    const months: Array<{ year: number; month: number }> = [];
    let current = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);

    while (current <= end) {
      months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
      current = addMonths(current, 1);
    }

    return { months, range: "multi-month" as const };
  }, [dateRange]);

  const queryReady = useMemo(() => {
    if (!apiQueryParams) return false;

    if (apiQueryParams.range === "current-month") {
      return (
        Number.isFinite(apiQueryParams.year) &&
        Number.isFinite(apiQueryParams.month) &&
        apiQueryParams.month >= 1 &&
        apiQueryParams.month <= 12
      );
    }

    return Array.isArray(apiQueryParams.months) && apiQueryParams.months.length > 0;
  }, [apiQueryParams]);

  const {
    data: rawVolumes = [],
    isLoading,
    isError,
    error,
  } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/period", apiQueryParams],
    queryFn: async () => {
      if (!apiQueryParams) return [];

      if (apiQueryParams.range === "current-month") {
        const resp = await api.get(`/api/patient-volume/period/${apiQueryParams.year}/${apiQueryParams.month}`);
        if (!Array.isArray(resp.data)) {
          // If the backend ever returns an object/string/html, don't let it hit charts
          throw new Error("Patient volume API returned non-array for current-month");
        }
        return resp.data;
      }

      // multi-month (best effort)
      const allData: PatientVolume[] = [];
      const months = Array.isArray(apiQueryParams.months) ? apiQueryParams.months : [];
      for (const { year: y, month: m } of months) {
        try {
          const resp = await api.get(`/api/patient-volume/period/${y}/${m}`);
          if (Array.isArray(resp.data)) allData.push(...resp.data);
        } catch (monthError) {
          console.error(`Failed to fetch month ${y}-${m}:`, monthError);
        }
      }
      return allData;
    },
    enabled: queryReady,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    // extra guard: even if queryFn changes later, cached "data" is always an array
    select: (data) => (Array.isArray(data) ? data : []),
  });

  // --- Comparison Period Data ---
  const comparisonDateRange = useMemo(() => {
    if (!showComparison) return null;

    const periodDays = differenceInDays(dateRange.end, dateRange.start);

    if (comparisonTimePeriod === "previousPeriod") {
      return { start: subDays(dateRange.start, periodDays + 1), end: subDays(dateRange.start, 1) };
    }
    if (comparisonTimePeriod === "previousYear") {
      return { start: subYears(dateRange.start, 1), end: subYears(dateRange.end, 1) };
    }
    return null;
  }, [showComparison, comparisonTimePeriod, dateRange]);

  const comparisonApiQueryParams = useMemo(() => {
    if (!comparisonDateRange) return null;

    const startYear = comparisonDateRange.start.getFullYear();
    const startMonth = comparisonDateRange.start.getMonth() + 1;
    const endYear = comparisonDateRange.end.getFullYear();
    const endMonth = comparisonDateRange.end.getMonth() + 1;

    if (startYear === endYear && startMonth === endMonth) {
      return { year: startYear, month: startMonth, range: "current-month" as const };
    }

    const months: Array<{ year: number; month: number }> = [];
    let current = new Date(startYear, startMonth - 1, 1);
    const end = new Date(endYear, endMonth - 1, 1);

    while (current <= end) {
      months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
      current = addMonths(current, 1);
    }

    return { months, range: "multi-month" as const };
  }, [comparisonDateRange]);

  const { data: rawComparisonVolumes = [], isLoading: isLoadingComparison } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/comparison", comparisonApiQueryParams],
    queryFn: async () => {
      if (!comparisonApiQueryParams) return [];

      if (comparisonApiQueryParams.range === "current-month") {
        const resp = await api.get(
          `/api/patient-volume/period/${comparisonApiQueryParams.year}/${comparisonApiQueryParams.month}`
        );
        return Array.isArray(resp.data) ? resp.data : [];
      }

      const allData: PatientVolume[] = [];
      const months = comparisonApiQueryParams.months || [];
      for (const { year: y, month: m } of months) {
        try {
          const resp = await api.get(`/api/patient-volume/period/${y}/${m}`);
          if (Array.isArray(resp.data)) allData.push(...resp.data);
        } catch {
          // keep going
        }
      }
      return allData;
    },
    enabled: !!comparisonApiQueryParams && showComparison,
    retry: 1,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  // Filter comparison volumes to only include those in the comparison date range
  const filteredComparisonVolumes = useMemo(() => {
    if (!comparisonDateRange) return [];
    return rawComparisonVolumes.filter((v) => {
      const d = parseISO(v.date);
      return isWithinInterval(d, { start: comparisonDateRange.start, end: comparisonDateRange.end });
    });
  }, [rawComparisonVolumes, comparisonDateRange]);

  // --- Normalize & aggregate data based on aggregation level ---
  const daysInMonth = useMemo(() => new Date(year, monthIndex + 1, 0).getDate(), [year, monthIndex]);

  // Filter volumes to only include those in the date range
  const filteredVolumes = useMemo(() => {
    return rawVolumes.filter((v) => {
      const d = parseISO(v.date);
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    });
  }, [rawVolumes, dateRange]);

  // Aggregate data based on aggregation level
  const { chartData, xTicks, totalPatients, activeDays, peakCount, peakLabel } = useMemo(() => {
    if (aggregationLevel === "daily") {
      const days = differenceInDays(dateRange.end, dateRange.start) + 1;
      const buckets = Array.from({ length: days }, () => 0);

      for (const v of filteredVolumes) {
        const d = parseISO(v.date);
        const dayOffset = differenceInDays(d, dateRange.start);
        if (dayOffset >= 0 && dayOffset < days) {
          buckets[dayOffset] += Number(v.patientCount || 0);
        }
      }

      const data = buckets.map((count, idx) => ({
        label: format(addDays(dateRange.start, idx), "d"),
        day: idx + 1,
        count: count > 0 ? count : 0,
      }));

      const ticks = Array.from({ length: days }, (_, i) => i + 1);
      const total = buckets.reduce((s, n) => s + n, 0);
      const active = buckets.filter((c) => c > 0).length;
      const peak = Math.max(0, ...buckets);
      const peakIdx = peak > 0 ? buckets.findIndex((n) => n === peak) : null;
      const peakLbl = peakIdx !== null ? format(addDays(dateRange.start, peakIdx), "EEE, MMM d, yyyy") : "—";

      return {
        chartData: data,
        xTicks: ticks,
        totalPatients: total,
        activeDays: active,
        peakCount: peak,
        peakLabel: peakLbl,
      };
    }

    if (aggregationLevel === "weekly") {
      const weeks = eachWeekOfInterval({ start: dateRange.start, end: dateRange.end }, { weekStartsOn: 0 });
      const buckets = weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const count = filteredVolumes
          .filter((v) => {
            const d = parseISO(v.date);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
          })
          .reduce((s, v) => s + Number(v.patientCount || 0), 0);
        return { weekStart, weekEnd, count };
      });

      const data = buckets.map((bucket, idx) => ({
        label: `${format(bucket.weekStart, "MMM d")}`,
        week: idx + 1,
        count: bucket.count,
      }));

      const ticks = buckets.map((_, idx) => idx + 1);
      const total = buckets.reduce((s, b) => s + b.count, 0);
      const active = buckets.filter((b) => b.count > 0).length;
      const peak = Math.max(0, ...buckets.map((b) => b.count));
      const peakIdx = peak > 0 ? buckets.findIndex((b) => b.count === peak) : null;
      const peakLbl = peakIdx !== null ? `Week of ${format(buckets[peakIdx].weekStart, "MMM d, yyyy")}` : "—";

      return {
        chartData: data,
        xTicks: ticks,
        totalPatients: total,
        activeDays: active,
        peakCount: peak,
        peakLabel: peakLbl,
      };
    }

    // monthly
    const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
    const buckets = months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const count = filteredVolumes
        .filter((v) => {
          const d = parseISO(v.date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        })
        .reduce((s, v) => s + Number(v.patientCount || 0), 0);
      return { monthStart, monthEnd, count };
    });

    const data = buckets.map((bucket, idx) => ({
      label: format(bucket.monthStart, "MMM yyyy"),
      month: idx + 1,
      count: bucket.count,
    }));

    const ticks = buckets.map((_, idx) => idx + 1);
    const total = buckets.reduce((s, b) => s + b.count, 0);
    const active = buckets.filter((b) => b.count > 0).length;
    const peak = Math.max(0, ...buckets.map((b) => b.count));
    const peakIdx = peak > 0 ? buckets.findIndex((b) => b.count === peak) : null;
    const peakLbl = peakIdx !== null ? format(buckets[peakIdx].monthStart, "MMMM yyyy") : "—";

    return {
      chartData: data,
      xTicks: ticks,
      totalPatients: total,
      activeDays: active,
      peakCount: peak,
      peakLabel: peakLbl,
    };
  }, [filteredVolumes, aggregationLevel, dateRange]);

  // Aggregate comparison data based on aggregation level
  const comparisonChartData = useMemo(() => {
    if (!showComparison || !comparisonDateRange || filteredComparisonVolumes.length === 0) return null;

    if (aggregationLevel === "daily") {
      const days = differenceInDays(comparisonDateRange.end, comparisonDateRange.start) + 1;
      const buckets = Array.from({ length: days }, () => 0);

      for (const v of filteredComparisonVolumes) {
        const d = parseISO(v.date);
        const dayOffset = differenceInDays(d, comparisonDateRange.start);
        if (dayOffset >= 0 && dayOffset < days) {
          buckets[dayOffset] += Number(v.patientCount || 0);
        }
      }

      return buckets.map((count, idx) => ({
        label: format(addDays(comparisonDateRange.start, idx), "d"),
        count,
      }));
    }

    if (aggregationLevel === "weekly") {
      const weeks = eachWeekOfInterval(
        { start: comparisonDateRange.start, end: comparisonDateRange.end },
        { weekStartsOn: 0 }
      );
      const buckets = weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const count = filteredComparisonVolumes
          .filter((v) => {
            const d = parseISO(v.date);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
          })
          .reduce((s, v) => s + Number(v.patientCount || 0), 0);
        return { weekStart, count };
      });

      return buckets.map((bucket) => ({
        label: `${format(bucket.weekStart, "MMM d")}`,
        count: bucket.count,
      }));
    }

    const months = eachMonthOfInterval({ start: comparisonDateRange.start, end: comparisonDateRange.end });
    const buckets = months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const count = filteredComparisonVolumes
        .filter((v) => {
          const d = parseISO(v.date);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        })
        .reduce((s, v) => s + Number(v.patientCount || 0), 0);
      return { monthStart, count };
    });

    return buckets.map((bucket) => ({
      label: format(bucket.monthStart, "MMM yyyy"),
      count: bucket.count,
    }));
  }, [showComparison, comparisonDateRange, filteredComparisonVolumes, aggregationLevel]);

  // Calculate comparison total for KPI display (safe)
  const comparisonTotal = useMemo(() => {
    const arr = asArray<{ count: unknown }>(comparisonChartData);
    return arr.reduce((s, d) => s + toFiniteNumber(d.count), 0);
  }, [comparisonChartData]);

  const percentageChange = useMemo(() => {
    if (!comparisonTotal || comparisonTotal === 0) return 0;
    return ((totalPatients - comparisonTotal) / comparisonTotal) * 100;
  }, [totalPatients, comparisonTotal]);

  // Calculate dynamic legend name based on date range
  const currentPeriodLegendName = useMemo(() => {
    if (aggregationLevel === "daily") {
      // For daily view, show the month name
      return format(dateRange.start, "MMMM yyyy");
    } else if (aggregationLevel === "weekly") {
      // For weekly view, show date range
      return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d")}`;
    } else {
      // For monthly view, show year or year range
      const startYear = dateRange.start.getFullYear();
      const endYear = dateRange.end.getFullYear();
      return startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;
    }
  }, [dateRange, aggregationLevel]);

  // Combine main and comparison data for charts (MERGE BY LABEL, NOT INDEX)
  const combinedChartData = useMemo(() => {
    const base = asArray<any>(chartData);

    if (!showComparison) {
      return base.map((d) => ({ ...d, comparisonCount: undefined }));
    }

    const comp = asArray<any>(comparisonChartData);
    const compMap = new Map<string, number>(comp.map((d) => [toLabel(d.label), toFiniteNumber(d.count)]));

    return base.map((d) => ({
      ...d,
      comparisonCount: compMap.get(toLabel(d.label)) ?? 0,
    }));
  }, [chartData, comparisonChartData, showComparison]);

  // FINAL SAFETY: Recharts *always* receives an array + finite numbers
  const safeCombinedChartData = useMemo(() => {
    return asArray<any>(combinedChartData).map((d) => ({
      ...d,
      label: toLabel(d?.label),
      count: toFiniteNumber(d?.count),
      comparisonCount: showComparison ? toFiniteNumber(d?.comparisonCount) : undefined,
    }));
  }, [combinedChartData, showComparison]);

  // For backwards compatibility, create dayBuckets for table view
  const dayBuckets = useMemo(() => {
    if (aggregationLevel !== "daily") {
      return Array.from({ length: daysInMonth }, () => 0);
    }
    const buckets = Array.from({ length: daysInMonth }, () => 0);
    for (const v of rawVolumes) {
      const d = parseISO(v.date);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        buckets[day - 1] += Number(v.patientCount || 0);
      }
    }
    return buckets;
  }, [rawVolumes, daysInMonth, year, monthIndex, aggregationLevel]);

  const avgPerActiveDay = activeDays ? totalPatients / activeDays : 0;

  // --- Additional Analytics Metrics ---
  const sortedCounts = chartData
    .filter((d: any) => toFiniteNumber(d.count) > 0)
    .map((d: any) => toFiniteNumber(d.count))
    .sort((a, b) => a - b);

  const medianPatients =
    sortedCounts.length > 0
      ? sortedCounts.length % 2 === 0
        ? (sortedCounts[sortedCounts.length / 2 - 1] + sortedCounts[sortedCounts.length / 2]) / 2
        : sortedCounts[Math.floor(sortedCounts.length / 2)]
      : 0;

  // Projected total
  const today = new Date();
  const isCurrentPeriod = isWithinInterval(today, { start: dateRange.start, end: dateRange.end });
  const currentDayOfPeriod = isCurrentPeriod
    ? differenceInDays(today, dateRange.start) + 1
    : differenceInDays(dateRange.end, dateRange.start) + 1;
  const totalDaysInPeriod = differenceInDays(dateRange.end, dateRange.start) + 1;
  const remainingDays = totalDaysInPeriod - currentDayOfPeriod;
  const activeDayRatio = activeDays > 0 ? activeDays / currentDayOfPeriod : 0.7;
  const estimatedRemainingActiveDays = Math.round(remainingDays * activeDayRatio);
  const projectedTotal = totalPatients + avgPerActiveDay * estimatedRemainingActiveDays;

  // Week-over-Week Growth
  const { data: prevWeekVolumes = [] } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/prevWeek", year, monthNumber],
    queryFn: async () => {
      const weekStart = startOfWeek(selectedMonth);
      const prevWeekStart0 = subWeeks(weekStart, 1);
      const prevYear = prevWeekStart0.getFullYear();
      const prevMonth0 = prevWeekStart0.getMonth() + 1;
      const resp = await api.get(`/api/patient-volume/period/${prevYear}/${prevMonth0}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const currentWeekTotal = dayBuckets.slice(-7).reduce((s, n) => s + n, 0);
  const prevWeekStart = subWeeks(selectedMonth, 1);
  const prevWeekEnd = subDays(selectedMonth, 1);
  const prevWeekTotal = prevWeekVolumes
    .filter((v) => {
      const d = parseISO(v.date);
      return d.getTime() >= prevWeekStart.getTime() && d.getTime() <= prevWeekEnd.getTime();
    })
    .reduce((s, v) => s + Number(v.patientCount || 0), 0);

  const weekOverWeekGrowth = prevWeekTotal > 0 ? ((currentWeekTotal - prevWeekTotal) / prevWeekTotal) * 100 : 0;

  // Month-over-Month Trend
  const prevMonth = addMonths(selectedMonth, -1);
  const { data: prevMonthVolumes = [] } = useQuery<PatientVolume[]>({
    queryKey: ["/api/patient-volume/period", prevMonth.getFullYear(), prevMonth.getMonth() + 1],
    queryFn: async () => {
      const resp = await api.get(`/api/patient-volume/period/${prevMonth.getFullYear()}/${prevMonth.getMonth() + 1}`);
      return Array.isArray(resp.data) ? resp.data : [];
    },
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const prevMonthTotal = prevMonthVolumes.reduce((s, v) => s + Number(v.patientCount || 0), 0);
  const monthOverMonthGrowth = prevMonthTotal > 0 ? ((totalPatients - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  // Weekday distribution (✅ always array)
  const weekdayDistribution = useMemo<WeekdayDistributionRow[]>(() => {
    const counts = Array(7).fill(0);

    filteredVolumes.forEach((v) => {
      const d = parseISO(v.date);
      const dayOfWeek = getDay(d);
      counts[dayOfWeek] += Number(v.patientCount || 0);
    });

    const total = counts.reduce((s, n) => s + n, 0);
    return WEEKDAYS.map((day, i) => ({
      day,
      count: counts[i],
      percentage: total > 0 ? (counts[i] / total) * 100 : 0,
    }));
  }, [filteredVolumes]);

  // ✅ Pie safety: always pass an array to <Pie data={...}>
  const weekdayPieData = useMemo(
    () => asArray<WeekdayDistributionRow>(weekdayDistribution).filter((d) => toFiniteNumber(d.count) > 0),
    [weekdayDistribution]
  );

  // Heatmap data for calendar view
  const heatmapData = useMemo(() => {
    const data: Array<{ date: Date; count: number; dayOfWeek: number; weekOfPeriod: number }> = [];
    const maxCount = Math.max(0, ...filteredVolumes.map((v) => Number(v.patientCount || 0)));

    const dateCountMap = new Map<string, number>();
    filteredVolumes.forEach((v) => {
      const d = parseISO(v.date);
      const key = format(d, "yyyy-MM-dd");
      dateCountMap.set(key, (dateCountMap.get(key) || 0) + Number(v.patientCount || 0));
    });

    let currentDate = startOfDay(dateRange.start);
    const endDate = endOfDay(dateRange.end);
    let weekNumber = 0;
    let lastSunday = startOfWeek(currentDate, { weekStartsOn: 0 });

    while (currentDate <= endDate) {
      const key = format(currentDate, "yyyy-MM-dd");
      const count = dateCountMap.get(key) || 0;
      const dayOfWeek = getDay(currentDate);

      const currentSunday = startOfWeek(currentDate, { weekStartsOn: 0 });
      if (currentSunday.getTime() !== lastSunday.getTime()) {
        weekNumber++;
        lastSunday = currentSunday;
      }

      data.push({ date: currentDate, count, dayOfWeek, weekOfPeriod: weekNumber });
      currentDate = addDays(currentDate, 1);
    }

    return { data, maxCount };
  }, [filteredVolumes, dateRange]);

  // --- Export Functions ---
  const exportToCSV = () => {
    const headers = ["Period", "Patient Count"];
    const rows = chartData.map((d: any) => [d.label, d.count]);

    const csv = [headers.join(","), ...rows.map((row: any) => row.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const periodLabel =
      timePeriod === "custom"
        ? `${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}`
        : timePeriod;

    a.download = `patient-volume-${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported successfully" });
  };

  const monthTitle = format(selectedMonth, "MMMM yyyy");

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case "thisMonth":
        return "This Month";
      case "lastMonth":
        return "Last Month";
      case "last3Months":
        return "Last 3 Months";
      case "last6Months":
        return "Last 6 Months";
      case "thisQuarter":
        return "This Quarter";
      case "lastQuarter":
        return "Last Quarter";
      case "thisYear":
        return "This Year";
      case "lastYear":
        return "Last Year";
      case "custom":
        return `${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`;
      default:
        return monthTitle;
    }
  };

  const exportToPDF = async () => {
    try {
      const periodLabel = getPeriodLabel();
      const printContent = `
        <html>
          <head>
            <title>Patient Volume Report - ${periodLabel}</title>
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
            <p><strong>Period:</strong> ${periodLabel}</p>
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
                <div class="metric-label">Peak ${
                  aggregationLevel === "daily" ? "Day" : aggregationLevel === "weekly" ? "Week" : "Month"
                }</div>
                <div class="metric-value">${peakCount}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr><th>Period</th><th>Patient Count</th></tr>
              </thead>
              <tbody>
                ${chartData.map((d: any) => `<tr><td>${d.label}</td><td>${d.count}</td></tr>`).join("")}
              </tbody>
            </table>
          </body>
        </html>
      `.trim();

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          toast({ title: "Print report ready" });
        }, 250);
      }
    } catch {
      toast({ title: "Failed to generate report", variant: "destructive" });
    }
  };

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patient-volume", data),
    onSuccess: () => {
      // ✅ invalidate by PREFIX so it matches your real queryKey shapes
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/prevWeek"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/period"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-volume/prevWeek"] });
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
        description: "To change the value, delete the existing entry for this date in the table, then add a new one.",
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
  const TooltipBox = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const diffFromAvg = toFiniteNumber(p.count) - avgPerActiveDay;
    const percentDiff = avgPerActiveDay > 0 ? ((diffFromAvg / avgPerActiveDay) * 100).toFixed(1) : "0";

    // Create a clear header: "Day X" or full date depending on aggregation level
    let header = "";
    if (aggregationLevel === "daily") {
      // For daily view, show "Day X" or full date
      const dayNum = p.day;
      if (typeof dayNum === "number") {
        const fullDate = format(new Date(year, monthIndex, dayNum), "MMMM d");
        header = fullDate;
      } else {
        header = p.label || "";
      }
    } else if (aggregationLevel === "weekly") {
      header = `Week ${p.week || p.label}`;
    } else {
      header = p.label || "";
    }

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 min-w-[180px]">
        <div className="text-sm font-semibold text-slate-700 mb-2">{header}</div>
        <div className="text-lg font-bold text-slate-900 mb-2">
          {toFiniteNumber(p.count)} patient{toFiniteNumber(p.count) !== 1 ? "s" : ""}
        </div>
        {avgPerActiveDay > 0 && (
          <div className="text-xs text-slate-600">
            <span className={cn(
              "font-semibold",
              diffFromAvg > 0 ? "text-emerald-600" : diffFromAvg < 0 ? "text-red-600" : "text-slate-500"
            )}>
              {diffFromAvg > 0 ? "+" : ""}{percentDiff}%
            </span>
            {" "}
            {diffFromAvg >= 0 ? "above" : "below"} average
          </div>
        )}
        {targetValue && (
          <div className="text-xs text-slate-600 mt-1">
            Target: {targetValue} {toFiniteNumber(p.count) >= targetValue ? "✓" : ""}
          </div>
        )}
      </div>
    );
  };

  const WEEKDAY_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6"];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader variant="patientVolume" title="Patient Volume Tracking" subtitle="Monthly & multi-period summary">
          <HeaderAction variant="light" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
            Add Volume
          </HeaderAction>
        </PageHeader>

        <AppContainer className="space-y-6 py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading patient volume data...</p>
            </div>
          </div>
        </AppContainer>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PageHeader variant="patientVolume" title="Patient Volume Tracking" subtitle="Monthly & multi-period summary">
          <HeaderAction variant="light" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
            Add Volume
          </HeaderAction>
        </PageHeader>

        <AppContainer className="space-y-6 py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load patient volume data</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        </AppContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader variant="patientVolume" title="Patient Volume Tracking" subtitle="Monthly & multi-period summary">
        <HeaderAction variant="light" icon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
          Add Volume
        </HeaderAction>
      </PageHeader>

      <AppContainer className="space-y-6 py-6">
        {/* KPI cards - Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">Total Patients</div>
              <div className="text-2xl font-semibold">{totalPatients.toLocaleString()}</div>
              {showComparison && comparisonTotal > 0 && (
                <div className="text-xs mt-1 flex items-center gap-1">
                  <span
                    className={cn(
                      "font-medium",
                      percentageChange > 0 ? "text-green-600" : percentageChange < 0 ? "text-red-600" : "text-slate-500"
                    )}
                  >
                    {percentageChange > 0 ? "+" : ""}
                    {percentageChange.toFixed(1)}%
                  </span>
                  <span className="text-slate-500">vs comparison</span>
                </div>
              )}
              {!showComparison && <div className="text-xs text-slate-500">{getPeriodLabel()}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">
                Average / Active {aggregationLevel === "daily" ? "Day" : aggregationLevel === "weekly" ? "Week" : "Month"}
              </div>
              <div className="text-2xl font-semibold">
                {activeDays ? (Math.round(avgPerActiveDay * 10) / 10).toLocaleString() : 0}
              </div>
              <div className="text-xs text-slate-500">
                {activeDays} active {aggregationLevel === "daily" ? "days" : aggregationLevel === "weekly" ? "weeks" : "months"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600">
                Peak {aggregationLevel === "daily" ? "Day" : aggregationLevel === "weekly" ? "Week" : "Month"}
              </div>
              <div className="text-2xl font-semibold">{peakCount}</div>
              <div className="text-xs text-slate-500">{peakLabel}</div>
            </CardContent>
          </Card>
        </div>

        {/* KPI cards - Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-600 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Week-over-Week
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-2xl font-semibold">
                  {weekOverWeekGrowth > 0 ? "+" : ""}
                  {weekOverWeekGrowth.toFixed(1)}%
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
                  {monthOverMonthGrowth > 0 ? "+" : ""}
                  {monthOverMonthGrowth.toFixed(1)}%
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
              <div className="text-2xl font-semibold">{medianPatients ? Math.round(medianPatients * 10) / 10 : 0}</div>
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
                {isCurrentPeriod ? Math.round(projectedTotal).toLocaleString() : totalPatients.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">{isCurrentPeriod ? "Based on current trend" : "Final total"}</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={timePeriod}
                onValueChange={(value) => {
                  setTimePeriod(value);
                  if (value === "thisMonth") setSelectedMonth(thisMonthAnchor);
                  else if (value === "lastMonth") setSelectedMonth(lastMonthAnchor);
                }}
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="last3Months">Last 3 Months</SelectItem>
                  <SelectItem value="last6Months">Last 6 Months</SelectItem>
                  <SelectItem value="thisQuarter">This Quarter</SelectItem>
                  <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="lastYear">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {timePeriod === "custom" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-8">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customDateRange.start ? format(customDateRange.start, "MMM d, yyyy") : "Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl">
                      <Calendar
                        mode="single"
                        selected={customDateRange.start}
                        onSelect={(d) => setCustomDateRange((prev) => ({ ...prev, start: d }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-8">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customDateRange.end ? format(customDateRange.end, "MMM d, yyyy") : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-white border border-slate-200 shadow-xl">
                      <Calendar
                        mode="single"
                        selected={customDateRange.end}
                        onSelect={(d) => setCustomDateRange((prev) => ({ ...prev, end: d }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}

              {(timePeriod === "thisMonth" || timePeriod === "lastMonth") && (
                <>
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrevMonth} title="Previous month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNextMonth} title="Next month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              <div className="mx-1 h-6 w-px bg-slate-200" />
              <Button
                variant={showComparison ? "default" : "outline"}
                size="sm"
                className={cn("h-8", showComparison && "bg-purple-600 hover:bg-purple-700")}
                onClick={() => setShowComparison(!showComparison)}
              >
                Compare
              </Button>

              {showComparison && (
                <Select value={comparisonTimePeriod} onValueChange={setComparisonTimePeriod}>
                  <SelectTrigger className="h-8 w-[160px]">
                    <SelectValue placeholder="Compare to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previousPeriod">Previous Period</SelectItem>
                    <SelectItem value="previousYear">Previous Year</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={exportToCSV}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={exportToPDF} title="Print report">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Print
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-1 border border-slate-200 rounded-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", chartType === "bar" && "bg-teal-50 text-teal-700 hover:bg-teal-100")}
                  onClick={() => setChartType("bar")}
                  title="Bar Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", chartType === "line" && "bg-teal-50 text-teal-700 hover:bg-teal-100")}
                  onClick={() => setChartType("line")}
                  title="Line Chart"
                >
                  <LineChart className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", chartType === "area" && "bg-teal-50 text-teal-700 hover:bg-teal-100")}
                  onClick={() => setChartType("area")}
                  title="Area Chart"
                >
                  <AreaChart className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", chartType === "heatmap" && "bg-teal-50 text-teal-700 hover:bg-teal-100")}
                  onClick={() => setChartType("heatmap")}
                  title="Heatmap Calendar"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
              </div>

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

            <div className="flex gap-2">
              <Button
                variant={mode === "chart" ? "default" : "outline"}
                className={cn(
                  "h-8 px-3",
                  mode === "chart" ? "bg-slate-900 hover:bg-slate-800 text-white [&>svg]:text-white" : "text-slate-700"
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
                  mode === "table" ? "bg-slate-900 hover:bg-slate-800 text-white [&>svg]:text-white" : "text-slate-700"
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
            {mode === "chart" ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={chartType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="h-[400px]"
                >
                  {/* ✅ Heatmap is NOT a Recharts chart - don't wrap it in ResponsiveContainer */}
                  {chartType === "heatmap" ? (
                    <div className="w-full h-full overflow-auto">
                      <div className="min-w-max">
                        <div className="mb-4 flex items-center gap-2 text-xs text-slate-600">
                          <span>Less</span>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map((level) => {
                              const intensity = level === 0 ? 0 : level / 4;
                              return (
                                <div
                                  key={level}
                                  className="w-4 h-4 rounded-sm border border-slate-200"
                                  style={{
                                    backgroundColor: level === 0 ? "#f1f5f9" : `rgba(20, 184, 166, ${0.2 + intensity * 0.8})`,
                                  }}
                                />
                              );
                            })}
                          </div>
                          <span>More</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex gap-1 mb-2">
                            <div className="w-12 text-xs text-slate-500"></div>
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                              <div key={idx} className="w-3 text-[10px] text-slate-500 text-center">
                                {day[0]}
                              </div>
                            ))}
                          </div>

                          {Array.from(new Set(heatmapData.data.map((d) => d.weekOfPeriod))).map((weekNum) => {
                            const weekData = heatmapData.data.filter((d) => d.weekOfPeriod === weekNum);
                            const weekStart = weekData[0]?.date;

                            return (
                              <div key={weekNum} className="flex gap-1 items-center">
                                <div className="w-12 text-[10px] text-slate-500 text-right pr-2">
                                  {weekStart ? format(weekStart, "MMM d") : ""}
                                </div>
                                {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
                                  const dayData = weekData.find((d) => d.dayOfWeek === dayOfWeek);
                                  if (!dayData) return <div key={dayOfWeek} className="w-3 h-3" />;

                                  const intensity = heatmapData.maxCount > 0 ? dayData.count / heatmapData.maxCount : 0;
                                  const bgColor =
                                    dayData.count === 0 ? "#f1f5f9" : `rgba(20, 184, 166, ${0.2 + intensity * 0.8})`;

                                  return (
                                    <div
                                      key={dayOfWeek}
                                      className="w-3 h-3 rounded-sm border border-slate-200 cursor-pointer hover:ring-2 hover:ring-teal-400 transition-all"
                                      style={{ backgroundColor: bgColor }}
                                      title={`${format(dayData.date, "MMM d, yyyy")}: ${dayData.count} patients`}
                                    />
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : safeCombinedChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">No data for this period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={safeCombinedChartData} margin={{ top: 20, right: 16, left: 4, bottom: 8 }} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.5} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            axisLine={{ stroke: "#e5e7eb" }}
                            tickLine={false}
                            angle={0}
                            textAnchor="middle"
                            height={30}
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
                          <Legend />
                          {targetValue && (
                            <ReferenceLine
                              y={targetValue}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                              label={{ value: `Target: ${targetValue}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                            />
                          )}
                          {showTrendLine &&
                            safeCombinedChartData.length > 1 &&
                            (() => {
                              const nonZeroData = safeCombinedChartData.filter((d) => toFiniteNumber(d.count) > 0);
                              if (nonZeroData.length < 2) return null;

                              const dataWithIndex = nonZeroData.map((d, i) => ({ ...d, index: i }));
                              const n = dataWithIndex.length;
                              const sumX = dataWithIndex.reduce((s, d) => s + d.index, 0);
                              const sumY = dataWithIndex.reduce((s, d) => s + toFiniteNumber(d.count), 0);
                              const sumXY = dataWithIndex.reduce((s, d) => s + d.index * toFiniteNumber(d.count), 0);
                              const sumX2 = dataWithIndex.reduce((s, d) => s + d.index * d.index, 0);

                              const denom = n * sumX2 - sumX * sumX;
                              if (denom === 0) return null;

                              const slope = (n * sumXY - sumX * sumY) / denom;
                              const intercept = (sumY - slope * sumX) / n;

                              const y1 = slope * 0 + intercept;
                              const y2 = slope * (safeCombinedChartData.length - 1) + intercept;

                              return (
                                <ReferenceLine
                                  segment={[
                                    { x: safeCombinedChartData[0].label, y: Math.max(0, y1) },
                                    { x: safeCombinedChartData[safeCombinedChartData.length - 1].label, y: Math.max(0, y2) },
                                  ]}
                                  stroke="#3b82f6"
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                />
                              );
                            })()}
                          <Bar dataKey="count" name={currentPeriodLegendName} fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={32}>
                            <LabelList 
                              dataKey="count" 
                              position="top" 
                              formatter={(value: number) => value > 0 ? value : ''}
                              style={BAR_LABEL_STYLE} 
                            />
                          </Bar>
                          {showComparison && (
                            <Bar dataKey="comparisonCount" name="Comparison Period" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={32}>
                              <LabelList 
                                dataKey="comparisonCount" 
                                position="top" 
                                formatter={(value: number) => value > 0 ? value : ''}
                                style={BAR_LABEL_STYLE} 
                              />
                            </Bar>
                          )}
                        </BarChart>
                      ) : chartType === "line" ? (
                        <RechartsLineChart data={safeCombinedChartData} margin={{ top: 20, right: 16, left: 4, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.5} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            axisLine={{ stroke: "#e5e7eb" }}
                            tickLine={false}
                            angle={0}
                            textAnchor="middle"
                            height={30}
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
                          <Legend />
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
                            name={currentPeriodLegendName}
                            stroke="#14b8a6"
                            strokeWidth={2.5}
                            dot={{ fill: "#14b8a6", r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          {showComparison && (
                            <Line
                              type="monotone"
                              dataKey="comparisonCount"
                              name="Comparison Period"
                              stroke="#a78bfa"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              dot={{ fill: "#a78bfa", r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          )}
                        </RechartsLineChart>
                      ) : (
                        <RechartsAreaChart data={safeCombinedChartData} margin={{ top: 20, right: 16, left: 4, bottom: 8 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="colorComparison" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="1 1" stroke="#eef2f7" opacity={0.5} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: "#64748b" }}
                            axisLine={{ stroke: "#e5e7eb" }}
                            tickLine={false}
                            angle={0}
                            textAnchor="middle"
                            height={30}
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
                          <Legend />
                          {targetValue && (
                            <ReferenceLine
                              y={targetValue}
                              stroke="#f59e0b"
                              strokeDasharray="3 3"
                              label={{ value: `Target: ${targetValue}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 11 }}
                            />
                          )}
                          <Area type="monotone" dataKey="count" name={currentPeriodLegendName} stroke="#14b8a6" strokeWidth={2} fill="url(#colorCount)" />
                          {showComparison && (
                            <Area
                              type="monotone"
                              dataKey="comparisonCount"
                              name="Comparison Period"
                              stroke="#a78bfa"
                              strokeWidth={2}
                              fill="url(#colorComparison)"
                            />
                          )}
                        </RechartsAreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </motion.div>
              </AnimatePresence>
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

        {/* Weekday Distribution */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Weekday Distribution</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weekdayPieData}
                      dataKey="count"
                      nameKey="day"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ day, percentage }: any) =>
                        Number(percentage) > 0 ? `${String(day).slice(0, 3)}: ${Number(percentage).toFixed(1)}%` : ""
                      }
                      labelLine={true}
                    >
                      {weekdayPieData.map((entry) => {
                        const idx = WEEKDAYS.indexOf(entry.day as any);
                        return <Cell key={entry.day} fill={WEEKDAY_COLORS[idx >= 0 ? idx : 0]} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        `${value} patients (${totalPatients > 0 ? ((value / totalPatients) * 100).toFixed(1) : "0"}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {weekdayDistribution.map((day, idx) => {
                  const max = Math.max(...weekdayDistribution.map((d) => d.count));
                  const min = Math.min(...weekdayDistribution.filter((d) => d.count > 0).map((d) => d.count));
                  const isMax = day.count === max;
                  const isMin = day.count > 0 && day.count === min;

                  return (
                    <div key={day.day} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: WEEKDAY_COLORS[idx] }} />
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
                            style={{ width: `${day.percentage}%`, backgroundColor: WEEKDAY_COLORS[idx] }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{day.percentage.toFixed(1)}%</span>
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
                  <X className="w-4 h-4" />
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
                    <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={createMutation.isPending}>
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
