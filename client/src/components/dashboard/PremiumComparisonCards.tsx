/**
 * Premium Month vs Month Comparison Cards with animations
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardVariants, animateValue, hoverLiftVariants } from "@/lib/animations";
import { glassmorphism, shadows } from "@/lib/designTokens";

interface ComparisonMetric {
  id: string;
  label: string;
  icon: typeof DollarSign;
  currentValue: number;
  prevValue: number;
  change: number;
  formatter: (n: number) => string;
  gradient: string;
  shadowColor: string;
  isPositiveGood?: boolean; // For expenses, lower is better
}

interface PremiumComparisonCardProps {
  metrics: ComparisonMetric[];
  currentLabel: string;
  prevLabel: string;
}

function ComparisonCard({ metric, index }: { metric: ComparisonMetric; index: number }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [animatedChange, setAnimatedChange] = useState(0);
  const hasAnimated = useRef(false);
  const Icon = metric.icon;

  const isPositive = metric.isPositiveGood !== false 
    ? metric.change >= 0 
    : metric.change <= 0;

  // Animate on mount
  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      
      // Stagger the animation based on index
      const delay = index * 100;
      
      setTimeout(() => {
        animateValue(0, metric.change, 1200, (value) => {
          setAnimatedChange(value);
        });
      }, delay);
    }
  }, [metric.change, index]);

  return (
    <motion.div
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm transition-all duration-300"
      style={{
        boxShadow: shadows.cardElevation,
      }}
    >
      {/* Gradient border top accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: metric.gradient,
        }}
      />

      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Icon */}
          <motion.div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: metric.gradient,
              boxShadow: metric.shadowColor,
            }}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.3 }}
          >
            <Icon className="h-6 w-6 text-white" />
          </motion.div>

          {/* Change indicator */}
          <motion.div
            className="flex items-center gap-1"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
          >
            {metric.change !== 0 && (
              <>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn(
                  "font-bold text-lg",
                  isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {animatedChange >= 0 ? "+" : ""}{animatedChange.toFixed(1)}%
                </span>
              </>
            )}
          </motion.div>
        </div>

        {/* Label and Value */}
        <div className="mt-3">
          <div className="text-sm text-slate-500 mb-1">{metric.label}</div>
          <motion.div
            className="text-2xl font-bold text-slate-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
          >
            {metric.formatter(metric.currentValue)}
          </motion.div>
        </div>

        {/* Mini sparkline placeholder - would show actual trend in full implementation */}
        <div className="mt-3 flex items-center gap-1 h-8">
          {/* Simple trend visualization */}
          <div className="flex-1 flex items-end gap-0.5 h-full">
            {[...Array(8)].map((_, i) => {
              const height = Math.random() * 60 + 40;
              const isLast = i === 7;
              return (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${height}%`,
                    background: isLast 
                      ? metric.gradient
                      : isPositive 
                        ? "rgba(16, 185, 129, 0.3)" 
                        : "rgba(239, 68, 68, 0.3)",
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.4 + i * 0.05 }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover glow effect */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          boxShadow: `0 0 30px ${metric.shadowColor.replace('0.2', '0.4')}`,
        }}
      />
    </motion.div>
  );
}

export default function PremiumComparisonCards({
  metrics,
  currentLabel,
  prevLabel,
}: PremiumComparisonCardProps) {
  return (
    <div className="space-y-4">
      {/* Header info */}
      <motion.div
        className="text-sm text-slate-600"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Comparing <span className="font-semibold text-slate-900">{currentLabel}</span> vs{" "}
        <span className="font-semibold text-slate-700">{prevLabel}</span>
      </motion.div>

      {/* Cards grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {metrics.map((metric, index) => (
          <ComparisonCard key={metric.id} metric={metric} index={index} />
        ))}
      </motion.div>
    </div>
  );
}
