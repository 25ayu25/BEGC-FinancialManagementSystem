import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { transitions, shadows, hover } from "../utils/animations";

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
  const animatedRevenue = useAnimatedCounter(totalRevenue, 500);
  
  // Generate mock sparkline data (7-day trend)
  // In production, this would come from actual historical data
  const generateSparklineData = () => {
    const baseValue = totalRevenue * 0.85;
    const variance = totalRevenue * 0.15;
    return Array.from({ length: 7 }, (_, i) => {
      const trend = isPositive ? i * 0.02 : -i * 0.02;
      return baseValue + Math.random() * variance + (baseValue * trend);
    });
  };

  const sparklineData = generateSparklineData();

  return (
    <div className={`
      bg-gradient-to-br from-white to-blue-50/30 
      rounded-xl 
      ${shadows.md} 
      border border-gray-200/60 
      p-6 
      ${transitions.base}
      ${hover.lift}
      relative overflow-hidden
    `}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Revenue Overview</h2>
        
        <div className="space-y-6">
          {/* Total Revenue with Sparkline */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                ${animatedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <Sparkline 
                data={sparklineData} 
                trend={isPositive ? 'up' : 'down'}
                height={32}
                width={100}
              />
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
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full
                ${isPositive ? 'bg-green-50 ring-1 ring-green-200' : 'bg-red-50 ring-1 ring-red-200'}
                ${transitions.base}
              `}>
                <TrendIcon 
                  className={`w-4 h-4 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                />
                <span className={`text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                  {isPositive ? '+' : ''}{vsLastMonth.toFixed(1)}%
                </span>
              </div>
              <span className="text-sm text-gray-600">vs Last Month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
