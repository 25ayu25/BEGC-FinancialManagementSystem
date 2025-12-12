/**
 * Expense KPI Cards Component
 * 
 * Displays key performance indicators for expense analytics
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Tag, Trophy, Calendar } from "lucide-react";
import { formatSSP } from "../utils/calculations";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface ExpenseKPICardsProps {
  kpis: {
    totalExpenses: number;
    expenseChange: number;
    activeCategories: number;
    largestCategory: {
      name: string;
      total: number;
      percentage: number;
    } | null;
    avgMonthlyExpenses: number;
  };
  isLoading?: boolean;
}

export function ExpenseKPICards({ kpis, isLoading }: ExpenseKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const changeIcon = kpis.expenseChange >= 0 ? TrendingUp : TrendingDown;
  const changeColor = kpis.expenseChange >= 0 ? "text-red-600" : "text-green-600";
  const ChangeTrendIcon = changeIcon;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Expenses */}
      <Card className="relative overflow-hidden border-2 border-green-200 hover:border-green-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-600">Total Expenses</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            <AnimatedNumber value={kpis.totalExpenses} formatFn={formatSSP} />
          </div>
          <div className={`text-xs flex items-center gap-1 font-semibold ${changeColor}`}>
            <ChangeTrendIcon className="w-4 h-4" />
            <span>
              {Math.abs(kpis.expenseChange).toFixed(1)}% vs previous period
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Categories */}
      <Card className="relative overflow-hidden border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-violet-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-600">Active Categories</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Tag className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            {kpis.activeCategories}
          </div>
          <p className="text-xs text-gray-600 font-medium">
            Categories with spending
          </p>
        </CardContent>
      </Card>

      {/* Largest Category */}
      <Card className="relative overflow-hidden border-2 border-amber-200 hover:border-amber-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-yellow-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-600">Largest Category</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {kpis.largestCategory ? (
            <>
              <div className="text-xl font-bold text-gray-900 truncate mb-1">
                {kpis.largestCategory.name}
              </div>
              <div className="text-sm text-gray-700 font-semibold">
                {formatSSP(kpis.largestCategory.total)}
              </div>
              <div className="text-xs text-gray-600 font-medium mt-1">
                {kpis.largestCategory.percentage.toFixed(1)}% of total
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Average Monthly */}
      <Card className="relative overflow-hidden border-2 border-blue-200 hover:border-blue-300 transition-all hover:shadow-xl hover:-translate-y-1 group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-600">Avg Monthly Expenses</CardTitle>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-bold text-gray-900 mb-2">
            <AnimatedNumber value={kpis.avgMonthlyExpenses} formatFn={formatSSP} />
          </div>
          <p className="text-xs text-gray-600 font-medium">
            Average per month
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
