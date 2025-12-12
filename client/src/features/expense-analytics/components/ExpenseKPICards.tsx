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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Expenses */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-500" />
            Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            <AnimatedNumber value={kpis.totalExpenses} formatFn={formatSSP} />
          </div>
          <div className={`text-xs flex items-center gap-1 mt-1 ${changeColor}`}>
            <ChangeTrendIcon className="w-3 h-3" />
            <span>
              {Math.abs(kpis.expenseChange).toFixed(1)}% vs previous period
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Categories */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-500" />
            Active Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {kpis.activeCategories}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Categories with spending
          </p>
        </CardContent>
      </Card>

      {/* Largest Category */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Largest Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kpis.largestCategory ? (
            <>
              <div className="text-lg font-bold text-gray-900 truncate">
                {kpis.largestCategory.name}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {formatSSP(kpis.largestCategory.total)}
                <span className="text-xs text-gray-500 ml-1">
                  ({kpis.largestCategory.percentage.toFixed(1)}%)
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Average Monthly */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            Avg Monthly Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            <AnimatedNumber value={kpis.avgMonthlyExpenses} formatFn={formatSSP} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Average per month
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
