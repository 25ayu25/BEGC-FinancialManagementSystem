/**
 * Aging Analysis Chart Component
 */

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { calculateAgingBuckets, formatCurrency } from "../utils/calculations";

interface Claim {
  id: string;
  claimedAmount: number | string;
  status: string;
  periodStart: string;
}

interface Payment {
  claimId?: string | null;
  amount: number | string;
}

interface AgingAnalysisProps {
  claims: Claim[];
  payments: Payment[];
  onSegmentClick?: (ageRange: string) => void;
}

const COLORS = ["#10b981", "#fbbf24", "#f97316", "#ef4444"];
const AGE_RANGES = ["0-30 days", "31-60 days", "61-90 days", "91+ days"];

export function AgingAnalysis({ claims, payments, onSegmentClick }: AgingAnalysisProps) {
  const agingBuckets = calculateAgingBuckets(claims, payments);

  // Format data for pie chart
  const chartData = agingBuckets
    .map((bucket, index) => ({
      name: bucket.range,
      value: bucket.amount,
      count: bucket.count,
      color: COLORS[index],
    }))
    .filter(item => item.value > 0); // Only show non-zero buckets

  const totalOutstanding = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Analysis</h3>
        <div className="text-center text-gray-500 py-8">
          No outstanding claims
        </div>
      </div>
    );
  }

  const renderCustomLabel = (entry: any) => {
    const percentage = ((entry.value / totalOutstanding) * 100).toFixed(1);
    return `${percentage}%`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Analysis</h3>

      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              onClick={(data) => {
                if (onSegmentClick) {
                  onSegmentClick(data.name);
                }
              }}
              style={{ cursor: onSegmentClick ? "pointer" : "default" }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="text-xs text-gray-600 font-medium">Total Outstanding</div>
          <div className="text-lg font-bold text-gray-900">
            {formatCurrency(totalOutstanding)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.map((item, index) => {
          const percentage = ((item.value / totalOutstanding) * 100).toFixed(1);
          return (
            <div
              key={item.name}
              className={`flex items-start p-2 rounded ${
                onSegmentClick ? "cursor-pointer hover:bg-gray-50" : ""
              }`}
              onClick={() => onSegmentClick && onSegmentClick(item.name)}
            >
              <span
                className="w-3 h-3 rounded-full mr-2 mt-1 flex-shrink-0"
                style={{ backgroundColor: item.color }}
              ></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-600">
                  {formatCurrency(item.value)} ({item.count} claims)
                </div>
                <div className="text-xs text-gray-500">{percentage}% of total</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
