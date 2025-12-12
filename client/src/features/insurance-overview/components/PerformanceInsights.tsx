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
    <Card className="relative overflow-hidden border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-lg">
      {/* Premium gradient border effect */}
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 via-purple-500 to-pink-500" />
      
      <CardHeader className="relative z-10">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Lightbulb className="w-6 h-6 text-violet-600" />
          </motion.div>
          AI Performance Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 relative z-10">
        {insights.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Alert className={`${getBgColor('info')} shadow-md`}>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Info className="w-12 h-12 text-blue-500 mb-4" />
                </motion.div>
                <AlertDescription className="text-base">
                  <strong className="block mb-2">No insights available yet</strong>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Add more transaction data with insurance providers to generate AI-powered insights
                  </span>
                </AlertDescription>
              </div>
            </Alert>
          </motion.div>
        ) : (
          insights.map((insight, index) => (
            <motion.div
              key={index}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={insightVariants}
              whileHover={{ scale: 1.02, x: 5, transition: { duration: 0.2 } }}
            >
              <Alert className={`${getBgColor(insight.type)} shadow-md hover:shadow-lg transition-all border-l-4`}>
                <div className="flex items-start gap-3">
                  <motion.div 
                    className="mt-0.5"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  >
                    {getIcon(insight.type)}
                  </motion.div>
                  <AlertDescription className="flex-1 text-sm leading-relaxed">
                    <motion.span 
                      className="text-2xl mr-2 inline-block"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, delay: index * 0.3 }}
                    >
                      {insight.icon}
                    </motion.span>
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
