/**
 * Expense Analytics Data Hook
 *
 * Custom hook for fetching and processing expense analytics data
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import {
  calculateCategoryMetrics,
  calculateKPIs,
  generateInsights,
  normalizeBreakdown,
  type MonthlyExpenseData,
  type CategoryMetrics,
} from "../utils/calculations";
import { getDateRange, formatDateForAPI, type RangeKey } from "@/lib/dateRanges";

export type FilterPreset = RangeKey | "custom";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Main hook for expense analytics
 */
export function useExpenseAnalytics(preset: FilterPreset = "this-year", customRange?: DateRange) {
  // Freeze "now" for this hook instance so query keys don't change every render
  const stableNow = useMemo(() => new Date(), []);

  const dateRange: DateRange = useMemo(() => {
    if (preset === "custom") {
      return (
        customRange || {
          startDate: new Date(stableNow.getFullYear(), 0, 1),
          endDate: stableNow,
        }
      );
    }

    const range = getDateRange(preset as RangeKey, stableNow);
    return { startDate: range.startDate, endDate: range.endDate };
  }, [
    preset,
    stableNow,
    customRange?.startDate?.getTime(),
    customRange?.endDate?.getTime(),
  ]);

  const prevDateRange: DateRange = useMemo(() => {
    const diffMs = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const prevEndDate = new Date(dateRange.startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - diffMs);
    return { startDate: prevStartDate, endDate: prevEndDate };
  }, [dateRange.startDate.getTime(), dateRange.endDate.getTime()]);

  const startStr = useMemo(() => formatDateForAPI(dateRange.startDate), [dateRange.startDate.getTime()]);
  const endStr = useMemo(() => formatDateForAPI(dateRange.endDate), [dateRange.endDate.getTime()]);

  const prevStartStr = useMemo(
    () => formatDateForAPI(prevDateRange.startDate),
    [prevDateRange.startDate.getTime()]
  );
  const prevEndStr = useMemo(
    () => formatDateForAPI(prevDateRange.endDate),
    [prevDateRange.endDate.getTime()]
  );

  const {
    data: trendData = [],
    isLoading: loadingTrend,
    error: trendError,
  } = useQuery({
    queryKey: ["expense-analytics-trend", startStr, endStr],
    queryFn: async () => {
      const response = await api.get(
        `/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`
      );
      return response.data as MonthlyExpenseData[];
    },
  });

  const { data: prevTrendData = [], isLoading: loadingPrevTrend } = useQuery({
    queryKey: ["expense-analytics-trend-prev", prevStartStr, prevEndStr],
    queryFn: async () => {
      const response = await api.get(
        `/api/trends/monthly-revenue?startDate=${prevStartStr}&endDate=${prevEndStr}`
      );
      return response.data as MonthlyExpenseData[];
    },
  });

  const metrics: CategoryMetrics[] = useMemo(() => {
    return calculateCategoryMetrics(trendData, prevTrendData);
  }, [trendData, prevTrendData]);

  const kpis = useMemo(() => {
    return calculateKPIs(trendData, prevTrendData, metrics);
  }, [trendData, prevTrendData, metrics]);

  const insights = useMemo(() => {
    return generateInsights(metrics, kpis, trendData, prevTrendData);
  }, [metrics, kpis, trendData, prevTrendData]);

  const chartData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];

    return trendData
      .filter((month) => month && month.month)
      .map((month) => {
        const breakdown = normalizeBreakdown(month.expenseBreakdown);

        return {
          month: month.month || month.fullMonth || "",
          fullMonth: month.fullMonth || month.month || "",
          total: typeof month.totalExpenses === "number" && Number.isFinite(month.totalExpenses) ? month.totalExpenses : 0,
          ...breakdown,
        };
      });
  }, [trendData]);

  const isLoading = loadingTrend || loadingPrevTrend;

  return {
    metrics,
    kpis,
    insights,
    chartData,
    trendData,
    isLoading,
    error: trendError,
    dateRange,
  };
}
