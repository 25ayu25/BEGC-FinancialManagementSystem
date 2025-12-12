/**
 * Expense Insights Component
 * 
 * Displays AI-generated insights about expense patterns
 */

import { Lightbulb, TrendingUp, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import type { ExpenseInsight } from "../utils/calculations";
import { cn } from "@/lib/utils";

interface ExpenseInsightsProps {
  insights: ExpenseInsight[];
  isLoading?: boolean;
}

const INSIGHT_ICONS = {
  concentration: Info,
  growth: TrendingUp,
  stable: CheckCircle,
  warning: AlertTriangle,
  alert: AlertCircle,
  info: Info,
  trend: TrendingUp,
};

const INSIGHT_COLORS = {
  concentration: "bg-blue-50 border-blue-200",
  growth: "bg-amber-50 border-amber-200",
  stable: "bg-green-50 border-green-200",
  warning: "bg-amber-50 border-amber-200",
  alert: "bg-red-50 border-red-200",
  info: "bg-blue-50 border-blue-200",
  trend: "bg-blue-50 border-blue-200",
};

const INSIGHT_ICON_BG_COLORS = {
  concentration: "bg-blue-100",
  growth: "bg-amber-100",
  stable: "bg-green-100",
  warning: "bg-amber-100",
  alert: "bg-red-100",
  info: "bg-blue-100",
  trend: "bg-blue-100",
};

const INSIGHT_ICON_COLORS = {
  concentration: "text-blue-600",
  growth: "text-amber-600",
  stable: "text-green-600",
  warning: "text-amber-600",
  alert: "text-red-600",
  info: "text-blue-600",
  trend: "text-blue-600",
};

const INSIGHT_TEXT_COLORS = {
  concentration: "text-blue-900",
  growth: "text-amber-900",
  stable: "text-green-900",
  warning: "text-amber-900",
  alert: "text-red-900",
  info: "text-blue-900",
  trend: "text-blue-900",
};

export function ExpenseInsights({ insights, isLoading }: ExpenseInsightsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-20 w-full bg-gray-200 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8">
        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          No insights available for the current period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => {
        const Icon = INSIGHT_ICONS[insight.type];
        const bgClass = INSIGHT_COLORS[insight.type];
        const iconBgClass = INSIGHT_ICON_BG_COLORS[insight.type];
        const iconColorClass = INSIGHT_ICON_COLORS[insight.type];
        const textColorClass = INSIGHT_TEXT_COLORS[insight.type];

        return (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 border-2",
              bgClass
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
              iconBgClass,
              iconColorClass
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <p className={cn("text-sm font-semibold leading-relaxed", textColorClass)}>
              {insight.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}
