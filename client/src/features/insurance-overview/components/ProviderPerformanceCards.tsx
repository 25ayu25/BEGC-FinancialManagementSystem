import React, { useState } from "react";
import { TrendingUp, TrendingDown, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { useIsMobile, useIsTablet } from "../hooks/useMediaQuery";

interface ProviderPerformance {
  rank: number;
  name: string;
  revenue: number;
  share: number; // percentage of total revenue
  vsLastMonth: number; // percentage change
}

interface ProviderPerformanceCardsProps {
  providers: ProviderPerformance[];
}

export function ProviderPerformanceCards({ providers }: ProviderPerformanceCardsProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [mobileIndex, setMobileIndex] = useState(0);

  // Determine how many cards to show at once on mobile
  const cardsToShow = isMobile ? 1 : providers.length;
  const visibleProviders = isMobile 
    ? [providers[mobileIndex]] 
    : providers;

  const handlePrevious = () => {
    setMobileIndex((prev) => (prev > 0 ? prev - 1 : providers.length - 1));
  };

  const handleNext = () => {
    setMobileIndex((prev) => (prev < providers.length - 1 ? prev + 1 : 0));
  };

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
            
            // Medal colors for top 3 with gradients
            const getMedalStyle = (rank: number) => {
              switch(rank) {
                case 1:
                  return "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white";
                case 2:
                  return "bg-gradient-to-br from-gray-300 to-gray-400 text-white";
                case 3:
                  return "bg-gradient-to-br from-orange-400 to-orange-600 text-white";
                default:
                  return "bg-gray-100 text-gray-600";
              }
            };

            return (
              <div
                key={provider.rank}
                className={`
                  border border-gray-200 rounded-xl p-4 sm:p-5
                  bg-gradient-to-br from-white to-gray-50/50
                  ${transitions.base}
                  ${hover.scale}
                  ${shadows.sm}
                  group
                  min-h-[200px]
                  touch-manipulation
                `}
              >
                {/* Header with Rank and Name */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {provider.rank <= 3 ? (
                      <div className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full 
                        ${getMedalStyle(provider.rank)}
                        flex items-center justify-center
                        shadow-lg
                        ${transitions.base}
                        group-hover:scale-110 group-hover:rotate-12
                      `}>
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    ) : (
                      <div className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 
                        flex items-center justify-center
                        ${transitions.base}
                        group-hover:bg-gray-200
                      `}>
                        <span className="text-xs sm:text-sm font-bold text-gray-600">
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
                    group-hover:scale-105
                  `}>
                    ${provider.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>

                {/* Progress Bar - Revenue Share with gradient */}
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-1.5">
                    <span className="font-medium">Revenue Share</span>
                    <span className="font-semibold">{provider.share.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`
                        bg-gradient-to-r from-blue-500 to-blue-600 
                        h-2.5 rounded-full 
                        ${transitions.base}
                        shadow-sm
                      `}
                      style={{ width: `${Math.min(provider.share, 100)}%` }}
                    />
                  </div>
                </div>

                {/* vs Last Month with enhanced badge */}
                <div className={`
                  flex items-center gap-1.5 p-2 rounded-lg
                  ${isPositive ? 'bg-green-50' : 'bg-red-50'}
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
