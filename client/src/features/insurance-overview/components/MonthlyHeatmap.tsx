/**
 * Monthly Heatmap Component
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSD, sortMonthsChronologically, type ProviderMetrics } from "../utils/calculations";

interface MonthlyHeatmapProps {
  metrics: ProviderMetrics[];
}

export function MonthlyHeatmap({ metrics }: MonthlyHeatmapProps) {
  // All 12 months in order
  const ALL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Prepare heatmap data - aggregate all providers by month
  const monthlyData = new Map<string, number>();
  
  // Initialize all months with 0
  ALL_MONTHS.forEach(month => {
    monthlyData.set(month, 0);
  });
  
  // Add actual data
  metrics.forEach(provider => {
    provider.monthlyTrend.forEach(({ month, revenue }) => {
      monthlyData.set(month, (monthlyData.get(month) || 0) + revenue);
    });
  });

  // Get min and max for color scaling
  const values = Array.from(monthlyData.values()).filter(v => v > 0);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  // Convert to array (already in correct order from ALL_MONTHS)
  const months = ALL_MONTHS.map(month => ({ 
    month, 
    value: monthlyData.get(month) || 0 
  }));

  // Get color intensity based on value - multi-color gradient
  const getColorIntensity = (value: number): string => {
    if (value === 0) return 'bg-gray-200 dark:bg-gray-700';
    if (maxValue === minValue) return 'bg-emerald-500';
    
    const normalized = (value - minValue) / (maxValue - minValue);
    
    // Multi-color gradient: Light gray → Green → Amber → Orange → Red
    if (normalized >= 0.8) return 'bg-red-600';      // Very high
    if (normalized >= 0.6) return 'bg-orange-500';   // High
    if (normalized >= 0.4) return 'bg-amber-500';    // Medium-high
    if (normalized >= 0.2) return 'bg-green-500';    // Medium
    return 'bg-emerald-400';                          // Low
  };

  return (
    <Card className="border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Monthly Performance Heatmap
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Visual representation of revenue intensity by month (all months shown)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {months.map(({ month, value }) => (
            <div
              key={month}
              className="group relative"
            >
              <div
                className={`
                  aspect-square rounded-lg ${getColorIntensity(value)}
                  flex items-center justify-center
                  transition-all duration-200
                  hover:scale-110 hover:shadow-lg
                  cursor-pointer
                  ${value === 0 ? 'opacity-50' : ''}
                `}
              >
                <span className="text-xs font-medium text-white drop-shadow-md">
                  {month}
                </span>
              </div>
              
              {/* Tooltip on hover */}
              <div className="
                absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                opacity-0 group-hover:opacity-100
                transition-opacity duration-200
                pointer-events-none
                z-10
              ">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                  <p className="font-semibold">{month}</p>
                  <p>{value > 0 ? formatUSD(value) : 'No data'}</p>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">No data</span>
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded bg-emerald-400"></div>
            <div className="w-6 h-6 rounded bg-green-500"></div>
            <div className="w-6 h-6 rounded bg-amber-500"></div>
            <div className="w-6 h-6 rounded bg-orange-500"></div>
            <div className="w-6 h-6 rounded bg-red-600"></div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">High</span>
        </div>
      </CardContent>
    </Card>
  );
}
