import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Building2, DollarSign, Target, Calendar, TrendingUpIcon } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface RevenueOverviewCardProps {
  totalRevenue: number;
  activeProviders: number;
  vsLastMonth: number; // percentage change
  avgRevenuePerProvider?: number;
  projectedMonthlyTotal?: number | null;
  ytdRevenue?: number;
  bestMonth?: { month: Date | string; revenue: number } | null;
  trendData?: number[];
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
  avgRevenuePerProvider,
  projectedMonthlyTotal,
  ytdRevenue,
  bestMonth,
  trendData = [],
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
        {/* Header Row: Title + Total Revenue + USD Chip + vs Last Month */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Revenue Overview</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
                <DollarSign className="w-3 h-3" />
                USD
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
              {formatCurrency(animatedRevenue)}
            </p>
          </div>
          
          {/* vs Last Month - Top Right */}
          <div className={`
            flex items-center gap-2 px-3 py-2 rounded-lg self-start
            ${isPositive 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/60' 
              : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/60'}
          `}>
            <TrendIcon 
              className={`w-5 h-5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
            />
            <div>
              <span className={`text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                {isPositive ? '+' : ''}{vsLastMonth.toFixed(1)}%
              </span>
              <p className="text-xs text-gray-600">vs last month</p>
            </div>
          </div>
        </div>

        {/* KPI Grid - 2x2 or 4-column */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {/* Active Providers */}
          <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-200/40 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-600">Active Providers</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{activeProviders}</p>
          </div>

          {/* Average per Provider */}
          {avgRevenuePerProvider !== undefined && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/50 border border-emerald-200/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUpIcon className="w-4 h-4 text-emerald-600" />
                <p className="text-xs text-gray-600">Avg / Provider</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(avgRevenuePerProvider)}</p>
            </div>
          )}

          {/* Projected Monthly Total */}
          {projectedMonthlyTotal !== null && projectedMonthlyTotal !== undefined && (
            <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-200/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-amber-600" />
                <p className="text-xs text-gray-600">Projected</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(projectedMonthlyTotal)}</p>
            </div>
          )}

          {/* YTD Revenue */}
          {ytdRevenue !== undefined && (
            <div className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 border border-purple-200/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-gray-600">YTD Total</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(ytdRevenue)}</p>
            </div>
          )}
        </div>

        {/* Best Performing Month - Single Pill at Bottom */}
        {bestMonth && (
          <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-50/50 to-amber-50/50 border border-yellow-200/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-xs text-gray-600">Best Performing Month</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {format(typeof bestMonth.month === 'string' ? new Date(bestMonth.month) : bestMonth.month, 'MMMM yyyy')}
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-yellow-700">
                {formatCurrency(bestMonth.revenue)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
