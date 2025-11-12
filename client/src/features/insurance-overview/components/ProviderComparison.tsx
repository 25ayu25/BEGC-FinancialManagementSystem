/**
 * Provider Comparison Chart Component
 */

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Claim {
  providerId: string;
  claimedAmount: number | string;
}

interface Payment {
  providerId: string;
  amount: number | string;
}

interface Provider {
  id: string;
  name: string;
}

interface ProviderComparisonProps {
  claims: Claim[];
  payments: Payment[];
  providers: Provider[];
}

export function ProviderComparison({
  claims,
  payments,
  providers,
}: ProviderComparisonProps) {
  const [showClaims, setShowClaims] = useState(true);
  const [showPayments, setShowPayments] = useState(true);

  // Aggregate data by provider
  const chartData = providers.map(provider => {
    const providerClaims = claims.filter(c => c.providerId === provider.id);
    const providerPayments = payments.filter(p => p.providerId === provider.id);

    const totalClaimed = providerClaims.reduce(
      (sum, c) => sum + Number(c.claimedAmount),
      0
    );
    const totalPaid = providerPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    return {
      name: provider.name,
      Claims: totalClaimed,
      Payments: totalPaid,
    };
  }).filter(item => item.Claims > 0 || item.Payments > 0); // Only show providers with data

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Comparison</h3>
        <div className="text-center text-gray-500 py-8">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Provider Comparison</h3>
        <div className="flex gap-4">
          <button
            onClick={() => setShowClaims(!showClaims)}
            className={`flex items-center gap-2 text-sm ${
              showClaims ? "text-blue-600 font-medium" : "text-gray-400"
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Claims
          </button>
          <button
            onClick={() => setShowPayments(!showPayments)}
            className={`flex items-center gap-2 text-sm ${
              showPayments ? "text-green-600 font-medium" : "text-gray-400"
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Payments
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) =>
              `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            }
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
            }}
          />
          <Legend />
          {showClaims && <Bar dataKey="Claims" fill="#3b82f6" />}
          {showPayments && <Bar dataKey="Payments" fill="#10b981" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
