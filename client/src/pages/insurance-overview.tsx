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

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Filter, RefreshCw, AlertTriangle, FileX, Calendar as CalendarIcon, Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/queryClient";
import { getDateRange, type RangeKey } from "@/lib/dateRanges";
import { RevenueOverviewCard } from "@/features/insurance-overview/components/RevenueOverviewCard";
import { ShareByProviderChart } from "@/features/insurance-overview/components/ShareByProviderChart";
import { ProviderPerformanceCards } from "@/features/insurance-overview/components/ProviderPerformanceCards";
import { RevenueTrendChart } from "@/features/insurance-overview/components/RevenueTrendChart";
import { 
  RevenueOverviewSkeleton, 
  ChartSkeleton, 
  ProviderCardsSkeleton 
} from "@/features/insurance-overview/components/LoadingSkeleton";
import { transitions, fadeIn } from "@/features/insurance-overview/utils/animations";
import { useIsMobile } from "@/features/insurance-overview/hooks/useMediaQuery";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import { exportToCSV, exportToPDF } from "@/features/insurance-overview/utils/export";

interface AnalyticsData {
  overview: {
    totalRevenue: number;
    activeProviders: number;
    vsLastMonth: number;
    avgRevenuePerProvider?: number;
    projectedMonthlyTotal?: number | null;
    ytdRevenue?: number;
    bestMonth?: { month: Date | string; revenue: number } | null;
    trendData?: number[];
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
    color?: string;
  }>;
}

type FilterPreset = 'current-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'this-quarter' | 'last-quarter' | 'this-year' | 'ytd' | 'last-year' | 'custom';

const filterOptions: Array<{ value: FilterPreset; label: string }> = [
  { value: 'current-month', label: 'Current Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'this-year', label: 'This Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

export default function InsuranceOverview() {
  // Stable timestamp for consistent date calculations across the component lifecycle
  // Memoized with empty dependency array to ensure it's created once per component mount
  const now = useMemo(() => new Date(), []);
  
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>('this-year');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ 
    start: undefined, 
    end: undefined 
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendProviders, setTrendProviders] = useState<any[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [showProviderBreakdown, setShowProviderBreakdown] = useState(false);

  // Mock data for development/demo when API is unavailable
  const getMockData = (): AnalyticsData => ({
    overview: {
      totalRevenue: 125750.50,
      activeProviders: 8,
      vsLastMonth: 12.5,
      avgRevenuePerProvider: 15718.81,
      projectedMonthlyTotal: 135000,
      ytdRevenue: 1425000,
      bestMonth: {
        month: new Date(2024, 8, 1).toISOString(),
        revenue: 145000
      },
      trendData: [95000, 102000, 118000, 125000, 145000, 138000, 142000, 135000, 128000, 125000, 123000, 125750]
    },
    providerShares: [
      { name: "Blue Cross", value: 45000, color: "#3b82f6" },
      { name: "Aetna", value: 32000, color: "#10b981" },
      { name: "United Health", value: 28000, color: "#f59e0b" },
      { name: "Cigna", value: 12750.50, color: "#ef4444" },
      { name: "Humana", value: 8000, color: "#8b5cf6" },
    ],
    topProviders: [
      { rank: 1, name: "Blue Cross Blue Shield", revenue: 45000, share: 35.8, vsLastMonth: 15.2, color: "#3b82f6" },
      { rank: 2, name: "Aetna Insurance", revenue: 32000, share: 25.4, vsLastMonth: 8.7, color: "#10b981" },
      { rank: 3, name: "United Healthcare", revenue: 28000, share: 22.3, vsLastMonth: -3.2, color: "#f59e0b" },
      { rank: 4, name: "Cigna Health", revenue: 12750, share: 10.1, vsLastMonth: 22.1, color: "#ef4444" },
      { rank: 5, name: "Humana Inc", revenue: 8000, share: 6.4, vsLastMonth: -5.4, color: "#8b5cf6" },
    ],
  });

  // Helper function to calculate date ranges on frontend with stable timestamp
  // This prevents timezone-related off-by-one errors when the backend calculates ranges
  const calculateDateRange = (preset: FilterPreset, providedStartDate?: Date, providedEndDate?: Date): { startDate?: Date; endDate?: Date } => {
    // Use provided dates for custom ranges
    if (providedStartDate && providedEndDate) {
      return { startDate: providedStartDate, endDate: providedEndDate };
    }
    
    // For 'this-year' and 'ytd' presets: Both represent "year to date" functionality.
    // We map both to the 'this-year' RangeKey when calling getDateRange, which
    // calculates the range from January 1 of current year to last complete month
    if (preset === 'this-year' || preset === 'ytd') {
      const dateRange = getDateRange('this-year', now);
      return { startDate: dateRange.startDate, endDate: dateRange.endDate };
    }
    
    // For 'last-year', calculate the full previous calendar year
    if (preset === 'last-year') {
      const dateRange = getDateRange('last-year', now);
      return { startDate: dateRange.startDate, endDate: dateRange.endDate };
    }
    
    // For other presets, let the backend handle the calculation
    return {};
  };

  const fetchAnalytics = async (preset: FilterPreset, startDate?: Date, endDate?: Date) => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/insurance-overview/analytics?preset=${preset}`;
      
      // Calculate date range using helper function
      const { startDate: effectiveStartDate, endDate: effectiveEndDate } = calculateDateRange(preset, startDate, endDate);
      
      // Pass calculated dates to API if available (fixes timezone bug)
      // The API supports explicit dates for all presets, not just 'custom'
      if (effectiveStartDate && effectiveEndDate) {
        url += `&startDate=${effectiveStartDate.toISOString()}&endDate=${effectiveEndDate.toISOString()}`;
      }

      const response = await api.get(url);

      setData(response.data);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      
      // Use mock data if API is unavailable (for demo/development)
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error' || err.code === 'ECONNREFUSED') {
        console.info("Using mock data for demo");
        setData(getMockData());
        return;
      }
      
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

  const fetchTrendData = async (preset: FilterPreset, startDate?: Date, endDate?: Date) => {
    try {
      setLoadingTrend(true);
      
      // Use the selected preset directly - the API will return appropriate granularity
      let url = `/api/insurance-overview/trends?preset=${preset}`;
      
      // Calculate date range using helper function
      const { startDate: effectiveStartDate, endDate: effectiveEndDate } = calculateDateRange(preset, startDate, endDate);
      
      if (showProviderBreakdown) {
        url += '&byProvider=true';
      }
      
      // Pass calculated dates to API if available (fixes timezone bug)
      // The API supports explicit dates for all presets, not just 'custom'
      if (effectiveStartDate && effectiveEndDate) {
        url += `&startDate=${effectiveStartDate.toISOString()}&endDate=${effectiveEndDate.toISOString()}`;
      }

      const response = await api.get(url);
      setTrendData(response.data.trends || []);
      setTrendProviders(response.data.providers || []);
    } catch (err: any) {
      console.error("Error fetching trend data:", err);
      // Use mock trend data if API fails
      const mockTrends = [
        { month: new Date(2024, 5, 1).toISOString(), revenue: 95000 },
        { month: new Date(2024, 6, 1).toISOString(), revenue: 102000 },
        { month: new Date(2024, 7, 1).toISOString(), revenue: 118000 },
        { month: new Date(2024, 8, 1).toISOString(), revenue: 125000 },
        { month: new Date(2024, 9, 1).toISOString(), revenue: 145000 },
        { month: new Date(2024, 10, 1).toISOString(), revenue: 138000 },
      ];
      setTrendData(mockTrends);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => {
    if (selectedFilter === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        fetchAnalytics(selectedFilter, customDateRange.start, customDateRange.end);
        fetchTrendData(selectedFilter, customDateRange.start, customDateRange.end);
      }
    } else {
      fetchAnalytics(selectedFilter);
      fetchTrendData(selectedFilter);
    }
  }, [selectedFilter, customDateRange, showProviderBreakdown]);

  // Memoized handlers to prevent re-renders
  const handleFilterChange = useCallback((preset: FilterPreset) => {
    if (preset === 'custom') {
      setShowCustomDatePicker(true);
      setShowFilterDropdown(false);
    } else {
      setSelectedFilter(preset);
      setShowFilterDropdown(false);
    }
  }, []);

  const handleCustomDateApply = useCallback(() => {
    if (customDateRange.start && customDateRange.end) {
      setSelectedFilter('custom');
      setShowCustomDatePicker(false);
    }
  }, [customDateRange.start, customDateRange.end]);

  const handleRefresh = useCallback(() => {
    if (selectedFilter === 'custom' && customDateRange.start && customDateRange.end) {
      fetchAnalytics(selectedFilter, customDateRange.start, customDateRange.end);
      fetchTrendData(selectedFilter, customDateRange.start, customDateRange.end);
    } else {
      fetchAnalytics(selectedFilter);
      fetchTrendData(selectedFilter);
    }
  }, [selectedFilter, customDateRange.start, customDateRange.end]);

  // Calculate filter label before conditional returns so it's available in all states
  const currentFilterLabel = selectedFilter === 'custom' && customDateRange.start && customDateRange.end
    ? `${format(customDateRange.start, 'MMM d')} - ${format(customDateRange.end, 'MMM d, yyyy')}`
    : filterOptions.find(opt => opt.value === selectedFilter)?.label || 'Current Month';

  // Export handlers
  const handleExportCSV = useCallback(() => {
    if (!data) return;
    exportToCSV(data, trendData, currentFilterLabel);
  }, [data, trendData, currentFilterLabel]);

  const handleExportPDF = useCallback(() => {
    if (!data) return;
    exportToPDF(data, trendData, currentFilterLabel);
  }, [data, trendData, currentFilterLabel]);

  // Toggle dropdown without causing re-renders
  const toggleDropdown = useCallback(() => {
    setShowFilterDropdown(prev => !prev);
  }, []);

  const closeDropdown = useCallback(() => {
    setShowFilterDropdown(false);
  }, []);

  const isMobile = useIsMobile();

  // Reusable Page Header Component with Filter
  const renderPageHeader = () => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 bg-gradient-to-r from-blue-50/30 via-transparent to-transparent -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 rounded-lg">
      <div className="w-full sm:w-auto">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
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
            onClick={toggleDropdown}
            className={`
              flex items-center justify-between gap-2 
              w-full sm:w-auto
              px-3 sm:px-4 py-2.5 sm:py-2 
              bg-white/90 backdrop-blur-sm border border-gray-200/80 text-gray-700 
              rounded-xl hover:bg-white hover:border-blue-200
              transition-all duration-200 ease-out
              shadow-sm hover:shadow-md hover:shadow-blue-100/50
              min-h-[44px]
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300
            `}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm sm:text-base font-medium truncate">
                {isMobile ? currentFilterLabel.split(' ')[0] : currentFilterLabel}
              </span>
            </div>
            <svg
              className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ease-out ${showFilterDropdown ? 'rotate-180' : 'rotate-0'}`}
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
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200"
                  onClick={closeDropdown}
                />
              )}
              
              {/* Dropdown menu with smooth CSS transitions */}
              <div 
                className={`
                  ${isMobile 
                    ? 'fixed bottom-0 left-0 right-0 rounded-t-2xl z-50' 
                    : 'absolute right-0 mt-2 w-56 rounded-xl z-[70]'
                  }
                  bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/60
                  transition-all duration-200 ease-out
                  ${isMobile ? 'animate-in slide-in-from-bottom duration-300' : 'animate-in fade-in-0 zoom-in-95 duration-150'}
                `}
                style={{ willChange: 'transform, opacity' }}
              >
                {isMobile && (
                  <div className="flex justify-center py-3">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                  </div>
                )}
                
                <div className={isMobile ? 'py-2 pb-8' : 'py-2'}>
                  {filterOptions.map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange(option.value)}
                      className={`
                        w-full text-left px-4 py-3 sm:py-2.5 text-sm sm:text-base
                        transition-colors duration-150 ease-out
                        ${selectedFilter === option.value 
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-semibold border-l-2 border-blue-500' 
                          : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                        }
                        min-h-[44px] sm:min-h-0
                        focus:outline-none focus:bg-gray-50
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {selectedFilter === option.value && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {option.label}
                      </span>
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
  );

  // Custom Date Range Picker Modal Component
  const renderCustomDatePicker = () => showCustomDatePicker && (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setShowCustomDatePicker(false)}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Custom Date Range</h3>
          
          <div className="space-y-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full justify-start text-left font-normal px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50",
                      !customDateRange.start && "text-gray-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 inline" />
                    {customDateRange.start ? format(customDateRange.start, "PPP") : "Pick a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.start}
                    onSelect={(date) => setCustomDateRange(prev => ({ ...prev, start: date }))}
                    disabled={(date) => date > now}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full justify-start text-left font-normal px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50",
                      !customDateRange.end && "text-gray-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 inline" />
                    {customDateRange.end ? format(customDateRange.end, "PPP") : "Pick a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDateRange.end}
                    onSelect={(date) => setCustomDateRange(prev => ({ ...prev, end: date }))}
                    initialFocus
                    disabled={(date) => {
                      if (date > now) return true;
                      if (customDateRange.start && date < customDateRange.start) return true;
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowCustomDatePicker(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomDateApply}
              disabled={!customDateRange.start || !customDateRange.end}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );

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

  // No data state with enhanced design - NOW includes header with filter
  if (!data || (data.topProviders.length === 0 && data.overview.totalRevenue === 0)) {
    return (
      <div className={`max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ${fadeIn}`}>
        {/* Page Header with Filter - Always visible so users can change time period */}
        {renderPageHeader()}
        
        {/* Custom Date Range Picker Modal */}
        {renderCustomDatePicker()}
        
        {/* Empty State Content */}
        <div className="flex flex-col items-center justify-center py-12">
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
              Try selecting a different time period using the filter above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine whether to show projection based on the selected filter
  // Hide projection for:
  // - current-month: visually confusing and speculative with sparse data (per requirements)
  // - last-month, last-year, last-quarter: completed historical periods
  // - last-3-months, last-6-months: completed historical periods
  const showProjection = !['current-month', 'last-month', 'last-year', 'last-quarter', 'last-3-months', 'last-6-months'].includes(selectedFilter);

  return (
    <div className={fadeIn}>
      {/* Page Header with Filter - Mobile Responsive */}
      <PageHeader
        variant="insuranceOverview"
        title="Insurance Overview"
        subtitle="Revenue analytics from insurance transactions (USD only)"
      >
        <div className="flex gap-2 flex-wrap">
          {/* Export Buttons - Show only on desktop or when data is available */}
          {!isMobile && data && (
            <>
              <button
                onClick={handleExportCSV}
                className={`
                  flex items-center gap-2 px-3 py-2
                  bg-white border border-white/80 text-gray-700
                  rounded-xl hover:bg-gray-50 hover:shadow-lg
                  transition-all duration-200
                  shadow-md
                  min-h-[44px]
                `}
                title="Export to CSV"
              >
                <Download className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium">CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className={`
                  flex items-center gap-2 px-3 py-2
                  bg-white border border-white/80 text-gray-700
                  rounded-xl hover:bg-gray-50 hover:shadow-lg
                  transition-all duration-200
                  shadow-md
                  min-h-[44px]
                `}
                title="Export to PDF"
              >
                <FileText className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium">PDF</span>
              </button>
            </>
          )}
          
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className={`
                flex items-center justify-between gap-2 
                px-3 sm:px-4 py-2.5 sm:py-2 
                bg-white border border-white/80 text-gray-700
                rounded-xl hover:bg-gray-50 hover:border-white hover:shadow-lg
                transition-all duration-200 ease-out
                shadow-md hover:shadow-teal-200/30
                min-h-[44px]
                focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white
              `}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-teal-600" />
                <span className="text-sm sm:text-base font-medium truncate">
                  {isMobile ? currentFilterLabel.split(' ')[0] : currentFilterLabel}
                </span>
              </div>
              <svg
                className={`w-4 h-4 flex-shrink-0 text-gray-500 transition-transform duration-200 ease-out ${showFilterDropdown ? 'rotate-180' : 'rotate-0'}`}
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
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200"
                    onClick={closeDropdown}
                  />
                )}
                
                {/* Dropdown menu with smooth CSS transitions */}
                <div 
                  className={`
                    ${isMobile 
                      ? 'fixed bottom-0 left-0 right-0 rounded-t-2xl z-50' 
                      : 'absolute right-0 mt-2 w-56 rounded-xl z-[70]'
                    }
                    bg-white/95 backdrop-blur-md shadow-xl border border-gray-200/60
                    transition-all duration-200 ease-out
                    ${isMobile ? 'animate-in slide-in-from-bottom duration-300' : 'animate-in fade-in-0 zoom-in-95 duration-150'}
                  `}
                  style={{ willChange: 'transform, opacity' }}
                >
                  {isMobile && (
                    <div className="flex justify-center py-3">
                      <div className="w-10 h-1 bg-gray-300 rounded-full" />
                    </div>
                  )}
                  
                  <div className={isMobile ? 'py-2 pb-8' : 'py-2'}>
                    {filterOptions.map((option, index) => (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.value)}
                        className={`
                          w-full text-left px-4 py-3 sm:py-2.5 text-sm sm:text-base
                          transition-colors duration-150 ease-out
                          ${selectedFilter === option.value 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-semibold border-l-2 border-blue-500' 
                            : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
                          }
                          min-h-[44px] sm:min-h-0
                          focus:outline-none focus:bg-gray-50
                        `}
                      >
                        <span className="flex items-center gap-2">
                          {selectedFilter === option.value && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`
              flex items-center justify-center gap-2 
              px-3 sm:px-4 py-2.5 sm:py-2
              bg-white border border-white/80 text-gray-700
              rounded-xl hover:bg-gray-50 hover:border-white hover:shadow-lg
              active:scale-95
              shadow-md hover:shadow-teal-200/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${transitions.base}
              min-h-[44px] min-w-[44px]
            `}
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline font-medium">Refresh</span>
          </button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Custom Date Range Picker Modal */}
        {renderCustomDatePicker()}

        {/* Content with staggered animation */}
        <div className="space-y-4 sm:space-y-6">
          {/* Revenue Overview Card */}
          <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '0ms' }}>
            <RevenueOverviewCard
              totalRevenue={data.overview.totalRevenue}
              activeProviders={data.overview.activeProviders}
              vsLastMonth={data.overview.vsLastMonth}
              avgRevenuePerProvider={data.overview.avgRevenuePerProvider}
              projectedMonthlyTotal={data.overview.projectedMonthlyTotal}
              ytdRevenue={data.overview.ytdRevenue}
              bestMonth={data.overview.bestMonth}
              trendData={data.overview.trendData}
              showProjection={showProjection}
            />
          </div>

          {/* Revenue Trend Chart */}
          {trendData.length > 0 && (
            <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '50ms' }}>
              <RevenueTrendChart
                data={trendData}
                providers={trendProviders}
                title="Revenue Trend Over Time"
                showProviderBreakdown={showProviderBreakdown}
                defaultChartType="area"
                currentPreset={selectedFilter}
              />
            </div>
          )}

          {/* Share by Provider Chart */}
          {data.providerShares.length > 0 && (
            <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '150ms' }}>
              <ShareByProviderChart data={data.providerShares} />
            </div>
          )}

          {/* Provider Performance Cards */}
          {data.topProviders.length > 0 && (
            <div className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '250ms' }}>
              <ProviderPerformanceCards providers={data.topProviders} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
