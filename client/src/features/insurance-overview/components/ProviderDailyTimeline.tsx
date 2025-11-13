/**
 * ProviderDailyTimeline Component
 * 
 * Displays daily timeline of claims and payments by provider
 * with interactive charts and drill-down capabilities
 */

import React, { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/formatters";

interface Claim {
  id: string;
  providerId: string;
  periodStart: string;
  claimedAmount: number;
  status: string;
}

interface Payment {
  id: string;
  providerId: string;
  paymentDate?: string | null;
  createdAt?: string | null;
  amount: number;
}

interface Provider {
  id: string;
  name: string;
  code: string;
}

interface ProviderDailyTimelineProps {
  claims: Claim[];
  payments: Payment[];
  providers: Provider[];
  selectedProviderId?: string;
  onProviderSelect?: (providerId: string | undefined) => void;
}

interface TimelineDataPoint {
  date: string;
  dateLabel: string;
  claims: number;
  payments: number;
  balance: number;
}

export function ProviderDailyTimeline({
  claims,
  payments,
  providers,
  selectedProviderId,
  onProviderSelect,
}: ProviderDailyTimelineProps) {
  const [chartType, setChartType] = useState<"daily" | "cumulative">("daily");

  // Filter data by selected provider
  const filteredClaims = useMemo(() => {
    if (!selectedProviderId) return claims;
    return claims.filter(c => c.providerId === selectedProviderId);
  }, [claims, selectedProviderId]);

  const filteredPayments = useMemo(() => {
    if (!selectedProviderId) return payments;
    return payments.filter(p => p.providerId === selectedProviderId);
  }, [payments, selectedProviderId]);

  // Build timeline data
  const timelineData = useMemo(() => {
    const dataMap = new Map<string, TimelineDataPoint>();

    // Process claims
    filteredClaims.forEach(claim => {
      const dateStr = claim.periodStart.split("T")[0];
      const existing = dataMap.get(dateStr) || {
        date: dateStr,
        dateLabel: formatDate(dateStr, "short"),
        claims: 0,
        payments: 0,
        balance: 0,
      };
      existing.claims += claim.claimedAmount;
      dataMap.set(dateStr, existing);
    });

    // Process payments
    filteredPayments.forEach(payment => {
      const payDate = payment.paymentDate || payment.createdAt;
      if (!payDate) return;
      
      const dateStr = payDate.split("T")[0];
      const existing = dataMap.get(dateStr) || {
        date: dateStr,
        dateLabel: formatDate(dateStr, "short"),
        claims: 0,
        payments: 0,
        balance: 0,
      };
      existing.payments += payment.amount;
      dataMap.set(dateStr, existing);
    });

    // Convert to array and sort by date
    const data = Array.from(dataMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Calculate balance (daily or cumulative)
    if (chartType === "cumulative") {
      let cumulativeClaims = 0;
      let cumulativePayments = 0;
      
      data.forEach(point => {
        cumulativeClaims += point.claims;
        cumulativePayments += point.payments;
        point.claims = cumulativeClaims;
        point.payments = cumulativePayments;
        point.balance = cumulativeClaims - cumulativePayments;
      });
    } else {
      data.forEach(point => {
        point.balance = point.claims - point.payments;
      });
    }

    return data;
  }, [filteredClaims, filteredPayments, chartType]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalClaims = filteredClaims.reduce((sum, c) => sum + c.claimedAmount, 0);
    const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalClaims - totalPayments;
    const collectionRate = totalClaims > 0 ? (totalPayments / totalClaims) * 100 : 0;

    return {
      totalClaims,
      totalPayments,
      balance,
      collectionRate,
    };
  }, [filteredClaims, filteredPayments]);

  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providers.find(p => p.id === selectedProviderId);
  }, [selectedProviderId, providers]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Daily Timeline {selectedProvider && `- ${selectedProvider.name}`}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Chart Type Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChartType("daily")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === "daily"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartType("cumulative")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === "cumulative"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Cumulative
              </button>
            </div>

            {/* Provider Filter */}
            <select
              value={selectedProviderId || ""}
              onChange={(e) => onProviderSelect?.(e.target.value || undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Providers</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-600 mb-1">Total Claims</div>
            <div className="text-lg font-bold text-blue-900">
              {formatCurrency(metrics.totalClaims)}
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs font-medium text-green-600 mb-1">Total Payments</div>
            <div className="text-lg font-bold text-green-900">
              {formatCurrency(metrics.totalPayments)}
            </div>
          </div>
          
          <div className={`rounded-lg p-3 ${metrics.balance >= 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
            <div className={`text-xs font-medium mb-1 ${metrics.balance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
              Outstanding
            </div>
            <div className={`text-lg font-bold ${metrics.balance >= 0 ? 'text-amber-900' : 'text-red-900'}`}>
              {formatCurrency(Math.abs(metrics.balance))}
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-xs font-medium text-purple-600 mb-1">Collection Rate</div>
            <div className="text-lg font-bold text-purple-900">
              {metrics.collectionRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        {timelineData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No data available for the selected period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="dateLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="circle"
              />
              <Bar
                dataKey="claims"
                fill="#3b82f6"
                name="Claims"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="payments"
                fill="#10b981"
                name="Payments"
                radius={[4, 4, 0, 0]}
              />
              <Line
                dataKey="balance"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Balance"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
