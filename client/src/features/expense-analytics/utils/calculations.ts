/**
 * Expense Analytics Calculations
 * 
 * Utility functions for processing and analyzing expense data
 */

import { format } from "date-fns";

export interface MonthlyExpenseData {
  month: string;
  fullMonth: string;
  year: number;
  monthNum: number;
  expenseBreakdown: Record<string, number> | Array<[string, number]>;
  totalExpenses: number;
}

export interface CategoryMetrics {
  id: string;
  name: string;
  total: number;
  percentage: number;
  growth: number;
  avgPerMonth: number;
  monthlyData: Array<{ month: string; amount: number }>;
  bestMonth: { month: string; amount: number } | null;
}

export interface ExpenseInsight {
  type: 'concentration' | 'growth' | 'stable' | 'warning' | 'alert' | 'info' | 'trend';
  message: string;
  priority: number;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Normalize expense breakdown to consistent format
 */
export function normalizeBreakdown(breakdown: Record<string, number> | Array<[string, number]>): Record<string, number> {
  if (Array.isArray(breakdown)) {
    return Object.fromEntries(breakdown);
  }
  return breakdown;
}

/**
 * Calculate metrics for each expense category
 */
export function calculateCategoryMetrics(
  trendData: MonthlyExpenseData[],
  prevTrendData: MonthlyExpenseData[]
): CategoryMetrics[] {
  if (!trendData || trendData.length === 0) {
    return [];
  }

  // Aggregate totals per category
  const categoryTotals = new Map<string, number>();
  const categoryMonthlyData = new Map<string, Array<{ month: string; amount: number }>>();

  trendData.forEach(monthData => {
    const breakdown = normalizeBreakdown(monthData.expenseBreakdown);
    Object.entries(breakdown).forEach(([category, amount]) => {
      const current = categoryTotals.get(category) || 0;
      categoryTotals.set(category, current + amount);

      const monthly = categoryMonthlyData.get(category) || [];
      monthly.push({ month: monthData.month, amount });
      categoryMonthlyData.set(category, monthly);
    });
  });

  // Calculate previous period totals for growth comparison
  const prevCategoryTotals = new Map<string, number>();
  prevTrendData.forEach(monthData => {
    const breakdown = normalizeBreakdown(monthData.expenseBreakdown);
    Object.entries(breakdown).forEach(([category, amount]) => {
      const current = prevCategoryTotals.get(category) || 0;
      prevCategoryTotals.set(category, current + amount);
    });
  });

  // Calculate total expenses
  const totalExpenses = Array.from(categoryTotals.values()).reduce((sum, val) => sum + val, 0);

  // Build metrics for each category
  const metrics: CategoryMetrics[] = [];
  categoryTotals.forEach((total, categoryName) => {
    const monthlyData = categoryMonthlyData.get(categoryName) || [];
    const avgPerMonth = trendData.length > 0 ? total / trendData.length : 0;
    const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;

    // Find best month
    const bestMonth = monthlyData.length > 0
      ? monthlyData.reduce((max, curr) => curr.amount > max.amount ? curr : max)
      : null;

    // Calculate growth vs previous period
    const prevTotal = prevCategoryTotals.get(categoryName) || 0;
    let growth = 0;
    if (prevTotal > 0) {
      growth = ((total - prevTotal) / prevTotal) * 100;
    } else if (total > 0) {
      // If there was no previous spending but current spending exists, show as 100% growth
      growth = 100;
    }

    metrics.push({
      id: categoryName,
      name: categoryName,
      total,
      percentage,
      growth,
      avgPerMonth,
      monthlyData,
      bestMonth,
    });
  });

  // Sort by total descending
  return metrics.sort((a, b) => b.total - a.total);
}

/**
 * Calculate top-level KPIs
 */
export function calculateKPIs(
  trendData: MonthlyExpenseData[],
  prevTrendData: MonthlyExpenseData[],
  metrics: CategoryMetrics[]
) {
  const totalExpenses = trendData.reduce((sum, month) => sum + month.totalExpenses, 0);
  const prevTotalExpenses = prevTrendData.reduce((sum, month) => sum + month.totalExpenses, 0);

  const expenseChange = prevTotalExpenses > 0
    ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
    : 0;

  const activeCategories = metrics.filter(m => m.total > 0).length;

  const largestCategory = metrics.length > 0 ? metrics[0] : null;

  const avgMonthlyExpenses = trendData.length > 0
    ? totalExpenses / trendData.length
    : 0;

  return {
    totalExpenses,
    expenseChange,
    activeCategories,
    largestCategory,
    avgMonthlyExpenses,
  };
}

/**
 * Generate insights from expense data
 */
export function generateInsights(
  metrics: CategoryMetrics[],
  kpis: ReturnType<typeof calculateKPIs>,
  trendData: MonthlyExpenseData[]
): ExpenseInsight[] {
  const insights: ExpenseInsight[] = [];

  // 1. Concentration insight (Blue - Info)
  if (metrics.length >= 3) {
    const topThree = metrics.slice(0, 3);
    const topThreeTotal = topThree.reduce((sum, m) => sum + m.total, 0);
    const percentage = kpis.totalExpenses > 0
      ? (topThreeTotal / kpis.totalExpenses) * 100
      : 0;

    if (percentage >= 50) {
      const names = topThree.map(m => m.name).join(', ');
      insights.push({
        type: 'concentration',
        message: `Top 3 categories (${names}) account for ${percentage.toFixed(0)}% of total spending`,
        priority: 1,
        severity: 'medium',
      });
    }
  }

  // 2. Growth alert (Red - Alert) - only for significant growth (> 50%)
  const highGrowthCategories = metrics
    .filter((m, index) => index < 5 && m.growth > 50)
    .sort((a, b) => b.growth - a.growth);

  if (highGrowthCategories.length > 0) {
    const top = highGrowthCategories[0];
    insights.push({
      type: 'alert',
      message: `⚠️ ${top.name} surged ${Math.abs(top.growth).toFixed(0)}% - investigate cause`,
      priority: 0,
      severity: 'high',
    });
  }

  // 3. Stability insight (Green - Stable) - check variance in last 3 months
  if (trendData.length >= 3) {
    const recentMonths = trendData.slice(-3);
    
    for (let i = 0; i < Math.min(3, metrics.length); i++) {
      const category = metrics[i];
      const recentAmounts = recentMonths
        .map(month => {
          const breakdown = normalizeBreakdown(month.expenseBreakdown);
          return breakdown[category.name] || 0;
        })
        .filter(amt => amt > 0);

      if (recentAmounts.length >= 3) {
        const avg = recentAmounts.reduce((sum, val) => sum + val, 0) / recentAmounts.length;
        const variance = recentAmounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentAmounts.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = avg > 0 ? (stdDev / avg) * 100 : 0;

        if (coefficientOfVariation < 15) {
          insights.push({
            type: 'stable',
            message: `✓ ${category.name} spending is stable over the last 3 months (±${coefficientOfVariation.toFixed(0)}% variance)`,
            priority: 4,
            severity: 'low',
          });
          break; // Only show one stability insight
        }
      }
    }
  }

  // 4. Category dominance (Amber - Warning) - if any category > 20%
  const dominantCategories = metrics.filter((m, index) => index < 3 && m.percentage > 20);
  if (dominantCategories.length > 0) {
    const dominant = dominantCategories[0];
    insights.push({
      type: 'warning',
      message: `⚠️ ${dominant.name} represents ${dominant.percentage.toFixed(0)}% of all expenses - consider cost optimization`,
      priority: 2,
      severity: 'medium',
    });
  }

  // 5. Trend insight (Blue - Info) - average monthly spending
  if (trendData.length > 0) {
    insights.push({
      type: 'info',
      message: `📈 Total expenses averaged ${formatSSP(kpis.avgMonthlyExpenses)} per month across the period`,
      priority: 5,
      severity: 'low',
    });
  }

  // 6. New categories insight (Blue - Info) - categories with 100% growth but low previous value
  const newCategories = metrics.filter(m => m.growth === 100 && m.total > 0);
  if (newCategories.length > 0) {
    insights.push({
      type: 'info',
      message: `🆕 ${newCategories.length} new expense ${newCategories.length === 1 ? 'category' : 'categories'} added this period`,
      priority: 6,
      severity: 'low',
    });
  }

  // Sort by priority and limit to top 5
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

/**
 * Format currency values
 */
export const formatSSP = (value: number): string => {
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `SSP ${(value / 1_000_000_000).toFixed(abs < 10_000_000_000 ? 1 : 0)}B`;
  }
  if (abs >= 1_000_000) {
    return `SSP ${(value / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}M`;
  }
  if (abs >= 1_000) {
    return `SSP ${nf.format(Math.round(value / 1_000))}k`;
  }
  return `SSP ${nf.format(Math.round(value))}`;
};

/**
 * Format month label safely
 */
export function formatMonthSafely(monthData: { month: string }): string {
  try {
    // Try to parse and format the month string
    const parts = monthData.month.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      if (!isNaN(year) && !isNaN(month)) {
        return format(new Date(year, month - 1, 1), 'MMM yyyy');
      }
    }
    return monthData.month;
  } catch {
    return monthData.month;
  }
}

/**
 * Generate safe CSS ID from category name
 * Removes all non-alphanumeric characters except hyphens
 */
export function generateSafeCSSId(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
}
