/**
 * Expense Insights Component
 * 
 * Displays AI-generated insights about expense patterns
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import type { ExpenseInsight } from "../utils/calculations";
import { cn } from "@/lib/utils";

interface ExpenseInsightsProps {
  insights: ExpenseInsight[];
  isLoading?: boolean;
}

const INSIGHT_ICONS = {
  concentration: AlertCircle,
  growth: TrendingUp,
  stable: CheckCircle,
  warning: AlertCircle,
};

const INSIGHT_COLORS = {
  concentration: "bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-200",
  growth: "bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200",
  stable: "bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200",
  warning: "bg-gradient-to-br from-orange-50 to-amber-100 border-2 border-orange-200",
};

const INSIGHT_ICON_COLORS = {
  concentration: "text-amber-600",
  growth: "text-red-600",
  stable: "text-green-600",
  warning: "text-orange-600",
};

const INSIGHT_TEXT_COLORS = {
  concentration: "text-amber-900",
  growth: "text-red-900",
  stable: "text-green-900",
  warning: "text-orange-900",
};

export function ExpenseInsights({ insights, isLoading }: ExpenseInsightsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No insights available for the current period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 border-gray-100">
      <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <span>Key Insights</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = INSIGHT_ICONS[insight.type];
            const bgClass = INSIGHT_COLORS[insight.type];
            const iconColorClass = INSIGHT_ICON_COLORS[insight.type];
            const textColorClass = INSIGHT_TEXT_COLORS[insight.type];

            return (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5",
                  bgClass
                )}
              >
                <div className={cn("w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm", iconColorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className={cn("text-sm font-semibold leading-relaxed", textColorClass)}>
                  {insight.message}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
