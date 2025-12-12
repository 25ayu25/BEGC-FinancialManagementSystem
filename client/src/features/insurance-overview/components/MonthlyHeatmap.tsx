/**
 * Monthly Heatmap Component
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSSP, type ProviderMetrics } from "../utils/calculations";
import { Tooltip } from "@/components/ui/tooltip";

interface MonthlyHeatmapProps {
  metrics: ProviderMetrics[];
}

export function MonthlyHeatmap({ metrics }: MonthlyHeatmapProps) {
  // Prepare heatmap data - aggregate all providers by month
  const monthlyData = new Map<string, number>();
  
  metrics.forEach(provider => {
    provider.monthlyTrend.forEach(({ month, revenue }) => {
      monthlyData.set(month, (monthlyData.get(month) || 0) + revenue);
    });
  });

  // Get min and max for color scaling
  const values = Array.from(monthlyData.values());
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);

  // Convert to array and sort
  const months = Array.from(monthlyData.entries())
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => {
      // Simple month name sorting
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

  // Get color intensity based on value
  const getColorIntensity = (value: number): string => {
    if (maxValue === minValue) return 'bg-violet-400';
    
    const normalized = (value - minValue) / (maxValue - minValue);
    
    if (normalized >= 0.8) return 'bg-violet-700';
    if (normalized >= 0.6) return 'bg-violet-600';
    if (normalized >= 0.4) return 'bg-violet-500';
    if (normalized >= 0.2) return 'bg-violet-400';
    return 'bg-violet-300';
  };

  return (
    <Card className="border-violet-200 dark:border-violet-800">
      <CardHeader>
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Monthly Performance Heatmap
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Visual representation of revenue intensity by month
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
                `}
              >
                <span className="text-xs font-medium text-white">
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
                  <p>{formatSSP(value)}</p>
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
          <span className="text-xs text-gray-600 dark:text-gray-400">Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded bg-violet-300"></div>
            <div className="w-6 h-6 rounded bg-violet-400"></div>
            <div className="w-6 h-6 rounded bg-violet-500"></div>
            <div className="w-6 h-6 rounded bg-violet-600"></div>
            <div className="w-6 h-6 rounded bg-violet-700"></div>
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400">High</span>
        </div>
      </CardContent>
    </Card>
  );
}
