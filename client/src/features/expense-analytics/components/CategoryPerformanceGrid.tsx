/**
 * Category Performance Grid Component
 * 
 * Displays expense categories with metrics and sparklines
 */

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatSSP } from "../utils/calculations";
import type { CategoryMetrics } from "../utils/calculations";
import { cn } from "@/lib/utils";

interface CategoryPerformanceGridProps {
  metrics: CategoryMetrics[];
  onCategoryClick?: (category: CategoryMetrics) => void;
  isLoading?: boolean;
}

function Sparkline({ data }: { data: Array<{ month: string; amount: number }> }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.amount));
  const min = Math.min(...data.map(d => d.amount));
  const range = max - min;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = range > 0 ? ((max - d.amount) / range) * 100 : 50;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-teal-500"
      />
    </svg>
  );
}

export function CategoryPerformanceGrid({ 
  metrics, 
  onCategoryClick,
  isLoading 
}: CategoryPerformanceGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-8 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
              <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-12 w-full bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No expense data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((category, index) => {
        const growthIcon = category.growth > 5 ? TrendingUp : category.growth < -5 ? TrendingDown : Minus;
        const growthColor = category.growth > 5 ? "text-red-600" : category.growth < -5 ? "text-green-600" : "text-gray-500";
        const GrowthIcon = growthIcon;

        return (
          <Card
            key={category.id}
            className={cn(
              "hover:shadow-lg transition-all cursor-pointer border-t-4",
              index === 0 && "border-t-red-500",
              index === 1 && "border-t-orange-500",
              index === 2 && "border-t-amber-500",
              index > 2 && "border-t-gray-300"
            )}
            onClick={() => onCategoryClick?.(category)}
          >
            <CardContent className="p-6">
              {/* Rank Badge */}
              <div className="flex items-start justify-between mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
                  #{index + 1}
                </span>
                <div className={cn("flex items-center gap-1 text-xs", growthColor)}>
                  <GrowthIcon className="w-3 h-3" />
                  <span>{Math.abs(category.growth).toFixed(1)}%</span>
                </div>
              </div>

              {/* Category Name */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                {category.name}
              </h3>

              {/* Total Amount */}
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatSSP(category.total)}
              </div>

              {/* Percentage of Total */}
              <div className="text-sm text-gray-600 mb-4">
                {category.percentage.toFixed(1)}% of total expenses
              </div>

              {/* Sparkline */}
              <div className="h-12 mb-2">
                <Sparkline data={category.monthlyData} />
              </div>

              {/* Best Month Info */}
              {category.bestMonth && (
                <div className="text-xs text-gray-500">
                  Peak: {formatSSP(category.bestMonth.amount)} in {category.bestMonth.month}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
