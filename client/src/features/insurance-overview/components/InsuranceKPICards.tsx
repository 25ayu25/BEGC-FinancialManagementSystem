/**
 * Insurance KPI Cards Component
 */

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Building2, Target, BarChart3 } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { formatUSD, formatPercentage, formatCompactNumber } from "../utils/calculations";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface KPICardsProps {
  kpis: {
    totalClaimsValue: number;
    activeProviders: number;
    collectionRate: number;
    avgClaimValue: number;
    topProviderRevenue: number;
    topProviderName: string;
    growth: number;
    totalClaims: number;
    prevTotalClaimsValue: number;
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

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

// Generate mini sparkline data
function generateSparklineData(value: number, change: number) {
  const points = 8;
  const data = [];
  const avgValue = value / (1 + change / 100);
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const randomVariation = (Math.random() - 0.5) * 0.1;
    const trendValue = avgValue * (1 + (change / 100) * progress + randomVariation);
    data.push({ value: Math.max(0, trendValue) });
  }
  
  return data;
}

export function InsuranceKPICards({ kpis }: KPICardsProps) {
  const cards = [
    {
      title: "Total Claims Value",
      value: formatUSD(kpis.totalClaimsValue),
      rawValue: kpis.totalClaimsValue,
      change: kpis.prevTotalClaimsValue > 0 
        ? ((kpis.totalClaimsValue - kpis.prevTotalClaimsValue) / kpis.prevTotalClaimsValue * 100)
        : 0,
      icon: DollarSign,
      gradient: "from-violet-500 to-purple-600",
      subtitle: `${kpis.totalClaims} claims`,
    },
    {
      title: "Active Providers",
      value: kpis.activeProviders.toString(),
      rawValue: kpis.activeProviders,
      change: 0,
      icon: Building2,
      gradient: "from-indigo-500 to-purple-600",
      subtitle: "generating revenue",
    },
    {
      title: "Collection Rate",
      value: formatPercentage(kpis.collectionRate, 0),
      rawValue: kpis.collectionRate,
      change: 5, // Simulated improvement
      icon: Target,
      gradient: "from-purple-500 to-pink-600",
      subtitle: "of claims collected",
    },
    {
      title: "Avg Claim Value",
      value: formatUSD(kpis.avgClaimValue),
      rawValue: kpis.avgClaimValue,
      change: kpis.prevTotalClaimsValue > 0 && kpis.totalClaims > 0
        ? ((kpis.avgClaimValue - (kpis.prevTotalClaimsValue / kpis.totalClaims)) / (kpis.prevTotalClaimsValue / kpis.totalClaims) * 100)
        : 0,
      icon: BarChart3,
      gradient: "from-violet-600 to-indigo-600",
      subtitle: "per claim",
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <KPICard key={card.title} card={card} index={index} />
      ))}
    </div>
  );
}

function KPICard({ card, index }: { card: any; index: number }) {
  const sparklineData = generateSparklineData(card.rawValue, card.change);

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      <Card className="relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
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

            {/* Mini Sparkline */}
            {card.change !== 0 && (
              <div className="h-8 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke={card.change >= 0 ? "#10b981" : "#ef4444"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
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
