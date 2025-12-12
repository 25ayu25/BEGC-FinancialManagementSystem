/**
 * Provider Ranking Cards Component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Award } from "lucide-react";
import { motion } from "framer-motion";
import { formatUSD, formatPercentage, getProviderColor, type ProviderMetrics } from "../utils/calculations";
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
  // Filter out providers with $0 revenue
  const activeProviders = metrics.filter(m => m.revenue > 0);

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
      {activeProviders.slice(0, 9).map((provider, index) => {
        const providerColor = getProviderColor(provider.name, index);
        
        return (
          <motion.div
            key={provider.id}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card 
              className="relative overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90"
              onClick={() => onProviderClick(provider.id)}
            >
              {/* Glassmorphism overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent dark:from-gray-800/60 dark:to-transparent pointer-events-none" />
              
              {/* Gradient accent based on provider color with enhanced glow */}
              <div 
                className="absolute top-0 left-0 right-0 h-2"
                style={{ background: providerColor }}
              >
                <div 
                  className="absolute inset-0 blur-md opacity-50"
                  style={{ background: providerColor }}
                />
              </div>
              
              <CardContent className="p-6 relative z-10">
                {/* Header with enhanced rank badge and status */}
                <div className="flex items-center justify-between mb-4">
                  <motion.div 
                    className={`
                      flex items-center justify-center w-12 h-12 rounded-full 
                      bg-gradient-to-br ${getMedalColor(provider.rank)} 
                      text-white font-bold text-xl shadow-2xl
                      ${provider.rank <= 3 ? 'ring-4 ring-white/30 dark:ring-gray-900/30' : ''}
                    `}
                    whileHover={{ scale: 1.15, rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    {provider.rank <= 3 ? getMedalEmoji(provider.rank) : provider.rank}
                  </motion.div>
                  
                  <Badge 
                    variant={getStatusBadgeVariant(provider.status)} 
                    className="text-xs font-semibold px-3 py-1 shadow-md"
                  >
                    {provider.status}
                  </Badge>
                </div>

                {/* Provider logo placeholder with provider color */}
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${providerColor}, ${providerColor}dd)` }}
                  >
                    {provider.name.charAt(0)}
                  </div>
                  {/* Provider name */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-violet-600 transition-colors flex-1">
                    {provider.name}
                  </h3>
                </div>

                {/* Revenue */}
                <div className="mb-3">
                  <p 
                    className="text-3xl font-bold"
                    style={{ 
                      background: `linear-gradient(135deg, ${providerColor}, ${providerColor}dd)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {formatUSD(provider.revenue)}
                  </p>
                </div>

                {/* Share percentage with enhanced animated progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Market Share
                    </span>
                    <span 
                      className="text-xs font-bold"
                      style={{ color: providerColor }}
                    >
                      {formatPercentage(provider.share)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(provider.share, 100)}%` }}
                      transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                      className="h-full rounded-full relative"
                      style={{ background: providerColor }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent" />
                    </motion.div>
                  </div>
                </div>

                {/* Growth indicator */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {provider.claimsCount} claims
                  </span>
                  <motion.div 
                    className={`flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full ${
                      provider.growth >= 0 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {provider.growth >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {formatPercentage(Math.abs(provider.growth))}
                  </motion.div>
                </div>

                {/* Enhanced Sparkline chart with gradient */}
                {provider.monthlyTrend.length > 0 && (
                  <div className="h-14 mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={provider.monthlyTrend}>
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke={provider.growth >= 0 ? "#10b981" : "#ef4444"}
                          strokeWidth={3}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>

              {/* Hover glow effect with provider color */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"
                style={{ background: providerColor }}
              />
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
