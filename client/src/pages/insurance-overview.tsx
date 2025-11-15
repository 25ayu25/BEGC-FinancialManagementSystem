/**
 * Insurance Overview Page - World-Class Design
 * 
 * Read-only analytics dashboard showing insurance revenue insights.
 * Fetches data from transactions table where type='income' and currency='USD'.
 * 
 * Features:
 * - Revenue Overview Card (Total Revenue, Active Providers, vs Last Month, Sparkline)
 * - Share by Provider Chart (Interactive donut chart + clickable legend)
 * - Provider Performance Cards (Top providers with rank, revenue, share, comparison)
 * - Independent filter dropdown (Current Month, Last Month, Last 3 Months, YTD, etc.)
 * - Mobile-first responsive design
 * - Smooth animations and micro-interactions
 * - Loading skeleton states
 * - Enhanced error and empty states
 * 
 * @module InsuranceOverview
 */

import React, { useState, useEffect } from "react";
import { Filter, RefreshCw, AlertTriangle, FileX } from "lucide-react";
import { api } from "@/lib/queryClient";
import { RevenueOverviewCard } from "@/features/insurance-overview/components/RevenueOverviewCard";
import { ShareByProviderChart } from "@/features/insurance-overview/components/ShareByProviderChart";
import { ProviderPerformanceCards } from "@/features/insurance-overview/components/ProviderPerformanceCards";
import { 
  RevenueOverviewSkeleton, 
  ChartSkeleton, 
  ProviderCardsSkeleton 
} from "@/features/insurance-overview/components/LoadingSkeleton";
import { transitions, fadeIn } from "@/features/insurance-overview/utils/animations";
import { useIsMobile } from "@/features/insurance-overview/hooks/useMediaQuery";

interface AnalyticsData {
  overview: {
    totalRevenue: number;
    activeProviders: number;
    vsLastMonth: number;
  };
  providerShares: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  topProviders: Array<{
    rank: number;
    name: string;
    revenue: number;
    share: number;
    vsLastMonth: number;
  }>;
}

type FilterPreset = 'current-month' | 'last-month' | 'last-3-months' | 'ytd' | 'last-year';

const filterOptions: Array<{ value: FilterPreset; label: string }> = [
  { value: 'current-month', label: 'Current Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
];

export default function InsuranceOverview() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>('current-month');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const fetchAnalytics = async (preset: FilterPreset) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(
        `/api/insurance-overview/analytics?preset=${preset}`
      );

      setData(response.data);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      const status = err?.response?.status;
      if (status === 401) {
        setError("Authentication required. Please log in.");
      } else {
        setError(err?.response?.data?.error || err.message || "Failed to fetch analytics data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(selectedFilter);
  }, [selectedFilter]);

  const handleFilterChange = (preset: FilterPreset) => {
    setSelectedFilter(preset);
    setShowFilterDropdown(false);
  };

  const handleRefresh = () => {
    fetchAnalytics(selectedFilter);
  };

  const isMobile = useIsMobile();

  // Error state with enhanced design
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className={`flex flex-col items-center justify-center py-12 ${fadeIn}`}>
          <div className="text-center max-w-md mx-auto">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Unable to Load Data
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className={`
                px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 
                text-white rounded-lg font-medium
                hover:from-blue-700 hover:to-blue-800
                active:scale-95
                shadow-lg shadow-blue-500/30
                ${transitions.base}
                min-h-[44px]
              `}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state with skeleton screens
  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="h-10 flex-1 sm:flex-none sm:w-40 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        <RevenueOverviewSkeleton />
        <ChartSkeleton />
        <ProviderCardsSkeleton />
      </div>
    );
  }

  // No data state with enhanced design
  if (!data || (data.topProviders.length === 0 && data.overview.totalRevenue === 0)) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className={`flex flex-col items-center justify-center py-12 ${fadeIn}`}>
          <div className="text-center max-w-md mx-auto">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FileX className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              No Insurance Data Available
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              There are no insurance transactions for the selected period.
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              Try selecting a different time period from the filter above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentFilterLabel = filterOptions.find(opt => opt.value === selectedFilter)?.label || 'Current Month';

  return (
    <div className={`max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ${fadeIn}`}>
      {/* Page Header with Filter - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Insurance Overview
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Revenue analytics from insurance transactions (USD only)
          </p>
        </div>
        
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Filter Dropdown - Full width on mobile */}
          <div className="relative flex-1 sm:flex-none">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`
                flex items-center justify-between gap-2 
                w-full sm:w-auto
                px-3 sm:px-4 py-2.5 sm:py-2 
                bg-white border border-gray-300 text-gray-700 
                rounded-lg hover:bg-gray-50 
                ${transitions.base}
                shadow-sm hover:shadow-md
                min-h-[44px]
              `}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span className="text-sm sm:text-base font-medium truncate">
                  {isMobile ? currentFilterLabel.split(' ')[0] : currentFilterLabel}
                </span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showFilterDropdown && (
              <>
                {/* Backdrop for mobile */}
                {isMobile && (
                  <div 
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={() => setShowFilterDropdown(false)}
                  />
                )}
                
                {/* Dropdown menu */}
                <div className={`
                  ${isMobile 
                    ? 'fixed bottom-0 left-0 right-0 rounded-t-2xl z-50' 
                    : 'absolute right-0 mt-2 w-56 rounded-lg z-10'
                  }
                  bg-white shadow-xl border border-gray-200
                  ${transitions.base}
                  ${isMobile ? 'animate-in slide-in-from-bottom' : 'animate-in fade-in zoom-in-95'}
                `}>
                  {isMobile && (
                    <div className="flex justify-center py-2">
                      <div className="w-12 h-1 bg-gray-300 rounded-full" />
                    </div>
                  )}
                  
                  <div className={isMobile ? 'py-2 pb-6' : 'py-1'}>
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.value)}
                        className={`
                          w-full text-left px-4 py-3 sm:py-2 text-sm sm:text-base
                          hover:bg-gray-100 active:bg-gray-200
                          ${transitions.fast}
                          ${selectedFilter === option.value 
                            ? 'bg-blue-50 text-blue-700 font-semibold' 
                            : 'text-gray-700'
                          }
                          min-h-[44px] sm:min-h-0
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh Button - Icon only on mobile */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`
              flex items-center justify-center gap-2 
              px-3 sm:px-4 py-2.5 sm:py-2
              bg-gradient-to-r from-blue-600 to-blue-700 
              text-white rounded-lg font-medium
              hover:from-blue-700 hover:to-blue-800
              active:scale-95
              shadow-lg shadow-blue-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${transitions.base}
              min-h-[44px] min-w-[44px]
            `}
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content with staggered animation */}
      <div className="space-y-4 sm:space-y-6">
        {/* Revenue Overview Card */}
        <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '0ms' }}>
          <RevenueOverviewCard
            totalRevenue={data.overview.totalRevenue}
            activeProviders={data.overview.activeProviders}
            vsLastMonth={data.overview.vsLastMonth}
          />
        </div>

        {/* Share by Provider Chart */}
        {data.providerShares.length > 0 && (
          <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            <ShareByProviderChart data={data.providerShares} />
          </div>
        )}

        {/* Provider Performance Cards */}
        {data.topProviders.length > 0 && (
          <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
            <ProviderPerformanceCards providers={data.topProviders} />
          </div>
        )}
      </div>
    </div>
  );
}
