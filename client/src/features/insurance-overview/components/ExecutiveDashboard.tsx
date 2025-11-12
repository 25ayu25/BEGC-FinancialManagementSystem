/**
 * Executive Dashboard Component with KPIs
 */

import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle } from "lucide-react";
import {
  calculateCollectionRate,
  calculateAverageDaysToPayment,
  calculateAgingBuckets,
  calculateTrendPercentage,
  formatCurrency,
  formatPercentage,
} from "../utils/calculations";

interface Claim {
  id: string;
  providerId: string;
  periodStart: string;
  claimedAmount: number | string;
  status: string;
}

interface Payment {
  id: string;
  providerId: string;
  claimId?: string | null;
  paymentDate?: string | null;
  amount: number | string;
  createdAt?: string | null;
}

interface ExecutiveDashboardProps {
  claims: Claim[];
  payments: Payment[];
  loading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

function KPICard({ title, value, icon, trend, subtitle }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center">
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
          )}
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
}

export function ExecutiveDashboard({ claims, payments, loading }: ExecutiveDashboardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate metrics
  const totalBilled = claims.reduce((sum, c) => sum + Number(c.claimedAmount), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = totalBilled - totalCollected;
  const collectionRate = calculateCollectionRate(totalBilled, totalCollected);
  const avgDaysToPayment = calculateAverageDaysToPayment(claims, payments);
  const agingBuckets = calculateAgingBuckets(claims, payments);

  return (
    <div className="mb-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          title="Total Billed"
          value={formatCurrency(totalBilled)}
          icon={<DollarSign className="w-6 h-6 text-blue-600" />}
        />
        <KPICard
          title="Total Collected"
          value={formatCurrency(totalCollected)}
          icon={<DollarSign className="w-6 h-6 text-green-600" />}
        />
        <KPICard
          title="Outstanding"
          value={formatCurrency(outstanding)}
          icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
        />
        <KPICard
          title="Collection Rate"
          value={formatPercentage(collectionRate)}
          icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
          subtitle={`${formatCurrency(totalCollected)} of ${formatCurrency(totalBilled)}`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <KPICard
          title="Avg Days to Payment"
          value={`${avgDaysToPayment} days`}
          icon={<Clock className="w-6 h-6 text-indigo-600" />}
          subtitle="Average time from claim to payment"
        />
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Outstanding Aging</h3>
          <div className="space-y-3">
            {agingBuckets.map((bucket, index) => {
              const colors = [
                "bg-green-500",
                "bg-yellow-500",
                "bg-orange-500",
                "bg-red-500",
              ];
              const percentage =
                totalBilled > 0 ? (bucket.amount / totalBilled) * 100 : 0;

              return (
                <div key={bucket.range}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{bucket.range}</span>
                    <span className="text-gray-900 font-semibold">
                      {formatCurrency(bucket.amount)} ({bucket.count})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${colors[index]} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
