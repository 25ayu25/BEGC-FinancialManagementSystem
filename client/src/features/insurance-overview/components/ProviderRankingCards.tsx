/**
 * Provider Ranking Cards Component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Award } from "lucide-react";
import { motion } from "framer-motion";
import { formatUSD, formatPercentage, type ProviderMetrics } from "../utils/calculations";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface ProviderRankingCardsProps {
  metrics: ProviderMetrics[];
  onProviderClick: (providerId: string) => void;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: "easeOut"
    }
  })
};

export function ProviderRankingCards({ metrics, onProviderClick }: ProviderRankingCardsProps) {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return "from-yellow-400 to-yellow-600";
    if (rank === 2) return "from-gray-300 to-gray-500";
    if (rank === 3) return "from-amber-600 to-amber-800";
    return "from-violet-500 to-purple-600";
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank.toString();
  };

  const getStatusBadgeVariant = (status: ProviderMetrics['status']) => {
    switch (status) {
      case 'TOP PERFORMER':
        return 'default';
      case 'RISING STAR':
        return 'secondary';
      case 'NEEDS ATTENTION':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.slice(0, 9).map((provider, index) => (
        <motion.div
          key={provider.id}
          custom={index}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card 
            className="relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-violet-200 dark:border-violet-800"
            onClick={() => onProviderClick(provider.id)}
          >
            {/* Gradient accent based on rank */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getMedalColor(provider.rank)}`} />
            
            <CardContent className="p-6">
              {/* Header with rank and badge */}
              <div className="flex items-center justify-between mb-4">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full 
                  bg-gradient-to-r ${getMedalColor(provider.rank)} 
                  text-white font-bold text-lg shadow-lg
                `}>
                  {provider.rank <= 3 ? getMedalEmoji(provider.rank) : provider.rank}
                </div>
                
                <Badge variant={getStatusBadgeVariant(provider.status)} className="text-xs">
                  {provider.status}
                </Badge>
              </div>

              {/* Provider name */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-violet-600 transition-colors">
                {provider.name}
              </h3>

              {/* Revenue */}
              <div className="mb-3">
                <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {formatUSD(provider.revenue)}
                </p>
              </div>

              {/* Share percentage with progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Market Share
                  </span>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                    {formatPercentage(provider.share)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(provider.share, 100)}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full"
                  />
                </div>
              </div>

              {/* Growth indicator */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {provider.claimsCount} claims
                </span>
                <div className={`flex items-center gap-1 text-sm font-semibold ${
                  provider.growth >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {provider.growth >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {formatPercentage(Math.abs(provider.growth))}
                </div>
              </div>

              {/* Sparkline chart */}
              {provider.monthlyTrend.length > 0 && (
                <div className="h-12 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={provider.monthlyTrend}>
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={provider.growth >= 0 ? "#10b981" : "#ef4444"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
