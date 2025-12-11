/**
 * Department Deep Dive Component
 * 
 * Detailed view of a single department's performance
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentMetrics } from "../utils/calculations";
import { formatSSP } from "../utils/calculations";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface DepartmentDeepDiveProps {
  department: DepartmentMetrics | null;
  onClose: () => void;
}

export function DepartmentDeepDive({ department, onClose }: DepartmentDeepDiveProps) {
  if (!department) return null;

  const chartData = department.monthlyData.map(d => ({
    month: format(new Date(d.month), 'MMM yyyy'),
    revenue: d.revenue,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        <p className="text-sm text-gray-700">
          Revenue: <span className="font-semibold tabular-nums">SSP {formatSSP(payload[0].value)}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {department.name} - Deep Dive
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg">
              <div className="text-sm text-teal-700 font-medium mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-teal-900 tabular-nums">
                SSP {formatSSP(department.revenue)}
              </div>
              <div className="text-xs text-teal-600 mt-1">
                {department.share.toFixed(1)}% of total
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-sm text-blue-700 font-medium mb-1">Avg per Month</div>
              <div className="text-2xl font-bold text-blue-900 tabular-nums">
                SSP {formatSSP(department.avgPerMonth)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Based on {department.monthlyData.length} months
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-lg",
              department.growth >= 0 
                ? "bg-gradient-to-br from-green-50 to-green-100"
                : "bg-gradient-to-br from-red-50 to-red-100"
            )}>
              <div className={cn(
                "text-sm font-medium mb-1",
                department.growth >= 0 ? "text-green-700" : "text-red-700"
              )}>
                Growth Rate
              </div>
              <div className={cn(
                "text-2xl font-bold tabular-nums flex items-center gap-2",
                department.growth >= 0 ? "text-green-900" : "text-red-900"
              )}>
                {department.growth >= 0 ? (
                  <TrendingUp className="w-6 h-6" />
                ) : (
                  <TrendingDown className="w-6 h-6" />
                )}
                {department.growth > 0 ? '+' : ''}{department.growth.toFixed(1)}%
              </div>
              <div className={cn(
                "text-xs mt-1",
                department.growth >= 0 ? "text-green-600" : "text-red-600"
              )}>
                vs previous period
              </div>
            </div>
          </div>

          {/* 12-Month Trend Chart */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">12-Month Revenue Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    stroke="#94a3b8"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="#94a3b8"
                    tickFormatter={(value) => formatSSP(value, true)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={department.color}
                    strokeWidth={3}
                    dot={{ r: 5, fill: department.color }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Month-by-Month Breakdown */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Month-by-Month Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Month</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Revenue (SSP)</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {department.monthlyData.map((month, idx) => {
                    const isHighlight = department.bestMonth?.month === month.month;
                    return (
                      <tr 
                        key={idx} 
                        className={cn(
                          "border-b border-gray-100",
                          isHighlight && "bg-yellow-50"
                        )}
                      >
                        <td className="py-2 px-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {format(new Date(month.month), 'MMM yyyy')}
                            {isHighlight && (
                              <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded font-semibold">
                                BEST
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-semibold text-gray-900 tabular-nums">
                          {formatSSP(month.revenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-sm text-gray-700 tabular-nums">
                          {department.revenue > 0 
                            ? ((month.revenue / department.revenue) * 100).toFixed(1) 
                            : '0.0'}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
