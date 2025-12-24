/**
 * Provider Deep Dive Modal Component
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { TrendingUp, TrendingDown, Award, BarChart3 } from "lucide-react";
import { formatUSD, formatPercentage, type ProviderMetrics } from "../utils/calculations";

interface ProviderDeepDiveModalProps {
  provider: ProviderMetrics | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProviderDeepDiveModal({ provider, isOpen, onClose }: ProviderDeepDiveModalProps) {
  if (!provider) return null;

  const bestMonth = provider.bestMonth;
  const worstMonth = provider.monthlyTrend.reduce((min, curr) => 
    curr.revenue < min.revenue ? curr : min
  , provider.monthlyTrend[0] || { month: 'N/A', revenue: 0 });

  const avgMonthlyRevenue = provider.monthlyTrend.length > 0
    ? provider.monthlyTrend.reduce((sum, m) => sum + m.revenue, 0) / provider.monthlyTrend.length
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] bg-white dark:bg-gray-900 shadow-2xl border-2 border-violet-200 dark:border-violet-800 overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {provider.name} - Deep Dive Analysis
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 dark:text-gray-400">
            Comprehensive performance metrics and 12-month trends
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(95vh-120px)] space-y-6 py-4">
          {/* Key Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Rank</p>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-violet-600" />
                  <p className="text-2xl font-bold">#{provider.rank}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-violet-600">
                  {formatUSD(provider.revenue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Market Share</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatPercentage(provider.share)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Growth</p>
                <div className={`flex items-center gap-1 text-xl font-bold ${
                  provider.growth >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {provider.growth >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {formatPercentage(Math.abs(provider.growth))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Provider Status Badge */}
          <div className="flex items-center justify-center p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
            <Badge className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white px-6 py-2 text-base font-semibold shadow-lg">
              {provider.status}
            </Badge>
          </div>

          {/* Revenue Trend Chart */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-600" />
                12-Month Revenue Trend
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={provider.monthlyTrend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6b7280" 
                      tickFormatter={(value) => {
                        try {
                          const parts = value.split('-');
                          if (parts.length >= 2) {
                            const monthNum = parseInt(parts[1], 10);
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            if (monthNum >= 1 && monthNum <= 12) {
                              return monthNames[monthNum - 1];
                            }
                          }
                          return value;
                        } catch {
                          return value;
                        }
                      }}
                    />
                    <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip 
                      formatter={(value: any) => formatUSD(value)}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Month-by-Month Breakdown */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Month-by-Month Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {provider.monthlyTrend.map((month) => {
                  // Format month from "2025-01" to "Jan"
                  let displayMonth = month.month;
                  try {
                    const parts = month.month.split('-');
                    if (parts.length >= 2) {
                      const monthNum = parseInt(parts[1], 10);
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      if (monthNum >= 1 && monthNum <= 12) {
                        displayMonth = monthNames[monthNum - 1];
                      }
                    }
                  } catch {
                    // Keep original format if parsing fails
                  }
                  
                  return (
                    <div 
                      key={month.month}
                      className="p-3 border rounded-lg hover:border-violet-400 transition-colors"
                    >
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{displayMonth}</p>
                      <p className="text-sm font-bold">{formatUSD(month.revenue)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Performance Highlights */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Highlights</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Best Month</p>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {bestMonth ? bestMonth.month : 'N/A'}
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    {bestMonth ? formatUSD(bestMonth.revenue) : 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Weakest Month</p>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {worstMonth.month}
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    {formatUSD(worstMonth.revenue)}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Monthly Average</p>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {provider.monthlyTrend.length} months
                  </p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatUSD(avgMonthlyRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
