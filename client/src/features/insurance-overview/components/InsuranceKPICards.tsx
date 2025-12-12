/**
 * Insurance KPI Cards Component
 */

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatUSD, formatPercentage, formatCompactNumber } from "../utils/calculations";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

interface KPICardsProps {
  kpis: {
    totalClaimsValue: number;
    activeProviders: number;
    topProviderRevenue: number;
    topProviderName: string;
    growth: number;
    totalClaims: number;
    prevTotalClaimsValue: number;
    monthlyTotals?: Array<{ month: string; total: number }>;
  };
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut"
    }
  })
};

export function InsuranceKPICards({ kpis }: KPICardsProps) {
  // Use real monthly data for sparklines
  const sparklineData = useMemo(() => {
    if (!kpis.monthlyTotals || kpis.monthlyTotals.length === 0) {
      // Fallback: generate smooth curve if no data
      return Array.from({ length: 12 }, (_, i) => {
        const base = 100;
        const wave = Math.sin(i * 0.5) * 30;
        const trend = i * 5;
        return { value: base + wave + trend, month: '', index: i };
      });
    }
    
    // Use real monthly USD revenue totals
    return kpis.monthlyTotals.map((m, i) => ({ 
      value: m.total, 
      month: m.month,
      index: i 
    }));
  }, [kpis.monthlyTotals]);

  const cards = [
    {
      title: "Total Claims Value",
      value: formatUSD(kpis.totalClaimsValue),
      rawValue: kpis.totalClaimsValue,
      change: kpis.prevTotalClaimsValue > 0 
        ? ((kpis.totalClaimsValue - kpis.prevTotalClaimsValue) / kpis.prevTotalClaimsValue * 100)
        : 0,
      icon: DollarSign,
      gradient: "from-emerald-500 to-green-600",
      subtitle: `${kpis.totalClaims} claims`,
    },
    {
      title: "Active Providers",
      value: kpis.activeProviders.toString(),
      rawValue: kpis.activeProviders,
      change: 0,
      icon: Building2,
      gradient: "from-indigo-500 to-blue-600",
      subtitle: "generating revenue",
    },
    {
      title: "Top Provider Revenue",
      value: formatCompactNumber(kpis.topProviderRevenue),
      rawValue: kpis.topProviderRevenue,
      change: 0,
      icon: TrendingUp,
      gradient: "from-purple-600 to-violet-700",
      subtitle: kpis.topProviderName,
    },
    {
      title: "Period Growth",
      value: formatPercentage(kpis.growth, 1),
      rawValue: kpis.growth,
      change: kpis.growth,
      icon: kpis.growth >= 0 ? TrendingUp : TrendingDown,
      gradient: kpis.growth >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600",
      subtitle: "vs previous period",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <KPICard key={card.title} card={card} index={index} sparklineData={sparklineData} />
      ))}
    </div>
  );
}

function KPICard({ card, index, sparklineData }: { card: any; index: number; sparklineData: Array<{ value: number; month: string; index: number }> }) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      <Card className="relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
        {/* Animated gradient border on hover - using pseudo-element for gradient border effect */}
        <div className={`absolute inset-0 rounded-lg bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-0.5`}>
          <div className="absolute inset-0.5 rounded-lg bg-white dark:bg-gray-900" />
        </div>
        
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-gray-800/50 dark:to-transparent pointer-events-none" />
        
        {/* Gradient accent with glow effect */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient} group-hover:h-1.5 transition-all duration-300`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} blur-sm opacity-50`} />
        </div>
        
        <CardContent className="p-4 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {card.title}
            </p>
            <motion.div 
              className={`p-2 rounded-lg bg-gradient-to-r ${card.gradient} shadow-lg`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <card.icon className="w-4 h-4 text-white" />
            </motion.div>
          </div>
          
          <div className="space-y-2">
            <motion.h3 
              className="text-2xl font-bold text-gray-900 dark:text-white"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
            >
              {card.value}
            </motion.h3>
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {card.subtitle}
              </p>
              
              {card.change !== 0 && (
                <motion.div 
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    card.change >= 0 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.5 }}
                >
                  {card.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(card.change).toFixed(1)}%
                </motion.div>
              )}
            </div>

            {/* Mini Sparkline with real data - show for Total Claims and Period Growth */}
            {(index === 0 || index === 3) && sparklineData.length > 0 && (
              <div className="h-12 mt-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id={`sparklineGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.change >= 0 ? "#10B981" : "#ef4444"} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={card.change >= 0 ? "#10B981" : "#ef4444"} stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <defs>
                      <filter id={`glow-${index}`}>
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Tooltip for hover */}
                    <Tooltip 
                      content={({ payload }) => {
                        if (!payload || !payload[0]) return null;
                        const dataPoint = payload[0].payload;
                        return (
                          <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
                            <p className="text-xs text-gray-600">{dataPoint.month || `Month ${dataPoint.index + 1}`}</p>
                            <p className="text-sm font-bold text-gray-900">
                              ${Math.round(dataPoint.value).toLocaleString()}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={card.change >= 0 ? "#10B981" : "#ef4444"}
                      strokeWidth={3}
                      fill={`url(#sparklineGradient-${index})`}
                      dot={false}
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>

        {/* Hover glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none`} />
      </Card>
    </motion.div>
  );
}
