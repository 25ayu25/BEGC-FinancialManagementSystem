/**
 * Payment Timeline Chart Component
 */

import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface Claim {
  periodStart: string;
  claimedAmount: number | string;
}

interface Payment {
  paymentDate?: string | null;
  createdAt?: string | null;
  amount: number | string;
}

interface PaymentTimelineProps {
  claims: Claim[];
  payments: Payment[];
}

export function PaymentTimeline({ claims, payments }: PaymentTimelineProps) {
  const [chartType, setChartType] = useState<"line" | "area">("line");

  // Prepare timeline data
  const chartData = useMemo(() => {
    const dataMap = new Map<string, { date: string; claims: number; payments: number }>();

    // Process claims
    claims.forEach(claim => {
      const dateKey = claim.periodStart.split("T")[0];
      const existing = dataMap.get(dateKey) || { date: dateKey, claims: 0, payments: 0 };
      existing.claims += Number(claim.claimedAmount);
      dataMap.set(dateKey, existing);
    });

    // Process payments
    payments.forEach(payment => {
      const dateStr = payment.paymentDate || payment.createdAt;
      if (!dateStr) return;
      
      const dateKey = dateStr.split("T")[0];
      const existing = dataMap.get(dateKey) || { date: dateKey, claims: 0, payments: 0 };
      existing.payments += Number(payment.amount);
      dataMap.set(dateKey, existing);
    });

    // Sort by date and format
    return Array.from(dataMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        formattedDate: format(new Date(item.date), "MMM dd"),
      }));
  }, [claims, payments]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Timeline</h3>
        <div className="text-center text-gray-500 py-8">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === "line" ? LineChart : AreaChart;
  const DataComponent = chartType === "line" ? Line : Area;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Payment Timeline</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType("line")}
            className={`px-3 py-1 text-sm rounded ${
              chartType === "line"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1 text-sm rounded ${
              chartType === "area"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Area
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) =>
              `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            }
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
            }}
          />
          <Legend />
          <DataComponent
            type="monotone"
            dataKey="claims"
            name="Claims Submitted"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={chartType === "area" ? 0.3 : 1}
            strokeWidth={2}
          />
          <DataComponent
            type="monotone"
            dataKey="payments"
            name="Payments Received"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={chartType === "area" ? 0.3 : 1}
            strokeWidth={2}
          />
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
