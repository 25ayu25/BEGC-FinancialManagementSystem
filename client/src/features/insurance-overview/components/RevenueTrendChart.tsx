/**
 * Revenue Trend Chart Component
 * 
 * Displays historical revenue trends over time with support for:
 * - Multiple chart types (Line, Area, Bar)
 * - Provider breakdown (multi-line comparison)
 * - Trend line overlay
 * - Interactive tooltips
 */

import React, { useState } from "react";
import { 
  ResponsiveContainer, 
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
  ReferenceLine
} from "recharts";
import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, TrendingUp } from "lucide-react";
import { transitions, shadows, hover } from "../utils/animations";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface TrendDataPoint {
  month: Date | string;
  revenue: number;
  [providerName: string]: any; // For provider breakdown
}

interface RevenueTrendChartProps {
  data: TrendDataPoint[];
  providers?: Array<{ id: string; name: string }>;
  title?: string;
  showProviderBreakdown?: boolean;
  defaultChartType?: ChartType;
  currentPreset?: string;
}

type ChartType = 'line' | 'area' | 'bar';

const PROVIDER_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
];

export function RevenueTrendChart({ 
  data, 
  providers = [],
  title = "Revenue Trend",
  showProviderBreakdown = false,
  defaultChartType = 'area',
  currentPreset = 'current-month'
}: RevenueTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [hiddenProviders, setHiddenProviders] = useState<Set<string>>(new Set());

  // Determine date format based on preset
  const isYearlyView = currentPreset === 'this-year' || currentPreset === 'last-year';
  const dateFormat = isYearlyView ? 'MMM' : 'MMM yyyy';

  // Format data for chart
  const chartData = data.map(point => ({
    ...point,
    month: typeof point.month === 'string' ? new Date(point.month) : point.month,
    label: format(typeof point.month === 'string' ? new Date(point.month) : point.month, dateFormat)
  }));

  // Get period label showing exact date range
  const getPeriodLabel = () => {
    if (!chartData.length) return '';
    const first = chartData[0].month;
    const last = chartData[chartData.length - 1].month;
    return `${format(first, 'MMMM yyyy')} – ${format(last, 'MMMM yyyy')}`;
  };

  // Calculate growth metrics
  const getGrowthMetrics = () => {
    if (chartData.length < 2) return null;
    
    const firstMonthRevenue = chartData[0]?.revenue || 0;
    const lastMonthRevenue = chartData[chartData.length - 1]?.revenue || 0;
    const periodGrowth = firstMonthRevenue > 0 
      ? ((lastMonthRevenue - firstMonthRevenue) / firstMonthRevenue) * 100 
      : 0;

    const bestMonth = chartData.reduce((max, curr) => 
      curr.revenue > max.revenue ? curr : max, chartData[0]);

    const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const avgRevenue = totalRevenue / chartData.length;

    return {
      periodGrowth,
      bestMonth,
      avgRevenue
    };
  };

  const growthMetrics = getGrowthMetrics();

  // Calculate trend line (linear regression)
  const calculateTrendLine = () => {
    if (chartData.length < 2) return null;
    
    const n = chartData.length;
    const sumX = chartData.reduce((sum, _, i) => sum + i, 0);
    const sumY = chartData.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = chartData.reduce((sum, d, i) => sum + i * d.revenue, 0);
    const sumX2 = chartData.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const y1 = intercept;
    const y2 = slope * (n - 1) + intercept;
    
    return { y1: Math.max(0, y1), y2: Math.max(0, y2) };
  };

  const trendLine = calculateTrendLine();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0].payload;
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
        <p className="text-sm font-semibold text-gray-900 mb-2">{data.label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-semibold text-gray-900">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Toggle provider visibility
  const toggleProvider = (providerName: string) => {
    const newHidden = new Set(hiddenProviders);
    if (newHidden.has(providerName)) {
      newHidden.delete(providerName);
    } else {
      newHidden.add(providerName);
    }
    setHiddenProviders(newHidden);
  };

  // Visible providers (not hidden)
  const visibleProviders = providers.filter(p => !hiddenProviders.has(p.name));

  return (
    <div className={`
      bg-gradient-to-br from-white to-teal-50/20
      rounded-xl 
      ${shadows.md} 
      border border-gray-200/60 
      p-4 sm:p-6 
      ${transitions.base}
      ${hover.lift}
      relative overflow-hidden
    `}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {chartData.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">{getPeriodLabel()}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart Type Selector */}
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white">
              <button
                onClick={() => setChartType('bar')}
                className={`
                  p-2 rounded-md transition-all
                  ${chartType === 'bar' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-gray-600 hover:bg-gray-50'}
                `}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`
                  p-2 rounded-md transition-all
                  ${chartType === 'line' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-gray-600 hover:bg-gray-50'}
                `}
                title="Line Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`
                  p-2 rounded-md transition-all
                  ${chartType === 'area' 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-gray-600 hover:bg-gray-50'}
                `}
                title="Area Chart"
              >
                <AreaChartIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Trend Line Toggle */}
            {!showProviderBreakdown && (
              <button
                onClick={() => setShowTrendLine(!showTrendLine)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
                  transition-all
                  ${showTrendLine 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}
                `}
              >
                <TrendingUp className="w-4 h-4" />
                Trend Line
              </button>
            )}
          </div>
        </div>

        {/* Growth Metrics Card */}
        {!showProviderBreakdown && growthMetrics && chartData.length >= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
            <div className="bg-white/50 rounded-lg p-3 border border-gray-200/60">
              <span className="text-gray-600 block mb-1">Period Growth</span>
              <span className={`text-lg font-semibold ${growthMetrics.periodGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growthMetrics.periodGrowth >= 0 ? '+' : ''}{growthMetrics.periodGrowth.toFixed(1)}%
              </span>
            </div>
            <div className="bg-white/50 rounded-lg p-3 border border-gray-200/60">
              <span className="text-gray-600 block mb-1">Best Month</span>
              <span className="text-lg font-semibold text-gray-900">
                {format(growthMetrics.bestMonth.month, 'MMM yyyy')}
              </span>
            </div>
            <div className="bg-white/50 rounded-lg p-3 border border-gray-200/60">
              <span className="text-gray-600 block mb-1">Monthly Avg</span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(growthMetrics.avgRevenue)}
              </span>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showProviderBreakdown && providers.length > 0 ? (
                  <>
                    <Legend />
                    {visibleProviders.map((provider, index) => (
                      <Bar 
                        key={provider.id}
                        dataKey={provider.name} 
                        fill={PROVIDER_COLORS[index % PROVIDER_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                    ))}
                  </>
                ) : (
                  <Bar 
                    dataKey="revenue" 
                    name="Total Revenue"
                    fill="#14b8a6" 
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                )}
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showTrendLine && trendLine && !showProviderBreakdown && (
                  <ReferenceLine
                    segment={[
                      { x: chartData[0]?.label, y: trendLine.y1 },
                      { x: chartData[chartData.length - 1]?.label, y: trendLine.y2 }
                    ]}
                    stroke="#3b82f6"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                )}
                {showProviderBreakdown && providers.length > 0 ? (
                  <>
                    <Legend />
                    {visibleProviders.map((provider, index) => (
                      <Line 
                        key={provider.id}
                        type="monotone"
                        dataKey={provider.name}
                        stroke={PROVIDER_COLORS[index % PROVIDER_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </>
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Total Revenue"
                    stroke="#14b8a6" 
                    strokeWidth={3}
                    dot={{ fill: "#14b8a6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1}/>
                  </linearGradient>
                  {providers.map((provider, index) => (
                    <linearGradient key={provider.id} id={`color${provider.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} stopOpacity={0.6}/>
                      <stop offset="95%" stopColor={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} stopOpacity={0.05}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showTrendLine && trendLine && !showProviderBreakdown && (
                  <ReferenceLine
                    segment={[
                      { x: chartData[0]?.label, y: trendLine.y1 },
                      { x: chartData[chartData.length - 1]?.label, y: trendLine.y2 }
                    ]}
                    stroke="#3b82f6"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                )}
                {showProviderBreakdown && providers.length > 0 ? (
                  <>
                    <Legend />
                    {visibleProviders.map((provider, index) => (
                      <Area 
                        key={provider.id}
                        type="monotone" 
                        dataKey={provider.name}
                        stroke={PROVIDER_COLORS[index % PROVIDER_COLORS.length]}
                        strokeWidth={2}
                        fill={`url(#color${provider.id})`}
                      />
                    ))}
                  </>
                ) : (
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Total Revenue"
                    stroke="#14b8a6" 
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Provider Legend (if breakdown enabled) */}
        {showProviderBreakdown && providers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200/60">
            <p className="text-xs text-gray-600 mb-2">Click to show/hide providers:</p>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider, index) => {
                const isHidden = hiddenProviders.has(provider.name);
                return (
                  <button
                    key={provider.id}
                    onClick={() => toggleProvider(provider.name)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                      transition-all
                      ${isHidden 
                        ? 'bg-gray-100 text-gray-400 opacity-50' 
                        : 'bg-white border border-gray-200 text-gray-700 hover:shadow-sm'}
                    `}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        backgroundColor: PROVIDER_COLORS[index % PROVIDER_COLORS.length],
                        opacity: isHidden ? 0.3 : 1
                      }}
                    />
                    <span className={isHidden ? 'line-through' : ''}>{provider.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
