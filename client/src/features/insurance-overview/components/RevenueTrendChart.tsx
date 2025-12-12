/**
 * Revenue Trend Chart Component
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { LineChartIcon, AreaChartIcon, BarChart3, Eye, EyeOff } from "lucide-react";
import { formatUSD, type ProviderMetrics } from "../utils/calculations";

interface RevenueTrendChartProps {
  metrics: ProviderMetrics[];
}

type ChartType = 'line' | 'area' | 'bar' | 'stacked-bar' | 'stacked-area';

const COLORS = [
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
];

export function RevenueTrendChart({ metrics }: RevenueTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(
    new Set(metrics.slice(0, 5).map(m => m.id))
  );

  // Prepare chart data
  const chartData = (() => {
    // Get all unique months across all providers
    const monthsSet = new Set<string>();
    metrics.forEach(m => {
      m.monthlyTrend.forEach(t => monthsSet.add(t.month));
    });
    const months = Array.from(monthsSet).sort();

    // Build data array
    return months.map(month => {
      const dataPoint: any = { month };
      metrics.forEach(provider => {
        if (visibleProviders.has(provider.id)) {
          const monthData = provider.monthlyTrend.find(t => t.month === month);
          dataPoint[provider.name] = monthData ? monthData.revenue : 0;
        }
      });
      return dataPoint;
    });
  })();

  const toggleProvider = (providerId: string) => {
    setVisibleProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  };

  const renderChart = () => {
    const visibleMetrics = metrics.filter(m => visibleProviders.has(m.id));

    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value: any) => formatUSD(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {visibleMetrics.map((provider, index) => (
              <Line
                key={provider.id}
                type="monotone"
                dataKey={provider.name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value: any) => formatUSD(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {visibleMetrics.map((provider, index) => (
              <Area
                key={provider.id}
                type="monotone"
                dataKey={provider.name}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value: any) => formatUSD(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {visibleMetrics.map((provider, index) => (
              <Bar
                key={provider.id}
                dataKey={provider.name}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        );

      case 'stacked-bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value: any) => formatUSD(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {visibleMetrics.map((provider, index) => (
              <Bar
                key={provider.id}
                dataKey={provider.name}
                stackId="a"
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        );

      case 'stacked-area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
            <Tooltip 
              formatter={(value: any) => formatUSD(value)}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {visibleMetrics.map((provider, index) => (
              <Area
                key={provider.id}
                type="monotone"
                dataKey={provider.name}
                stackId="1"
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </AreaChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="border-violet-200 dark:border-violet-800">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Revenue Trends
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
              className={chartType === 'line' ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <LineChartIcon className="w-4 h-4 mr-1" />
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
              className={chartType === 'area' ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <AreaChartIcon className="w-4 h-4 mr-1" />
              Area
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
              className={chartType === 'bar' ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Bar
            </Button>
            <Button
              variant={chartType === 'stacked-bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('stacked-bar')}
              className={chartType === 'stacked-bar' ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Stacked
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Provider toggles */}
        <div className="flex flex-wrap gap-2 mb-6">
          {metrics.slice(0, 8).map((provider, index) => (
            <Badge
              key={provider.id}
              variant={visibleProviders.has(provider.id) ? 'default' : 'outline'}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: visibleProviders.has(provider.id) 
                  ? COLORS[index % COLORS.length] 
                  : undefined
              }}
              onClick={() => toggleProvider(provider.id)}
            >
              {visibleProviders.has(provider.id) ? (
                <Eye className="w-3 h-3 mr-1" />
              ) : (
                <EyeOff className="w-3 h-3 mr-1" />
              )}
              {provider.name}
            </Badge>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
