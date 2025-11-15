/**
 * LoadingSkeleton Component
 * 
 * Beautiful skeleton screens with shimmer animation effect
 * that match the actual content layout for better UX.
 */

import React from 'react';

export function RevenueOverviewSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-6 w-40 bg-gray-200 rounded mb-6"></div>
      
      <div className="space-y-6">
        {/* Total Revenue */}
        <div>
          <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 w-48 bg-gray-200 rounded"></div>
        </div>

        {/* Active Providers */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200"></div>
          <div className="flex-1">
            <div className="h-3 w-28 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* vs Last Month */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-200 rounded"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-6 w-40 bg-gray-200 rounded mb-6"></div>
      
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Chart Circle */}
        <div className="w-full lg:w-1/2 flex items-center justify-center h-64">
          <div className="w-48 h-48 rounded-full bg-gray-200"></div>
        </div>

        {/* Legend */}
        <div className="w-full lg:w-1/2 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
              <div className="text-right space-y-1">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProviderCardsSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-6 w-52 bg-gray-200 rounded mb-6"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                <div className="h-4 w-28 bg-gray-200 rounded"></div>
              </div>
            </div>

            {/* Revenue */}
            <div className="h-8 w-32 bg-gray-200 rounded mb-3"></div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2"></div>
            </div>

            {/* Trend */}
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Shimmer overlay for enhanced effect
export function ShimmerOverlay() {
  return (
    <div className="absolute inset-0 -translate-x-full">
      <div 
        className="h-full w-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"
        style={{
          animation: 'shimmer 2s infinite',
          backgroundSize: '200% 100%'
        }}
      />
    </div>
  );
}
