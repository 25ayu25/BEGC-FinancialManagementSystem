import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { transitions, shadows, hover } from "../utils/animations";
import { useIsMobile } from "../hooks/useMediaQuery";

interface ProviderShare {
  name: string;
  value: number;
  color: string;
}

interface ShareByProviderChartProps {
  data: ProviderShare[];
}

const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
];

export function ShareByProviderChart({ data }: ShareByProviderChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hiddenProviders, setHiddenProviders] = useState<Set<number>>(new Set());
  const isMobile = useIsMobile();

  // Assign colors to providers
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length],
  }));

  // Filter out hidden providers
  const visibleData = chartData.filter((_, index) => !hiddenProviders.has(index));
  const total = visibleData.reduce((sum, item) => sum + item.value, 0);

  // Toggle provider visibility
  const toggleProvider = (index: number) => {
    const newHidden = new Set(hiddenProviders);
    if (newHidden.has(index)) {
      newHidden.delete(index);
    } else {
      // Don't allow hiding all providers
      if (newHidden.size < chartData.length - 1) {
        newHidden.add(index);
      }
    }
    setHiddenProviders(newHidden);
  };

  // Handle pie segment hover
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // Responsive radius based on screen size
  const innerRadius = isMobile ? 50 : 70;
  const outerRadius = isMobile ? 80 : 110;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = total > 0 ? (data.value / total) * 100 : 0;
      return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            ${Math.round(data.value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500">{percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`
      bg-gradient-to-br from-white to-purple-50/20
      rounded-xl 
      ${shadows.md} 
      border border-gray-200/60 
      p-4 sm:p-6 
      ${transitions.base}
      ${hover.lift}
      relative overflow-hidden
    `}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Share by Provider</h2>
        
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
          {/* Donut Chart */}
          <div className="w-full lg:w-1/2 h-64 sm:h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  animationDuration={800}
                  animationBegin={0}
                >
                  {visibleData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                      style={{
                        filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                        transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: 'center',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                  <Label
                    value={`$${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    position="center"
                    className="text-xl sm:text-2xl font-bold"
                    fill="#111827"
                  />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Legend */}
          <div className="w-full lg:w-1/2 space-y-2 sm:space-y-3">
            {chartData.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const isHidden = hiddenProviders.has(index);
              
              return (
                <button
                  key={index}
                  onClick={() => toggleProvider(index)}
                  className={`
                    w-full flex items-center justify-between p-2 sm:p-3 rounded-lg
                    ${transitions.base}
                    ${isHidden ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50 hover:shadow-sm'}
                    cursor-pointer group
                  `}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`
                        w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0
                        ${transitions.base}
                        ${!isHidden && 'group-hover:scale-125 group-hover:shadow-md'}
                      `}
                      style={{ 
                        backgroundColor: item.color,
                        opacity: isHidden ? 0.3 : 1
                      }}
                    />
                    <span className={`text-sm sm:text-base text-gray-700 truncate ${isHidden ? 'line-through' : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-sm sm:text-base font-semibold text-gray-900 ${isHidden ? 'opacity-50' : ''}`}>
                      ${item.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs text-gray-500 ${isHidden ? 'opacity-50' : ''}`}>
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                </button>
              );
            })}
            
            {hiddenProviders.size > 0 && (
              <p className="text-xs text-gray-500 text-center pt-2 italic">
                Click items to show/hide from chart
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
