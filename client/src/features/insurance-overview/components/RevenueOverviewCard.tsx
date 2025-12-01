import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Building2, DollarSign } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { formatCurrency } from "@/lib/format";

interface RevenueOverviewCardProps {
  totalRevenue: number;
  activeProviders: number;
  vsLastMonth: number; // percentage change
}

// Animated counter hook with faster, smoother animation
function useAnimatedCounter(end: number, duration: number = 500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Smoother easing function (cubic ease-out)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(end * easeOutCubic));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

export function RevenueOverviewCard({
  totalRevenue,
  activeProviders,
  vsLastMonth,
}: RevenueOverviewCardProps) {
  const isPositive = vsLastMonth >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  
  // Animated revenue counter with faster speed (500ms)
  const animatedRevenue = useAnimatedCounter(Math.round(totalRevenue), 500);

  return (
    <div className={`
      bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30
      rounded-xl 
      ${shadows.md} 
      border border-blue-100/60 
      p-6 
      ${transitions.base}
      ${hover.lift}
      relative overflow-hidden
      backdrop-blur-sm
    `}>
      {/* Enhanced gradient overlay with frosted glass effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.08] via-transparent to-indigo-500/[0.05] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Revenue Overview</h2>
        
        <div className="space-y-6">
          {/* Total Revenue with Trend Indicator */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              {/* Prominent USD Currency Label */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
                <DollarSign className="w-3 h-3" />
                USD
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                {formatCurrency(animatedRevenue)}
              </p>
              {/* Trend indicator */}
              <div className={`
                flex items-center gap-2 px-3 py-2 rounded-lg
                ${isPositive 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/60' 
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/60'}
              `}>
                <TrendIcon 
                  className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                />
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                  {isPositive ? '+' : ''}{vsLastMonth.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Active Providers */}
          <div className={`flex items-center gap-3 ${transitions.base} hover:bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg`}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Providers</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{activeProviders}</p>
            </div>
          </div>

          {/* vs Last Month with enhanced styling */}
          <div className="pt-4 border-t border-gray-200/60">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full
                ${isPositive 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 ring-1 ring-green-200/80' 
                  : 'bg-gradient-to-r from-red-50 to-rose-50 ring-1 ring-red-200/80'}
                ${transitions.base}
                shadow-sm
              `}>
                <TrendIcon 
                  className={`w-4 h-4 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                />
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                  {isPositive ? '+' : ''}{vsLastMonth.toFixed(1)}%
                </span>
              </div>
              <span className="text-sm text-gray-600 font-medium">vs Last Month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
