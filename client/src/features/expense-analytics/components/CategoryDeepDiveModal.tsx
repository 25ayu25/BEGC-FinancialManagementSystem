/**
 * Category Deep Dive Modal Component
 * 
 * Detailed view for a specific expense category
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity, Trophy } from "lucide-react";
import { formatSSP, formatMonthSafely } from "../utils/calculations";
import type { CategoryMetrics } from "../utils/calculations";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";

interface CategoryDeepDiveModalProps {
  category: CategoryMetrics | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryDeepDiveModal({ 
  category, 
  isOpen, 
  onClose 
}: CategoryDeepDiveModalProps) {
  if (!category) return null;

  const growthIcon = category.growth >= 0 ? TrendingUp : TrendingDown;
  const growthColor = category.growth >= 0 ? "text-red-600" : "text-green-600";
  const GrowthIcon = growthIcon;

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

  // Generate simple insight
  const generateInsight = () => {
    if (Math.abs(category.growth) > 20) {
      return category.growth > 0
        ? `This category has grown significantly (${category.growth.toFixed(1)}%) compared to the previous period, indicating increased spending.`
        : `This category has decreased significantly (${Math.abs(category.growth).toFixed(1)}%) compared to the previous period, showing cost reduction.`;
    }
    if (Math.abs(category.growth) < 5) {
      return "Spending in this category is relatively stable, with minimal variation from the previous period.";
    }
    return category.growth > 0
      ? `This category shows moderate growth of ${category.growth.toFixed(1)}% compared to the previous period.`
      : `This category shows moderate decline of ${Math.abs(category.growth).toFixed(1)}% compared to the previous period.`;
  };

  // Calculate month-over-month changes
  const monthlyChanges = category.monthlyData.map((month, index) => {
    if (index === 0) return { ...month, change: 0 };
    const prevAmount = category.monthlyData[index - 1].amount;
    const change = prevAmount > 0 ? ((month.amount - prevAmount) / prevAmount) * 100 : 0;
    return { ...month, change };
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {category.name}
          </DialogTitle>
        </DialogHeader>

        {/* KPI Row */}
        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-500" />
                Total Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatSSP(category.total)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {category.percentage.toFixed(1)}% of total expenses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                Growth Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-2 ${growthColor}`}>
                <GrowthIcon className="w-6 h-6" />
                {Math.abs(category.growth).toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                vs previous period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Peak Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              {category.bestMonth ? (
                <>
                  <div className="text-xl font-bold text-gray-900">
                    {formatSSP(category.bestMonth.amount)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {category.bestMonth.month}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">No data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insight */}
        <Card className="mt-4 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong>Insight:</strong> {generateInsight()}
            </p>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={category.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatXAxis}
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  tickFormatter={(value) => {
                    const abs = Math.abs(value);
                    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
                    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
                    return value.toFixed(0);
                  }}
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  formatter={(value: number) => [`SSP ${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#14b8a6"
                  strokeWidth={3}
                  dot={{ fill: '#14b8a6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Table */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Month-by-Month Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2 font-semibold text-gray-700">Month</th>
                    <th className="pb-2 font-semibold text-gray-700 text-right">Amount</th>
                    <th className="pb-2 font-semibold text-gray-700 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyChanges.map((month, index) => (
                    <tr key={month.month} className="border-b last:border-0">
                      <td className="py-2 text-gray-900">{formatXAxis(month.month)}</td>
                      <td className="py-2 text-right text-gray-900 font-medium">
                        {formatSSP(month.amount)}
                      </td>
                      <td className="py-2 text-right">
                        {index === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <span className={month.change >= 0 ? "text-red-600" : "text-green-600"}>
                            {month.change >= 0 ? '+' : ''}{month.change.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
