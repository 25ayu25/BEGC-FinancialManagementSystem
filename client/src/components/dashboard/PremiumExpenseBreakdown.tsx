/**
 * Premium Expense Breakdown with glassmorphism and animations
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Receipt, 
  Lightbulb, 
  User, 
  Building2, 
  FlaskConical, 
  Stethoscope, 
  TestTube, 
  Pill, 
  Package,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cardVariants, getStaggerDelay } from "@/lib/animations";
import { glassmorphism, gradients } from "@/lib/designTokens";

interface ExpenseItem {
  name: string;
  amount: number;
  percentage: number;
}

interface CategoryConfig {
  icon: LucideIcon;
  gradient: string;
  border: string;
  bg: string;
  shadow: string;
}

const expenseCategories: Record<string, CategoryConfig> = {
  'Radiographer Payments': { 
    icon: User, 
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    border: 'border-blue-500',
    bg: 'hover:bg-blue-50/50',
    shadow: '0 0 20px rgba(59, 130, 246, 0.3)',
  },
  'Clinic Operations': { 
    icon: Building2, 
    gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
    border: 'border-green-500',
    bg: 'hover:bg-green-50/50',
    shadow: '0 0 20px rgba(34, 197, 94, 0.3)',
  },
  'Lab Tech Payments': { 
    icon: FlaskConical, 
    gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
    border: 'border-orange-500',
    bg: 'hover:bg-orange-50/50',
    shadow: '0 0 20px rgba(249, 115, 22, 0.3)',
  },
  'Doctor Payments': { 
    icon: Stethoscope, 
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%)',
    border: 'border-teal-500',
    bg: 'hover:bg-teal-50/50',
    shadow: '0 0 20px rgba(20, 184, 166, 0.3)',
  },
  'Lab Reagents': { 
    icon: TestTube, 
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    border: 'border-pink-500',
    bg: 'hover:bg-pink-50/50',
    shadow: '0 0 20px rgba(236, 72, 153, 0.3)',
  },
  'Drugs Purchased': { 
    icon: Pill, 
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    border: 'border-amber-500',
    bg: 'hover:bg-amber-50/50',
    shadow: '0 0 20px rgba(245, 158, 11, 0.3)',
  },
  'Other': { 
    icon: Package, 
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
    border: 'border-slate-500',
    bg: 'hover:bg-slate-50/50',
    shadow: '0 0 20px rgba(100, 116, 139, 0.3)',
  },
};

function getCategoryConfig(categoryName: string): CategoryConfig {
  return expenseCategories[categoryName] || expenseCategories['Other'];
}

function isOtherCategory(categoryName: string): boolean {
  const normalized = categoryName.toLowerCase().trim();
  return normalized === 'other' || 
         normalized === 'others' || 
         normalized === 'other expenses' ||
         normalized === 'other expense';
}

function compactValue(n: number): string {
  const v = Math.abs(n);
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  
  if (v >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `${nf0.format(Math.round(n / 1_000))}k`;
  return `${nf0.format(Math.round(n))}`;
}

interface PremiumExpenseCardProps {
  expense: ExpenseItem;
  config: CategoryConfig;
  index: number;
}

function PremiumExpenseCard({ expense, config, index }: PremiumExpenseCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = config.icon;
  const isOther = isOtherCategory(expense.name);

  return (
    <motion.div
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
      whileHover={{ 
        y: -8,
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/90 backdrop-blur-sm",
        "shadow-md hover:shadow-2xl transition-all duration-300",
        "border-t-4 cursor-pointer",
        isOther ? "border border-dashed border-slate-300" : "border border-slate-200",
        config.border,
        config.bg
      )}
      style={{
        boxShadow: isHovered ? config.shadow : undefined,
      }}
    >
      {/* Glassmorphism overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: glassmorphism.card.background,
          backdropFilter: glassmorphism.card.backdropFilter,
        }}
      />

      <div className="relative p-5">
        {/* Icon with animated gradient background */}
        <motion.div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-lg relative overflow-hidden"
          animate={{
            scale: isHovered ? 1.1 : 1,
            rotate: isHovered ? 5 : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: config.gradient,
            }}
          />
          
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
            animate={{
              opacity: isHovered ? [0, 0.3, 0] : 0,
              x: isHovered ? ["-100%", "100%"] : "0%",
            }}
            transition={{
              duration: 1,
              repeat: isHovered ? Infinity : 0,
              ease: "linear",
            }}
          />
          
          <Icon className="h-6 w-6 text-white relative z-10" />
        </motion.div>

        {/* Category Name */}
        <h4 className="text-sm font-medium text-slate-600 mb-2 line-clamp-1">
          {expense.name}
        </h4>

        {/* Amount and Percentage */}
        <div className="flex items-baseline justify-between mb-3">
          <motion.span
            className="text-2xl font-bold text-slate-900"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: getStaggerDelay(index, 0.1) + 0.2 }}
          >
            SSP {compactValue(expense.amount)}
          </motion.span>
          <motion.span
            className="text-xs font-semibold text-white px-2.5 py-1 rounded-full"
            style={{
              background: config.gradient,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              delay: getStaggerDelay(index, 0.1) + 0.3,
              type: "spring",
              stiffness: 260,
              damping: 20,
            }}
          >
            {expense.percentage}%
          </motion.span>
        </div>

        {/* Circular progress indicator */}
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: config.gradient,
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${expense.percentage}%` }}
            transition={{
              duration: 1.5,
              delay: getStaggerDelay(index, 0.1) + 0.4,
              ease: "easeOut",
            }}
          />
          
          {/* Shimmer effect on progress bar */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
              delay: getStaggerDelay(index, 0.1) + 1,
            }}
          />
        </div>
      </div>

      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(circle at center, ${config.gradient.match(/\#[0-9a-f]{6}/i)?.[0]}15 0%, transparent 70%)`,
        }}
      />
    </motion.div>
  );
}

interface PremiumExpenseBreakdownProps {
  expenses: ExpenseItem[];
  total: number;
  periodLabel?: string;
}

export default function PremiumExpenseBreakdown({
  expenses,
  total,
  periodLabel,
}: PremiumExpenseBreakdownProps) {
  // Calculate top 3 percentage
  const top3Percentage = expenses
    .filter(e => !isOtherCategory(e.name))
    .slice(0, 3)
    .reduce((sum, e) => sum + e.percentage, 0);

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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
        {expenses.map((expense, index) => {
          const config = getCategoryConfig(expense.name);
          return (
            <PremiumExpenseCard
              key={expense.name}
              expense={expense}
              config={config}
              index={index}
            />
          );
        })}
      </motion.div>

      {/* Smart Insight Footer */}
      {expenses.filter(e => !isOtherCategory(e.name)).length >= 3 && (
        <motion.div
          className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: expenses.length * 0.1 + 0.5 }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Lightbulb className="h-5 w-5 text-amber-600 fill-amber-200" />
              </motion.div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Insight:</span> Top 3 expenses account for{" "}
                <span className="font-bold text-amber-700">{top3Percentage}%</span> of total spending
              </p>
              <p className="text-xs text-amber-700 mt-1">
                💡 Consider reviewing these categories for potential cost optimization opportunities
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
