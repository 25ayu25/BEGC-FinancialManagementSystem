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
  concentration: "text-amber-600 bg-amber-50",
  growth: "text-red-600 bg-red-50",
  stable: "text-green-600 bg-green-50",
  warning: "text-orange-600 bg-orange-50",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Key Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = INSIGHT_ICONS[insight.type];
            const colorClass = INSIGHT_COLORS[insight.type];

            return (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg",
                  colorClass
                )}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
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
