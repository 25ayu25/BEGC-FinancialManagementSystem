/**
 * Expense Trend Chart Component
 * 
 * Displays expense trends over time with category breakdown
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import type { CategoryMetrics } from "../utils/calculations";

interface ExpenseTrendChartProps {
  chartData: Array<Record<string, any>>;
  metrics: CategoryMetrics[];
  isLoading?: boolean;
}

const CHART_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#14b8a6", // teal-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#10b981", // green-500
];

export function ExpenseTrendChart({ chartData, metrics, isLoading }: ExpenseTrendChartProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const topCategories = useMemo(() => {
    return metrics.slice(0, 8);
  }, [metrics]);

  const toggleCategory = (categoryName: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const formatCurrency = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (abs >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${(value / 1_000).toFixed(0)}k`;
    }
    return value.toFixed(0);
  };

  const formatXAxis = (value: string) => {
    try {
      const parts = value.split('-');
      if (parts.length >= 2) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        return format(date, 'MMM yy');
      }
      return value;
    } catch {
      return value;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-500">
            No trend data available for the selected period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Expense Trends</span>
          <span className="text-sm font-normal text-gray-500">
            Click legend items to show/hide categories
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {topCategories.map((category, index) => {
            const isHidden = hiddenCategories.has(category.name);
            return (
              <Badge
                key={category.name}
                variant={isHidden ? "outline" : "default"}
                className="cursor-pointer"
                style={{
                  backgroundColor: isHidden ? 'transparent' : CHART_COLORS[index % CHART_COLORS.length],
                  color: isHidden ? CHART_COLORS[index % CHART_COLORS.length] : 'white',
                  borderColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
                onClick={() => toggleCategory(category.name)}
              >
                {category.name}
              </Badge>
            );
          })}
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <defs>
              {topCategories.map((category, index) => {
                // Generate safe CSS ID by removing all non-alphanumeric characters except hyphens
                const safeId = category.name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
                return (
                  <linearGradient
                    key={category.name}
                    id={`color-${safeId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `SSP ${value.toLocaleString()}`,
                name,
              ]}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
            {topCategories.map((category, index) => {
              if (hiddenCategories.has(category.name)) return null;
              // Generate safe CSS ID by removing all non-alphanumeric characters except hyphens
              const safeId = category.name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
              return (
                <Area
                  key={category.name}
                  type="monotone"
                  dataKey={category.name}
                  stackId="1"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={`url(#color-${safeId})`}
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
