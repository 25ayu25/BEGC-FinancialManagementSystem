/**
 * Performance Insights Component
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { type InsuranceInsight } from "../utils/calculations";
import { Lightbulb, TrendingUp, AlertTriangle, Info } from "lucide-react";

interface PerformanceInsightsProps {
  insights: InsuranceInsight[];
}

const insightVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  })
};

export function PerformanceInsights({ insights }: PerformanceInsightsProps) {
  const getIcon = (type: InsuranceInsight['type']) => {
    switch (type) {
      case 'success':
        return <Lightbulb className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
    }
  };

  const getVariant = (type: InsuranceInsight['type']) => {
    switch (type) {
      case 'warning':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getBgColor = (type: InsuranceInsight['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800';
    }
  };

  return (
    <Card className="border-violet-200 dark:border-violet-800">
      <CardHeader>
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-violet-600" />
          AI Performance Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 ? (
          <Alert className={getBgColor('info')}>
            <Info className="w-5 h-5" />
            <AlertDescription>
              No insights available yet. Add more data to generate insights.
            </AlertDescription>
          </Alert>
        ) : (
          insights.map((insight, index) => (
            <motion.div
              key={index}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={insightVariants}
            >
              <Alert className={getBgColor(insight.type)}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getIcon(insight.type)}
                  </div>
                  <AlertDescription className="flex-1 text-sm leading-relaxed">
                    <span className="text-2xl mr-2">{insight.icon}</span>
                    {insight.message}
                  </AlertDescription>
                </div>
              </Alert>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
