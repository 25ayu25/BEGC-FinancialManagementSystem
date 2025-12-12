/**
 * Insurance Overview Data Hook
 * 
 * Custom hook for fetching and processing insurance provider analytics data
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { useMemo } from "react";
import { 
  calculateProviderMetrics, 
  generateInsights,
  type ProviderMetrics,
  type InsuranceProvider,
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
 * Main hook for insurance overview analytics
 */
export function useInsuranceOverview(
  preset: FilterPreset = 'this-year',
  customRange?: DateRange
) {
  const dateRange = getDateRangeForPreset(preset, customRange);
  const prevDateRange = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);

  // Fetch insurance providers list
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['insurance-providers'],
    queryFn: async () => {
      const response = await api.get('/api/insurance-providers');
      return response.data as InsuranceProvider[];
    },
  });

  // Fetch current period transactions with insurance
  const { 
    data: currentTransactions = [], 
    isLoading: loadingCurrent,
    error: currentError
  } = useQuery({
    queryKey: ['insurance-transactions', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(dateRange.startDate);
      const endStr = formatDateForAPI(dateRange.endDate);
      const response = await api.get(`/api/transactions?startDate=${startStr}&endDate=${endStr}&pageSize=10000`);
      
      return response.data.transactions || [];
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  });

  // Fetch previous period transactions for comparison
  const { 
    data: prevTransactions = [], 
    isLoading: loadingPrev 
  } = useQuery({
    queryKey: ['insurance-transactions-prev', prevDateRange.startDate, prevDateRange.endDate],
    queryFn: async () => {
      const startStr = formatDateForAPI(prevDateRange.startDate);
      const endStr = formatDateForAPI(prevDateRange.endDate);
      const response = await api.get(`/api/transactions?startDate=${startStr}&endDate=${endStr}&pageSize=10000`);
      
      return response.data.transactions || [];
    },
    enabled: !!prevDateRange.startDate && !!prevDateRange.endDate,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!providers.length || !currentTransactions.length) {
      return [];
    }
    
    return calculateProviderMetrics(
      providers.filter(p => p.isActive),
      currentTransactions,
      prevTransactions
    );
  }, [providers, currentTransactions, prevTransactions]);

  // Generate insights
  const insights = useMemo(() => {
    return generateInsights(metrics);
  }, [metrics]);

  // Calculate totals and KPIs
  const kpis = useMemo(() => {
    // Filter SSP insurance transactions
    const currentInsuranceTxs = currentTransactions.filter(
      (t: any) => t.insuranceProviderId && t.currency === 'SSP'
    );
    const prevInsuranceTxs = prevTransactions.filter(
      (t: any) => t.insuranceProviderId && t.currency === 'SSP'
    );

    const totalClaimsValue = currentInsuranceTxs.reduce(
      (sum: number, t: any) => sum + Number(t.amount || 0), 
      0
    );
    const prevTotalClaimsValue = prevInsuranceTxs.reduce(
      (sum: number, t: any) => sum + Number(t.amount || 0), 
      0
    );

    const activeProviders = metrics.filter(m => m.revenue > 0).length;
    const totalClaims = currentInsuranceTxs.length;
    const avgClaimValue = totalClaims > 0 ? totalClaimsValue / totalClaims : 0;
    
    const growth = prevTotalClaimsValue > 0 
      ? ((totalClaimsValue - prevTotalClaimsValue) / prevTotalClaimsValue) * 100 
      : 0;

    const topProvider = metrics[0];
    const topProviderRevenue = topProvider ? topProvider.revenue : 0;

    // Collection rate (simplified - assuming all claims are collected)
    const collectionRate = 87; // This should be calculated from actual data if available

    return {
      totalClaimsValue,
      activeProviders,
      collectionRate,
      avgClaimValue,
      topProviderRevenue,
      topProviderName: topProvider?.name || 'N/A',
      growth,
      totalClaims,
      prevTotalClaimsValue,
    };
  }, [metrics, currentTransactions, prevTransactions]);

  const isLoading = loadingProviders || loadingCurrent || loadingPrev;
  const error = currentError;

  return {
    metrics,
    insights,
    kpis,
    providers,
    isLoading,
    error,
    dateRange,
  };
}
