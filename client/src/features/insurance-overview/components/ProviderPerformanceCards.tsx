import React, { useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { useIsMobile, useIsTablet } from "../hooks/useMediaQuery";
import { formatCurrency } from "@/lib/format";

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

// Medal styling for top 3 providers - accepts provider color
const getMedalStyle = (rank: number, providerColor?: string) => {
  switch(rank) {
    case 1:
      return {
        badge: "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-amber-900 shadow-lg shadow-yellow-400/40",
        card: "ring-2 ring-yellow-300/50 bg-gradient-to-br from-yellow-50/50 via-white to-amber-50/30",
        accent: "from-yellow-400 to-amber-500",
        glow: "shadow-yellow-200/50",
        progressColor: providerColor || "#f59e0b"
      };
    case 2:
      return {
        badge: "bg-gradient-to-br from-gray-200 via-gray-300 to-slate-400 text-slate-800 shadow-lg shadow-gray-300/40",
        card: "ring-2 ring-gray-200/50 bg-gradient-to-br from-gray-50/50 via-white to-slate-50/30",
        accent: "from-gray-300 to-slate-400",
        glow: "shadow-gray-200/50",
        progressColor: providerColor || "#6b7280"
      };
    case 3:
      return {
        badge: "bg-gradient-to-br from-orange-300 via-orange-400 to-amber-600 text-orange-900 shadow-lg shadow-orange-300/40",
        card: "ring-2 ring-orange-200/50 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30",
        accent: "from-orange-400 to-amber-600",
        glow: "shadow-orange-200/50",
        progressColor: providerColor || "#f97316"
      };
    default:
      return {
        badge: "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800 shadow-md shadow-blue-200/30",
        card: "ring-1 ring-blue-100/60 bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/20",
        accent: "from-blue-500 to-blue-600",
        glow: "shadow-blue-100/30",
        progressColor: providerColor || "#3b82f6"
      };
  }
};

export function ProviderPerformanceCards({ providers }: ProviderPerformanceCardsProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [mobileIndex, setMobileIndex] = useState(0);

  // Determine how many cards to show at once on mobile
  const visibleProviders = isMobile 
    ? [providers[mobileIndex]] 
    : providers;

  const handlePrevious = useCallback(() => {
    setMobileIndex((prev) => (prev > 0 ? prev - 1 : providers.length - 1));
  }, [providers.length]);

  const handleNext = useCallback(() => {
    setMobileIndex((prev) => (prev < providers.length - 1 ? prev + 1 : 0));
  }, [providers.length]);

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
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Providers Performance</h2>
          
          {/* Mobile navigation controls */}
          {isMobile && providers.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                className={`
                  p-2 rounded-lg bg-white border border-gray-200
                  hover:bg-gray-50 active:scale-95
                  ${transitions.base}
                `}
                aria-label="Previous provider"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                {mobileIndex + 1}/{providers.length}
              </span>
              <button
                onClick={handleNext}
                className={`
                  p-2 rounded-lg bg-white border border-gray-200
                  hover:bg-gray-50 active:scale-95
                  ${transitions.base}
                `}
                aria-label="Next provider"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
        
        <div className={`
          grid 
          ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} 
          gap-3 sm:gap-4
        `}>
          {visibleProviders.map((provider) => {
            const isPositive = provider.vsLastMonth >= 0;
            const TrendIcon = isPositive ? TrendingUp : TrendingDown;
            const medalStyle = getMedalStyle(provider.rank, provider.color);

            return (
              <div
                key={provider.rank}
                className={`
                  rounded-xl p-4 sm:p-5
                  ${medalStyle.card}
                  ${transitions.base}
                  ${hover.scale}
                  shadow-md ${medalStyle.glow}
                  group
                  min-h-[200px]
                  touch-manipulation
                  backdrop-blur-sm
                `}
              >
                {/* Header with Rank and Name */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {provider.rank <= 3 ? (
                      <div className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full 
                        ${medalStyle.badge}
                        flex items-center justify-center
                        ${transitions.base}
                        group-hover:scale-110 group-hover:rotate-12
                      `}>
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    ) : (
                      <div className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full
                        ${medalStyle.badge}
                        flex items-center justify-center
                        ${transitions.base}
                        group-hover:scale-110
                      `}>
                        <span className="text-xs sm:text-sm font-bold">
                          #{provider.rank}
                        </span>
                      </div>
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                      {provider.name}
                    </h3>
                  </div>
                </div>

                {/* Revenue with animation on hover */}
                <div className="mb-3 sm:mb-4">
                  <p className={`
                    text-2xl sm:text-3xl font-bold 
                    bg-gradient-to-r from-gray-900 to-gray-700 
                    bg-clip-text text-transparent
                    ${transitions.base}
                    group-hover:scale-105 origin-left
                  `}>
                    {formatCurrency(provider.revenue || 0)}
                  </p>
                </div>

                {/* Progress Bar - Revenue Share with provider color */}
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-1.5">
                    <span className="font-medium">Revenue Share</span>
                    <span className="font-semibold">{provider.share.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200/60 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
                    <div
                      className="h-2.5 rounded-full transition-[width] duration-500 ease-out shadow-sm"
                      style={{ 
                        width: `${Math.min(provider.share, 100)}%`,
                        backgroundColor: medalStyle.progressColor
                      }}
                    />
                  </div>
                </div>

                {/* vs Last Month with enhanced badge */}
                <div className={`
                  flex items-center gap-1.5 p-2.5 rounded-lg
                  ${isPositive 
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 ring-1 ring-green-200/50' 
                    : 'bg-gradient-to-r from-red-50 to-rose-50 ring-1 ring-red-200/50'}
                  ${transitions.base}
                `}>
                  <TrendIcon 
                    className={`w-4 h-4 sm:w-5 sm:h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                  />
                  <span className={`text-xs sm:text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                    {isPositive ? '+' : ''}{provider.vsLastMonth.toFixed(1)}%
                  </span>
                  <span className="text-xs sm:text-sm text-gray-600">vs last month</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile pagination dots */}
        {isMobile && providers.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {providers.map((_, index) => (
              <button
                key={index}
                onClick={() => setMobileIndex(index)}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${index === mobileIndex ? 'bg-blue-600 w-6' : 'bg-gray-300'}
                `}
                aria-label={`Go to provider ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
