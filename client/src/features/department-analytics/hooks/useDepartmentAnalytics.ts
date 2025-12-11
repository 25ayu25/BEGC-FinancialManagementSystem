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
  startOfYear, 
  endOfYear, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  subYears,
  startOfQuarter,
  endOfQuarter,
  format
} from "date-fns";

export type FilterPreset = 
  | 'this-year' 
  | 'last-year' 
  | 'last-6-months' 
  | 'last-3-months' 
  | 'this-quarter' 
  | 'custom';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Get date range based on filter preset
 */
function getDateRangeForPreset(preset: FilterPreset, customRange?: DateRange): DateRange {
  const now = new Date();
  
  switch (preset) {
    case 'this-year':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
    case 'last-year':
      return {
        startDate: startOfYear(subYears(now, 1)),
        endDate: endOfYear(subYears(now, 1)),
      };
    case 'last-6-months':
      return {
        startDate: startOfMonth(subMonths(now, 5)),
        endDate: endOfMonth(now),
      };
    case 'last-3-months':
      return {
        startDate: startOfMonth(subMonths(now, 2)),
        endDate: endOfMonth(now),
      };
    case 'this-quarter':
      return {
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
      };
    case 'custom':
      return customRange || { startDate: startOfYear(now), endDate: endOfYear(now) };
    default:
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
  }
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
      const startStr = format(dateRange.startDate, 'yyyy-MM-dd');
      const endStr = format(dateRange.endDate, 'yyyy-MM-dd');
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      // Transform API response to our format
      const data = response.data as Array<{
        month: string;
        revenue: number;
        departmentBreakdown?: Record<string, number>;
      }>;
      
      return data.map(item => ({
        month: item.month,
        date: new Date(item.month),
        revenue: item.revenue,
        departmentBreakdown: item.departmentBreakdown || {},
      })) as MonthlyTrendData[];
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
      const startStr = format(prevDateRange.startDate, 'yyyy-MM-dd');
      const endStr = format(prevDateRange.endDate, 'yyyy-MM-dd');
      const response = await api.get(`/api/trends/monthly-revenue?startDate=${startStr}&endDate=${endStr}`);
      
      const data = response.data as Array<{
        month: string;
        revenue: number;
        departmentBreakdown?: Record<string, number>;
      }>;
      
      return data.map(item => ({
        month: item.month,
        date: new Date(item.month),
        revenue: item.revenue,
        departmentBreakdown: item.departmentBreakdown || {},
      })) as MonthlyTrendData[];
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

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);
    const totalPrevRevenue = prevTrendData.reduce((sum, monthData) => {
      const monthTotal = Object.values(monthData.departmentBreakdown || {})
        .reduce((s, v) => s + v, 0);
      return sum + monthTotal;
    }, 0);
    
    const growth = totalPrevRevenue > 0 
      ? ((totalRevenue - totalPrevRevenue) / totalPrevRevenue) * 100 
      : 0;

    return {
      totalRevenue,
      activeDepartments: metrics.length,
      growth,
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
