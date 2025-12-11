import React, { useState, useCallback } from "react";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { useIsMobile, useIsTablet } from "../hooks/useMediaQuery";
import { formatCurrency } from "@/lib/currency";

interface ProviderPerformance {
  rank: number;
  name: string;
  revenue: number;
  share: number; // percentage of total revenue
  vsLastMonth: number; // percentage change
  color?: string; // color from donut chart for consistency
}

interface ProviderPerformanceCardsProps {
  providers: ProviderPerformance[];
}

export function ProviderPerformanceCards({ providers }: ProviderPerformanceCardsProps) {
  const isMobile = useIsMobile();

  return (
    <div className={`
      bg-gradient-to-br from-white to-green-50/20
      rounded-xl 
      ${shadows.md} 
      border border-gray-200/60 
      p-4 sm:p-6 
      ${transitions.base}
      ${hover.lift}
      relative overflow-hidden
    `}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Providers Performance</h2>
        
        <div className="space-y-2">
          {providers.map((provider) => {
            const isPositive = provider.vsLastMonth >= 0;
            const TrendIcon = isPositive ? TrendingUp : TrendingDown;

            return (
              <div
                key={provider.rank}
                className={`
                  flex items-center gap-3 sm:gap-4
                  p-3 sm:p-4 rounded-lg
                  bg-white/80 hover:bg-white
                  border border-gray-200/60
                  ${transitions.base}
                  hover:shadow-md
                  cursor-pointer
                  group
                `}
              >
                {/* Rank Chip */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  text-xs font-bold
                  ${provider.rank === 1 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30' 
                    : provider.rank === 2
                    ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/30'
                    : provider.rank === 3
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-gray-100 text-gray-700'
                  }
                `}>
                  {provider.rank}
                </div>

                {/* Provider Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    {provider.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {provider.share.toFixed(1)}% of total revenue
                  </p>
                </div>

                {/* Revenue */}
                <div className="text-right">
                  <p className="text-sm sm:text-base font-bold text-gray-900">
                    {formatCurrency(provider.revenue || 0)}
                  </p>
                </div>

                {/* MoM Change Chip */}
                <div className={`
                  flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold
                  ${isPositive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200/60'}
                  flex-shrink-0
                `}>
                  <TrendIcon className="w-3 h-3" />
                  <span className="whitespace-nowrap">
                    {isPositive ? '+' : ''}{provider.vsLastMonth.toFixed(1)}%
                  </span>
                </div>

                {/* Chevron for future drill-down */}
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
