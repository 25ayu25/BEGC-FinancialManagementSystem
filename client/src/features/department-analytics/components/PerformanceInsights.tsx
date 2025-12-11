/**
 * Performance Insights Component
 * 
 * Auto-generated insights about department performance
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  type: 'info' | 'warning' | 'success';
  icon: string;
  message: string;
}

interface PerformanceInsightsProps {
  insights: Insight[];
}

export function PerformanceInsights({ insights }: PerformanceInsightsProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No insights available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const getInsightStyles = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          text: 'text-amber-900',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
        };
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          text: 'text-green-900',
          icon: <TrendingUp className="w-5 h-5 text-green-600" />,
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-900',
          icon: <Lightbulb className="w-5 h-5 text-blue-600" />,
        };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Performance Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, idx) => {
            const styles = getInsightStyles(insight.type);
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                  styles.bg
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {styles.icon}
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", styles.text)}>
                    {insight.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
