/**
 * Insurance Overview Page - World-Class Clean Replica
 * 
 * Read-only analytics dashboard showing insurance revenue insights.
 * Fetches data from transactions table where type='income' and currency='USD'.
 * 
 * Features:
 * - Revenue Overview Card (Total Revenue, Active Providers, vs Last Month)
 * - Share by Provider Chart (Donut chart + legend)
 * - Provider Performance Cards (Top providers with rank, revenue, share, comparison)
 * - Independent filter dropdown (Current Month, Last Month, Last 3 Months, YTD, etc.)
 * 
 * @module InsuranceOverview
 */

import React, { useState, useEffect } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { RevenueOverviewCard } from "@/features/insurance-overview/components/RevenueOverviewCard";
import { ShareByProviderChart } from "@/features/insurance-overview/components/ShareByProviderChart";
import { ProviderPerformanceCards } from "@/features/insurance-overview/components/ProviderPerformanceCards";

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

      const response = await fetch(
        `/api/insurance-overview/analytics?preset=${preset}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required. Please log in.");
        }
        throw new Error("Failed to fetch analytics data");
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
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

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">
              Unable to Load Data
            </h3>
            <p className="mt-2 text-gray-600">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || (data.topProviders.length === 0 && data.overview.totalRevenue === 0)) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">
              No Insurance Data Available
            </h3>
            <p className="mt-2 text-gray-600">
              There are no insurance transactions for the selected period.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentFilterLabel = filterOptions.find(opt => opt.value === selectedFilter)?.label || 'Current Month';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Page Header with Filter */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insurance Overview</h1>
          <p className="text-gray-600 mt-1">
            Revenue analytics from insurance transactions (USD only)
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>{currentFilterLabel}</span>
              <svg
                className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange(option.value)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                        selectedFilter === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Revenue Overview Card */}
      <RevenueOverviewCard
        totalRevenue={data.overview.totalRevenue}
        activeProviders={data.overview.activeProviders}
        vsLastMonth={data.overview.vsLastMonth}
      />

      {/* Share by Provider Chart */}
      {data.providerShares.length > 0 && (
        <ShareByProviderChart data={data.providerShares} />
      )}

      {/* Provider Performance Cards */}
      {data.topProviders.length > 0 && (
        <ProviderPerformanceCards providers={data.topProviders} />
      )}
    </div>
  );
}
