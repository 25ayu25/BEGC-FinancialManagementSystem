/**
 * Provider Daily Timeline Component
 * 
 * Primary visualization for daily insurance payment data
 * Features:
 * - Stacked/grouped bar chart by date and provider
 * - Provider multi-select filter
 * - Date range presets (7 days, 30 days, 90 days, custom)
 * - USD-only display
 * - Recharts for visualization
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Calendar } from 'lucide-react';
import { useDailyInsurance, DailyInsuranceData } from '../hooks/useDailyInsurance';
import { formatUSDCompact, formatUSD, formatDateDisplay } from '../utils/formatters';

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
];

interface ProviderDailyTimelineProps {
  className?: string;
}

export function ProviderDailyTimeline({ className = '' }: ProviderDailyTimelineProps) {
  // Date preset state
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // Calculate date range based on preset
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();

    if (datePreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
      };
    }

    // Calculate start based on preset
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    start.setDate(end.getDate() - daysMap[datePreset]);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch data with filters
  const { data, loading, error, providers } = useDailyInsurance({
    startDate,
    endDate,
    providerIds: selectedProviders.length > 0 ? selectedProviders : undefined,
  });

  // Transform data for Recharts (group by date)
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group by date
    const dateMap = new Map<string, any>();

    data.forEach(item => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, {
          date: item.date,
          dateDisplay: formatDateDisplay(item.date),
        });
      }

      const dateEntry = dateMap.get(item.date)!;
      dateEntry[item.providerName] = item.amountUSD;
    });

    // Convert to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Get unique provider names for bars
  const providerNames = useMemo(() => {
    const names = new Set<string>();
    data.forEach(item => names.add(item.providerName));
    return Array.from(names).sort();
  }, [data]);

  // Handle provider selection
  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev => {
      if (prev.includes(providerId)) {
        return prev.filter(id => id !== providerId);
      } else {
        return [...prev, providerId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedProviders.length === providers.length) {
      setSelectedProviders([]);
    } else {
      setSelectedProviders(providers.map(p => p.id));
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-700">{entry.name}:</span>
            <span className="font-semibold text-gray-900">
              {formatUSD(entry.value)}
            </span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total:</span>
            <span>{formatUSD(total)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Daily Payment Timeline
        </h3>
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️ Error loading data</div>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Daily Payment Timeline (USD)
        </h3>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {startDate} to {endDate}
          </span>
        </div>
      </div>

      {/* Filters Row */}
      <div className="mb-4 space-y-3">
        {/* Date Presets */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDatePreset('7d')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              datePreset === '7d'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDatePreset('30d')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              datePreset === '30d'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDatePreset('90d')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              datePreset === '90d'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 90 Days
          </button>
          <button
            onClick={() => setDatePreset('custom')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              datePreset === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        {datePreset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )}

        {/* Provider Filter */}
        {providers.length > 0 && (
          <div className="flex gap-2 items-start">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {selectedProviders.length === providers.length ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex gap-2 flex-wrap">
              {providers
                .filter(p => p.isActive)
                .map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderToggle(provider.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      selectedProviders.includes(provider.id) ||
                      selectedProviders.length === 0
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-300'
                    }`}
                  >
                    {provider.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
            <p className="mt-2 text-gray-600">Loading data...</p>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="mt-2 text-gray-600">No payment data for selected date range</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateDisplay"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              tickFormatter={(value) => formatUSDCompact(value)}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
            {providerNames.map((name, index) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="a"
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Summary Stats */}
      {!loading && chartData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Days with Data:</span>
              <span className="ml-2 font-semibold text-gray-900">{chartData.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Amount:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {formatUSD(data.reduce((sum, item) => sum + item.amountUSD, 0))}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Avg Daily:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {formatUSD(
                  chartData.length > 0
                    ? data.reduce((sum, item) => sum + item.amountUSD, 0) / chartData.length
                    : 0
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
