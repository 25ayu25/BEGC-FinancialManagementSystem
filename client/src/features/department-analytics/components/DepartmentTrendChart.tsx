/**
 * Department Trend Chart Component
 * 
 * Multi-line chart showing department revenue trends over time
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, AreaChart as AreaChartIcon, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentMetrics, MonthlyTrendData } from "../utils/calculations";
import { formatSSP, formatMonthSafely } from "../utils/calculations";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  AreaChart as RechartsAreaChart,
  BarChart as RechartsBarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface DepartmentTrendChartProps {
  metrics: DepartmentMetrics[];
  trendData: MonthlyTrendData[];
}

type ChartType = 'line' | 'area' | 'bar';

export function DepartmentTrendChart({ metrics, trendData }: DepartmentTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [visibleDepartments, setVisibleDepartments] = useState<Set<string>>(
    new Set(metrics.slice(0, 5).map(m => m.id))
  );

  const toggleDepartment = (deptId: string) => {
    const newVisible = new Set(visibleDepartments);
    if (newVisible.has(deptId)) {
      newVisible.delete(deptId);
    } else {
      newVisible.add(deptId);
    }
    setVisibleDepartments(newVisible);
  };

  const chartData = useMemo(() => {
    return trendData.map(monthData => {
      const dataPoint: any = {
        month: formatMonthSafely(monthData.month),
        date: monthData.month,
      };

      metrics.forEach(dept => {
        if (visibleDepartments.has(dept.id)) {
          dataPoint[dept.id] = monthData.departmentBreakdown[dept.id] || 0;
        }
      });

      return dataPoint;
    });
  }, [trendData, metrics, visibleDepartments]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any) => {
            const dept = metrics.find(m => m.id === entry.dataKey);
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700">{dept?.name}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  SSP {formatSSP(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 10, bottom: 10 },
    };

    const xAxisProps = {
      dataKey: "month",
      tick: { fontSize: 12 },
      stroke: "#94a3b8",
    };

    const yAxisProps = {
      tick: { fontSize: 12 },
      stroke: "#94a3b8",
      tickFormatter: (value: number) => formatSSP(value, true),
    };

    const gridProps = {
      strokeDasharray: "3 3",
      stroke: "#e2e8f0",
    };

    if (chartType === 'line') {
      return (
        <RechartsLineChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {metrics
            .filter(dept => visibleDepartments.has(dept.id))
            .map(dept => (
              <Line
                key={dept.id}
                type="monotone"
                dataKey={dept.id}
                name={dept.name}
                stroke={dept.color}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
        </RechartsLineChart>
      );
    }

    if (chartType === 'area') {
      return (
        <RechartsAreaChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {metrics
            .filter(dept => visibleDepartments.has(dept.id))
            .map(dept => (
              <Area
                key={dept.id}
                type="monotone"
                dataKey={dept.id}
                name={dept.name}
                stroke={dept.color}
                fill={dept.color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
        </RechartsAreaChart>
      );
    }

    return (
      <RechartsBarChart {...commonProps}>
        <CartesianGrid {...gridProps} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<CustomTooltip />} />
        {metrics
          .filter(dept => visibleDepartments.has(dept.id))
          .map(dept => (
            <Bar
              key={dept.id}
              dataKey={dept.id}
              name={dept.name}
              fill={dept.color}
            />
          ))}
      </RechartsBarChart>
    );
  };

  if (metrics.length === 0 || trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="w-5 h-5" />
            Revenue Trend
          </CardTitle>
          
          {/* Chart Type Selector */}
          <div className="flex gap-2">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              <LineChart className="w-4 h-4 mr-1" />
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              <AreaChartIcon className="w-4 h-4 mr-1" />
              Area
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Bar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart */}
        <div className="h-80 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Department Toggle Buttons */}
        <div className="flex flex-wrap gap-2">
          {metrics.map(dept => (
            <button
              key={dept.id}
              onClick={() => toggleDepartment(dept.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                visibleDepartments.has(dept.id)
                  ? "text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              style={
                visibleDepartments.has(dept.id)
                  ? { backgroundColor: dept.color }
                  : undefined
              }
            >
              {dept.name}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
