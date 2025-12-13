/**
 * Expense Analytics Data Hook
 * 
 * Custom hook for fetching and processing expense analytics data
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { useMemo, useEffect } from "react";
import { 
  calculateCategoryMetrics, 
  calculateKPIs,
  generateInsights,
  normalizeBreakdown,
  type MonthlyExpenseData,
  type CategoryMetrics,
} from "../utils/calculations";
import { 
  getDateRange,
  formatDateForAPI,
  type RangeKey
} from "@/lib/dateRanges";

export type FilterPreset = RangeKey | 'custom';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Get date range based on filter preset
 */
function getDateRangeForPreset(preset: FilterPreset, customRange?: DateRange): DateRange {
  const now = new Date();
  
  // For custom range, return it directly
  if (preset === 'custom') {
    return customRange || { startDate: new Date(now.getFullYear(), 0, 1), endDate: now };
  }
  
  // Use the centralized date range helper for standard presets
  const range = getDateRange(preset as RangeKey, now);
  return {
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

/**
 * Get previous period date range for comparison
 */
function getPreviousPeriodRange(startDate: Date, endDate: Date): DateRange {
  const diffMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - diffMs);
  
  return {
    startDate: prevStartDate,
    endDate: prevEndDate,
  };
}

/**
 * Main hook for expense analytics
 */
export function useExpenseAnalytics(
  preset: FilterPreset = 'this-year',
  customRange?: DateRange
) {
  const dateRange = getDateRangeForPreset(preset, customRange);
  const prevDateRange = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);

  // Fetch current period trend data
  const { 
    data: trendData = [], 
    isLoading: loadingTrend,
    error: trendError
  } = useQuery({
    queryKey: ['expense-analytics-trend', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(dateRange.startDate);
      const endStr = formatDateForAPI(dateRange.endDate);
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      return response.data as MonthlyExpenseData[];
    },
  });

  // Fetch previous period trend data for comparison
  const { 
    data: prevTrendData = [], 
    isLoading: loadingPrevTrend 
  } = useQuery({
    queryKey: ['expense-analytics-trend-prev', prevDateRange.startDate, prevDateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(prevDateRange.startDate);
      const endStr = formatDateForAPI(prevDateRange.endDate);
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      return response.data as MonthlyExpenseData[];
    },
  });

  // Process data into metrics
  const metrics = useMemo(() => {
    return calculateCategoryMetrics(trendData, prevTrendData);
  }, [trendData, prevTrendData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    return calculateKPIs(trendData, prevTrendData, metrics);
  }, [trendData, prevTrendData, metrics]);

  // Generate insights
  const insights = useMemo(() => {
    return generateInsights(metrics, kpis, trendData, prevTrendData);
  }, [metrics, kpis, trendData, prevTrendData]);

  // Prepare chart data - simple passthrough with minimal transformation
  const chartData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    
    return trendData
      .filter(month => month && month.month) // Filter out any null/undefined entries
      .map(month => {
        const breakdown = normalizeBreakdown(month.expenseBreakdown);
        
        return {
          month: month.month || month.fullMonth || '', // Use month as-is from API
          fullMonth: month.fullMonth || month.month || '',
          total: month.totalExpenses || 0,
          ...breakdown,
        };
      });
  }, [trendData]);

  const isLoading = loadingTrend || loadingPrevTrend;
  const error = trendError;

  return {
    metrics,
    kpis,
    insights,
    chartData,
    trendData,
    isLoading,
    error,
    dateRange,
  };
}
