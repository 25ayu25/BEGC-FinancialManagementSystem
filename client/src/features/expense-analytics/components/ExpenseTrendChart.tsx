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

// More muted colors (reduced saturation by ~20%)
const CHART_COLORS = [
  "#dc2626", // red-600 (more muted)
  "#ea580c", // orange-600
  "#d97706", // amber-600
  "#0d9488", // teal-600
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#059669", // green-600
];

export function ExpenseTrendChart({ chartData, metrics, isLoading }: ExpenseTrendChartProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [chartType, setChartType] = useState<ChartType>('line'); // Default to Line chart

  const topCategories = useMemo(() => {
    return metrics.slice(0, 8);
  }, [metrics]);

  // Validate chart data to ensure all category values are numeric
  const validatedChartData = useMemo(() => {
    return chartData.map(dataPoint => {
      const validated = { ...dataPoint };
      
      // Ensure all categories have valid numeric values
      topCategories.forEach(category => {
        const value = validated[category.name];
        if (typeof value !== 'number' || isNaN(value)) {
          validated[category.name] = 0;
        }
      });
      
      return validated;
    });
  }, [chartData, topCategories]);

  // Fill in missing months to prevent gaps
  const filledChartData = useMemo(() => {
    if (validatedChartData.length === 0) return [];
    
    // Get the date range
    const allMonths = validatedChartData.map(d => d.month).sort();
    if (allMonths.length === 0) return validatedChartData;
    
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
      const existingData = validatedChartData.find(d => d.month === monthKey);
      
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
  }, [validatedChartData, topCategories]);

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

  // Helper function to add opacity to hex colors
  const addOpacityToHex = (hex: string, opacity: number): string => {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    // Validate hex format (must be 6 characters)
    if (cleanHex.length !== 6) {
      console.warn(`Invalid hex color: ${hex}`);
      return hex; // Return original if invalid
    }
    // Convert opacity (0-1) to hex (00-FF)
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `#${cleanHex}${alpha}`;
  };

  // Helper function for chart button styling
  const getChartButtonClass = (type: ChartType) => {
    return cn(
      "transition-all duration-200",
      chartType === type && "bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600"
    );
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
          <div className="h-80 flex flex-col items-center justify-center text-gray-500">
            <BarChart3 className="h-12 w-12 mb-4 text-gray-300" />
            <p className="font-medium">No expense data available</p>
            <p className="text-sm">Data will appear once expenses are recorded for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if there's actual numeric data to display
  const hasActualData = useMemo(() => {
    return filledChartData.some(dataPoint => 
      topCategories.some(cat => 
        dataPoint[cat.name] && dataPoint[cat.name] > 0
      )
    );
  }, [filledChartData, topCategories]);

  if (!hasActualData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex flex-col items-center justify-center text-gray-500">
            <BarChart3 className="h-12 w-12 mb-4 text-gray-300" />
            <p className="font-medium">No expense data available</p>
            <p className="text-sm">Data will appear once expenses are recorded for this period</p>
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
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
              className={getChartButtonClass('line')}
            >
              <LineChartIcon className="w-4 h-4 mr-1" />
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('area')}
              className={getChartButtonClass('area')}
            >
              <AreaChartIcon className="w-4 h-4 mr-1" />
              Area
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('bar')}
              className={getChartButtonClass('bar')}
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
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return (
              <button
                key={category.name}
                onClick={() => toggleCategory(category.name)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-md",
                  "border-2 cursor-pointer",
                  isHidden ? "opacity-50 scale-95 grayscale" : "opacity-100 scale-100 hover:scale-105"
                )}
                style={{
                  backgroundColor: isHidden ? 'transparent' : addOpacityToHex(color, 0.1),
                  borderColor: addOpacityToHex(color, 0.5),
                  color: color,
                }}
              >
                {category.name}
              </button>
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
