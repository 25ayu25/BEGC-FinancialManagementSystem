/**
 * Category Deep Dive Modal Component
 * 
 * Detailed view for a specific expense category
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity, Trophy } from "lucide-react";
import { formatSSP, formatMonthSafely } from "../utils/calculations";
import type { CategoryMetrics } from "../utils/calculations";
import { cn } from "@/lib/utils";
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
      <DialogOverlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-2 border-red-200">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
            {category.name} - Deep Dive
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* KPI Row with Colorful Gradients */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total Spend - Blue Gradient */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  Total Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">
                  {formatSSP(category.total)}
                </div>
                <p className="text-xs text-blue-700 font-medium mt-1">
                  {category.percentage.toFixed(1)}% of total expenses
                </p>
              </CardContent>
            </Card>

            {/* Growth Rate - Green/Red Gradient based on value */}
            <Card className={cn(
              "border-2",
              category.growth >= 0 
                ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-100"
                : "border-green-200 bg-gradient-to-br from-green-50 to-emerald-100"
            )}>
              <CardHeader className="pb-2">
                <CardTitle className={cn(
                  "text-sm font-semibold flex items-center gap-2",
                  category.growth >= 0 ? "text-red-700" : "text-green-700"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    category.growth >= 0 
                      ? "bg-gradient-to-br from-red-500 to-rose-600"
                      : "bg-gradient-to-br from-green-500 to-emerald-600"
                  )}>
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  Growth Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold flex items-center gap-2",
                  category.growth >= 0 ? "text-red-900" : "text-green-900"
                )}>
                  <GrowthIcon className="w-6 h-6" />
                  {Math.abs(category.growth).toFixed(1)}%
                </div>
                <p className={cn(
                  "text-xs font-medium mt-1",
                  category.growth >= 0 ? "text-red-700" : "text-green-700"
                )}>
                  vs previous period
                </p>
              </CardContent>
            </Card>

            {/* Peak Month - Orange/Amber Gradient */}
            <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                  Peak Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                {category.bestMonth ? (
                  <>
                    <div className="text-xl font-bold text-amber-900">
                      {formatSSP(category.bestMonth.amount)}
                    </div>
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      {category.bestMonth.month}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-700">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insight */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900 font-semibold leading-relaxed">
                <strong>💡 Insight:</strong> {generateInsight()}
              </p>
            </CardContent>
          </Card>

          {/* Trend Chart */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50">
              <CardTitle className="text-lg text-gray-900">Spending Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
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
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px 12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Table */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50">
              <CardTitle className="text-lg text-gray-900">Month-by-Month Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-200">
                    <tr className="text-left">
                      <th className="py-3 px-4 font-bold text-gray-900">Month</th>
                      <th className="py-3 px-4 font-bold text-gray-900 text-right">Amount</th>
                      <th className="py-3 px-4 font-bold text-gray-900 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyChanges.map((month, index) => (
                      <tr 
                        key={month.month} 
                        className={cn(
                          "border-b border-gray-200 hover:bg-gray-50 transition-colors",
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        )}
                      >
                        <td className="py-3 px-4 text-gray-900 font-medium">{formatXAxis(month.month)}</td>
                        <td className="py-3 px-4 text-right text-gray-900 font-bold tabular-nums">
                          {formatSSP(month.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums">
                          {index === 0 ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-bold",
                              month.change >= 0 
                                ? "bg-red-100 text-red-700" 
                                : "bg-green-100 text-green-700"
                            )}>
                              {month.change >= 0 ? '↑' : '↓'} {Math.abs(month.change).toFixed(1)}%
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
