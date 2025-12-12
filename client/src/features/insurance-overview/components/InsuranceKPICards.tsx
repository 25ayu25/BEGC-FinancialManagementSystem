/**
 * Insurance KPI Cards Component
 */

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Building2, Target, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { formatUSD, formatPercentage, formatCompactNumber } from "../utils/calculations";

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

export function InsuranceKPICards({ kpis }: KPICardsProps) {
  const cards = [
    {
      title: "Total Claims Value",
      value: formatUSD(kpis.totalClaimsValue),
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
      change: 0,
      icon: Building2,
      gradient: "from-indigo-500 to-purple-600",
      subtitle: "generating revenue",
    },
    {
      title: "Collection Rate",
      value: formatPercentage(kpis.collectionRate, 0),
      change: 5, // Simulated improvement
      icon: Target,
      gradient: "from-purple-500 to-pink-600",
      subtitle: "of claims collected",
    },
    {
      title: "Avg Claim Value",
      value: formatUSD(kpis.avgClaimValue),
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
      change: 0,
      icon: TrendingUp,
      gradient: "from-purple-600 to-violet-700",
      subtitle: kpis.topProviderName,
    },
    {
      title: "Period Growth",
      value: formatPercentage(kpis.growth, 1),
      change: kpis.growth,
      icon: kpis.growth >= 0 ? TrendingUp : TrendingDown,
      gradient: kpis.growth >= 0 ? "from-green-500 to-emerald-600" : "from-red-500 to-rose-600",
      subtitle: "vs previous period",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          custom={index}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-violet-200 dark:border-violet-800">
            {/* Gradient accent */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
            
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {card.title}
                </p>
                <div className={`p-2 rounded-lg bg-gradient-to-r ${card.gradient} bg-opacity-10`}>
                  <card.icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {card.value}
                </h3>
                
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {card.subtitle}
                  </p>
                  
                  {card.change !== 0 && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${
                      card.change >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {card.change >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(card.change).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
