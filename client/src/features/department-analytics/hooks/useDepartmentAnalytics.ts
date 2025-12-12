/**
 * Department Analytics Data Hook
 * 
 * Custom hook for fetching and processing department analytics data
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { useMemo } from "react";
import { 
  calculateDepartmentMetrics, 
  generateInsights,
  type DepartmentMetrics,
  type MonthlyTrendData
} from "../utils/calculations";
import { 
  getDateRange,
  formatDateForAPI,
  type RangeKey
} from "@/lib/dateRanges";
import { format } from "date-fns";

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
 * Main hook for department analytics
 */
export function useDepartmentAnalytics(
  preset: FilterPreset = 'this-year',
  customRange?: DateRange
) {
  const dateRange = getDateRangeForPreset(preset, customRange);
  const prevDateRange = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);

  // Fetch departments list
  const { data: departments = [], isLoading: loadingDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/api/departments');
      return response.data as Array<{ id: string; name: string; code: string; isActive: boolean }>;
    },
  });

  // Fetch current period trend data
  const { 
    data: trendData = [], 
    isLoading: loadingTrend,
    error: trendError
  } = useQuery({
    queryKey: ['monthly-revenue', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(dateRange.startDate);
      const endStr = formatDateForAPI(dateRange.endDate);
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      // Transform API response to our format (same pattern as dashboard.tsx)
      const data = response.data as Array<{
        month: string;
        fullMonth: string;
        year: number;
        monthNum: number;
        revenue: number;
        departmentBreakdown?: Record<string, number>;
      }>;
      
      return data.map((item): MonthlyTrendData => ({
        month: item.month,
        fullMonth: item.fullMonth,
        year: item.year,
        monthNum: item.monthNum,
        revenue: item.revenue || 0,
        departmentBreakdown: item.departmentBreakdown || {},
      }));
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Fetch previous period data for comparison
  const { 
    data: prevTrendData = [], 
    isLoading: loadingPrevTrend 
  } = useQuery({
    queryKey: ['monthly-revenue-prev', prevDateRange.startDate, prevDateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(prevDateRange.startDate);
      const endStr = formatDateForAPI(prevDateRange.endDate);
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      const data = response.data as Array<{
        month: string;
        fullMonth: string;
        year: number;
        monthNum: number;
        revenue: number;
        departmentBreakdown?: Record<string, number>;
      }>;
      
      return data.map((item): MonthlyTrendData => ({
        month: item.month,
        fullMonth: item.fullMonth,
        year: item.year,
        monthNum: item.monthNum,
        revenue: item.revenue || 0,
        departmentBreakdown: item.departmentBreakdown || {},
      }));
    },
    enabled: !!prevDateRange.startDate && !!prevDateRange.endDate,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!departments.length || !trendData.length) {
      return [];
    }
    
    return calculateDepartmentMetrics(
      departments.filter(d => d.isActive),
      trendData,
      prevTrendData
    );
  }, [departments, trendData, prevTrendData]);

  // Generate insights
  const insights = useMemo(() => {
    return generateInsights(metrics);
  }, [metrics]);

  // Calculate totals for KPIs
  const totals = useMemo(() => {
    const currentTotal = metrics.reduce((sum, m) => sum + m.revenue, 0);
    const activeCount = metrics.filter(m => m.revenue > 0).length;
    
    // Calculate previous period total from prevTrendData
    const prevTotal = prevTrendData.reduce((sum, month) => {
      const monthTotal = Object.values(month.departmentBreakdown || {}).reduce(
        (s, amt) => s + (amt || 0), 
        0
      );
      return sum + monthTotal;
    }, 0);
    
    // Calculate growth percentage
    let periodGrowth = 0;
    if (prevTotal > 0 && currentTotal > 0) {
      periodGrowth = ((currentTotal - prevTotal) / prevTotal) * 100;
    } else if (prevTotal === 0 && currentTotal > 0) {
      // If there was no revenue before but there is now, that's 100% growth
      periodGrowth = 100;
    } else if (prevTotal > 0 && currentTotal === 0) {
      // If there was revenue before but none now, that's -100% (decline)
      periodGrowth = -100;
    }
    // else: both are 0, growth stays 0

    return {
      totalRevenue: currentTotal,
      activeDepartments: activeCount,
      growth: Math.round(periodGrowth * 10) / 10, // Round to 1 decimal
    };
  }, [metrics, prevTrendData]);

  const isLoading = loadingDepartments || loadingTrend || loadingPrevTrend;
  const error = trendError;

  return {
    metrics,
    insights,
    totals,
    trendData,
    departments,
    isLoading,
    error,
    dateRange,
  };
}
