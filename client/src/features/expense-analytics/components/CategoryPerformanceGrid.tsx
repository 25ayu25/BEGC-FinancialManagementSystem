/**
 * Category Performance Grid Component
 * 
 * Displays expense categories with metrics and sparklines
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, User, Building2, FlaskConical, Stethoscope, TestTube, Pill, Camera, Home, Users, Fuel, Shield, Package } from "lucide-react";
import { formatSSP } from "../utils/calculations";
import type { CategoryMetrics } from "../utils/calculations";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CategoryPerformanceGridProps {
  metrics: CategoryMetrics[];
  onCategoryClick?: (category: CategoryMetrics) => void;
  isLoading?: boolean;
}

// Category icon mapping
const CATEGORY_ICONS: Record<string, any> = {
  'Radiographer Payments': User,
  'Radiographer': User,
  'Clinic Operations': Building2,
  'Lab Tech Payments': FlaskConical,
  'Lab Tech': FlaskConical,
  'Doctor Payments': Stethoscope,
  'Doctor': Stethoscope,
  'Lab Reagents': TestTube,
  'Drugs': Pill,
  'X-Ray Materials': Camera,
  'X-Ray': Camera,
  'Landlord Payments': Home,
  'Landlord': Home,
  'Staff Payments': Users,
  'Staff': Users,
  'Fuel & Transportation': Fuel,
  'Fuel': Fuel,
  'Insurance Payments': Shield,
  'Insurance': Shield,
  'Other': Package,
};

// Category colors for sparklines
const CATEGORY_COLORS = [
  'text-red-500',
  'text-orange-500',
  'text-amber-500',
  'text-teal-500',
  'text-blue-500',
  'text-purple-500',
  'text-pink-500',
  'text-green-500',
  'text-indigo-500',
  'text-cyan-500',
];

// Get category icon
function getCategoryIcon(categoryName: string) {
  // Try exact match first
  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }
  
  // Try partial match
  const normalizedName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return icon;
    }
  }
  
  // Default to Package icon
  return Package;
}

// Get status badge based on rank and percentage
function getStatusBadge(rank: number, percentage: number) {
  // Only #1 gets TOP SPENDER if it's >= 15%
  if (rank === 1 && percentage >= 15) {
    return { label: 'TOP SPENDER', color: 'bg-red-100 text-red-700 border-red-300' };
  }
  // HIGH SPEND for >= 10%
  if (percentage >= 10) {
    return { label: 'HIGH SPEND', color: 'bg-orange-100 text-orange-700 border-orange-300' };
  }
  // MODERATE for >= 5%
  if (percentage >= 5) {
    return { label: 'MODERATE', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  }
  // LOW SPEND for < 5%
  return { label: 'LOW SPEND', color: 'bg-slate-100 text-slate-600 border-slate-300' };
}

// Get rank badge gradient based on rank
function getRankGradient(rank: number) {
  if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-amber-500"; // Gold
  if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400"; // Silver
  if (rank === 3) return "bg-gradient-to-br from-orange-400 to-amber-600"; // Bronze
  if (rank <= 6) return "bg-gradient-to-br from-blue-400 to-blue-500"; // Dark blue
  return "bg-gradient-to-br from-blue-300 to-blue-400"; // Light blue
}

function Sparkline({ data, colorClass }: { data: Array<{ month: string; amount: number }>; colorClass: string }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.amount));
  const min = Math.min(...data.map(d => d.amount));
  const range = max - min;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = range > 0 ? ((max - d.amount) / range) * 100 : 50;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className={colorClass}
      />
    </svg>
  );
}

export function CategoryPerformanceGrid({ 
  metrics, 
  onCategoryClick,
  isLoading 
}: CategoryPerformanceGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-8 bg-gray-200 rounded mb-2" />
              <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
              <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-12 w-full bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No expense data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((category, index) => {
        const rank = index + 1;
        const growthIcon = category.growth > 5 ? TrendingUp : category.growth < -5 ? TrendingDown : Minus;
        const growthColor = category.growth > 5 ? "text-red-600" : category.growth < -5 ? "text-green-600" : "text-gray-500";
        const GrowthIcon = growthIcon;
        const CategoryIcon = getCategoryIcon(category.name);
        const statusBadge = getStatusBadge(rank, category.percentage);
        const sparklineColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

        // Rank badge gradient with improved differentiation
        const rankBadgeClass = getRankGradient(rank);

        // Rank icon gradient
        let rankIconClass = "bg-gradient-to-br from-blue-400 to-blue-600";
        if (index === 0) rankIconClass = "bg-gradient-to-br from-yellow-400 to-amber-500";
        if (index === 1) rankIconClass = "bg-gradient-to-br from-gray-400 to-gray-500";
        if (index === 2) rankIconClass = "bg-gradient-to-br from-orange-400 to-amber-600";

        return (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card
              className={cn(
                "group relative overflow-hidden cursor-pointer border-2 transition-all duration-300",
                "hover:shadow-xl hover:-translate-y-1",
                index === 0 && "border-yellow-300 bg-gradient-to-br from-yellow-50/50 to-amber-50/50",
                index === 1 && "border-gray-300 bg-gradient-to-br from-gray-50/50 to-slate-50/50",
                index === 2 && "border-orange-300 bg-gradient-to-br from-orange-50/50 to-amber-50/50",
                index > 2 && "border-blue-200 bg-white"
              )}
              onClick={() => onCategoryClick?.(category)}
            >
            {/* Gradient overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <CardContent className="p-6 relative">
              {/* Header: Rank Badge, Icon, and Growth */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Rank Badge with Gradient */}
                  <span className={cn(
                    "inline-flex items-center justify-center w-10 h-10 rounded-full text-white text-sm font-bold shadow-lg",
                    rankBadgeClass
                  )}>
                    #{index + 1}
                  </span>
                  
                  {/* Category Icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shadow-md",
                    rankIconClass
                  )}>
                    <CategoryIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                {/* Growth Indicator */}
                <div className={cn("flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full", growthColor, "bg-white shadow-sm")}>
                  <GrowthIcon className="w-4 h-4" />
                  <span>{Math.abs(category.growth).toFixed(1)}%</span>
                </div>
              </div>

              {/* Category Name */}
              <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">
                {category.name}
              </h3>

              {/* Status Badge */}
              <Badge className={cn("mb-3 text-xs font-semibold border", statusBadge.color)}>
                {statusBadge.label}
              </Badge>

              {/* Total Amount */}
              <div className="text-2xl font-bold text-gray-900 mb-1 tabular-nums">
                {formatSSP(category.total)}
              </div>

              {/* Percentage of Total */}
              <div className="text-sm text-gray-600 font-medium mb-4 tabular-nums">
                {category.percentage.toFixed(1)}% of total expenses
              </div>

              {/* Sparkline with Category-Specific Color */}
              <div className="h-12 mb-2">
                <Sparkline data={category.monthlyData} colorClass={sparklineColor} />
              </div>

              {/* Best Month Info */}
              {category.bestMonth && (
                <div className="text-xs text-gray-600 font-medium">
                  Peak: {formatSSP(category.bestMonth.amount)} in {category.bestMonth.month}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
