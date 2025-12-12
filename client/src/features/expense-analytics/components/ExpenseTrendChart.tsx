/**
 * Expense Trend Chart Component
 * 
 * Displays expense trends over time with category breakdown
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { AreaChartIcon, LineChartIcon, BarChart3 } from "lucide-react";
import type { CategoryMetrics } from "../utils/calculations";
import { generateSafeCSSId } from "../utils/calculations";
import { cn } from "@/lib/utils";

interface ExpenseTrendChartProps {
  chartData: Array<Record<string, any>>;
  metrics: CategoryMetrics[];
  isLoading?: boolean;
}

type ChartType = 'area' | 'line' | 'bar';

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
  const [chartType, setChartType] = useState<ChartType>('area');

  const topCategories = useMemo(() => {
    return metrics.slice(0, 8);
  }, [metrics]);

  // Fill in missing months to prevent gaps
  const filledChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    
    // Get the date range
    const allMonths = chartData.map(d => d.month).sort();
    if (allMonths.length === 0) return chartData;
    
    const firstMonth = allMonths[0];
    const lastMonth = allMonths[allMonths.length - 1];
    
    // Parse dates
    const [startYear, startMonth] = firstMonth.split('-').map(Number);
    const [endYear, endMonth] = lastMonth.split('-').map(Number);
    
    // Generate all months in range
    const filled: Array<Record<string, any>> = [];
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const existingData = chartData.find(d => d.month === monthKey);
      
      if (existingData) {
        filled.push(existingData);
      } else {
        // Create empty data point for missing month
        const emptyData: Record<string, any> = { 
          month: monthKey,
          fullMonth: format(new Date(currentYear, currentMonth - 1, 1), 'MMM yyyy'),
          total: 0,
        };
        
        // Add zero values for all categories
        topCategories.forEach(cat => {
          emptyData[cat.name] = 0;
        });
        
        filled.push(emptyData);
      }
      
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    return filled;
  }, [chartData, topCategories]);

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

  const renderChart = () => {
    const commonProps = {
      data: filledChartData,
    };

    const commonAxisProps = {
      xAxis: {
        dataKey: "month",
        tickFormatter: formatXAxis,
        stroke: "#6b7280",
        style: { fontSize: '12px' },
      },
      yAxis: {
        tickFormatter: formatCurrency,
        stroke: "#6b7280",
        style: { fontSize: '12px' },
      },
      tooltip: {
        formatter: (value: number, name: string) => [
          `SSP ${value.toLocaleString()}`,
          name,
        ],
        contentStyle: {
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '12px',
          padding: '8px 12px',
        },
      },
    };

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...commonAxisProps.xAxis} />
          <YAxis {...commonAxisProps.yAxis} />
          <Tooltip {...commonAxisProps.tooltip} />
          {topCategories.map((category, index) => {
            if (hiddenCategories.has(category.name)) return null;
            return (
              <Line
                key={category.name}
                type="monotone"
                dataKey={category.name}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            );
          })}
        </LineChart>
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...commonAxisProps.xAxis} />
          <YAxis {...commonAxisProps.yAxis} />
          <Tooltip {...commonAxisProps.tooltip} />
          {topCategories.map((category, index) => {
            if (hiddenCategories.has(category.name)) return null;
            return (
              <Bar
                key={category.name}
                dataKey={category.name}
                stackId="stack"
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            );
          })}
        </BarChart>
      );
    }

    // Default: Area chart
    return (
      <AreaChart {...commonProps}>
        <defs>
          {topCategories.map((category, index) => {
            const safeId = generateSafeCSSId(category.name);
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
        <XAxis {...commonAxisProps.xAxis} />
        <YAxis {...commonAxisProps.yAxis} />
        <Tooltip {...commonAxisProps.tooltip} />
        {topCategories.map((category, index) => {
          if (hiddenCategories.has(category.name)) return null;
          const safeId = generateSafeCSSId(category.name);
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
    );
  };

  return (
    <Card className="shadow-lg border-2 border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-gray-900">Expense Trends</CardTitle>
          
          {/* Chart Type Toggle */}
          <div className="flex gap-2">
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
              className={cn(
                "transition-all",
                chartType === 'area' && "bg-gradient-to-r from-red-500 to-orange-500 text-white"
              )}
            >
              <AreaChartIcon className="w-4 h-4 mr-1" />
              Area
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
              className={cn(
                "transition-all",
                chartType === 'line' && "bg-gradient-to-r from-red-500 to-orange-500 text-white"
              )}
            >
              <LineChartIcon className="w-4 h-4 mr-1" />
              Line
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
              className={cn(
                "transition-all",
                chartType === 'bar' && "bg-gradient-to-r from-red-500 to-orange-500 text-white"
              )}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Bar
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Click legend items to show/hide categories
        </p>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-6">
          {topCategories.map((category, index) => {
            const isHidden = hiddenCategories.has(category.name);
            return (
              <Badge
                key={category.name}
                variant={isHidden ? "outline" : "default"}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: isHidden ? 'transparent' : CHART_COLORS[index % CHART_COLORS.length],
                  color: isHidden ? CHART_COLORS[index % CHART_COLORS.length] : 'white',
                  borderColor: CHART_COLORS[index % CHART_COLORS.length],
                  borderWidth: '2px',
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
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
