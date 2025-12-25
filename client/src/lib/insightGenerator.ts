/**
 * AI-powered insight generation utilities
 */

import type { InsightData } from "@/components/dashboard/PremiumInsightBanner";

interface MonthlyTrendItem {
  month: string;
  fullMonth: string;
  year: number;
  monthNum: number;
  revenue: number;
  revenueUSD: number;
  departmentBreakdown?: Record<string, number>;
  expenseBreakdown?: Record<string, number>;
  totalExpenses?: number;
}

interface DepartmentGrowthItem {
  id: string | number;
  name: string;
  currentValue: number;
  prevValue: number;
  growth: number;
  isNewDepartment: boolean;
  hasNoActivity: boolean;
}

/**
 * Generate smart insights from trends and comparisons data
 */
export function generateSmartInsights(
  monthlyTrend: MonthlyTrendItem[],
  departmentGrowth: DepartmentGrowthItem[],
  trendStats: {
    yoyGrowth: number;
    bestMonth: string;
    monthlyAvg: number;
  },
  expenseBreakdown: Record<string, number>,
  totalExpenses: number
): InsightData[] {
  const insights: InsightData[] = [];

  // 1. Trend Insight - Revenue growth
  if (monthlyTrend.length >= 2 && trendStats.yoyGrowth !== 0) {
    const growthDirection = trendStats.yoyGrowth > 0 ? "grew" : "declined";
    const growthAbs = Math.abs(trendStats.yoyGrowth);
    insights.push({
      id: "trend-growth",
      type: "trend",
      message: `Revenue ${growthDirection} ${growthAbs >= 0.1 ? `+${growthAbs.toFixed(1)}%` : `${growthAbs.toFixed(1)}%`} over this period`,
      icon: "trending",
    });
  }

  // 2. Anomaly Alert - Best performing month
  if (trendStats.bestMonth && monthlyTrend.length > 0) {
    const bestMonthData = monthlyTrend.find(m => m.fullMonth === trendStats.bestMonth || m.month === trendStats.bestMonth);
    if (bestMonthData) {
      const avgRevenue = trendStats.monthlyAvg;
      const percentAboveAvg = ((bestMonthData.revenue - avgRevenue) / avgRevenue) * 100;
      
      if (percentAboveAvg > 10) {
        insights.push({
          id: "anomaly-best-month",
          type: "anomaly",
          message: `${trendStats.bestMonth} was your best performing month (+${percentAboveAvg.toFixed(0)}% above average)`,
          icon: "alert",
        });
      }
    }
  }

  // 3. New Additions - New departments
  const newDepartments = departmentGrowth.filter(d => d.isNewDepartment);
  if (newDepartments.length > 0) {
    const deptNames = newDepartments.map(d => d.name).join(", ");
    const message = newDepartments.length === 1
      ? `${deptNames} is new this period`
      : `${newDepartments.length} new departments: ${deptNames}`;
    
    insights.push({
      id: "new-departments",
      type: "new",
      message,
      icon: "sparkles",
    });
  }

  // 4. Recommendations - Expense optimization
  const sortedExpenses = Object.entries(expenseBreakdown)
    .map(([name, amount]) => ({ name, amount: Number(amount) || 0 }))
    .filter(e => e.name.toLowerCase() !== 'other')
    .sort((a, b) => b.amount - a.amount);

  if (sortedExpenses.length >= 3 && totalExpenses > 0) {
    const top3Total = sortedExpenses.slice(0, 3).reduce((sum, e) => sum + e.amount, 0);
    const top3Percentage = (top3Total / totalExpenses) * 100;

    if (top3Percentage > 50) {
      insights.push({
        id: "recommendation-expenses",
        type: "recommendation",
        message: `Top 3 expenses account for ${top3Percentage.toFixed(0)}% - consider cost optimization opportunities`,
        icon: "lightbulb",
      });
    }
  }

  // 5. Predictions - Revenue forecast
  if (monthlyTrend.length >= 3) {
    // Simple linear regression for next month prediction
    const recentMonths = monthlyTrend.slice(-3);
    const avgGrowth = recentMonths.length >= 2
      ? ((recentMonths[recentMonths.length - 1].revenue - recentMonths[0].revenue) / recentMonths[0].revenue) * 100
      : 0;

    if (Math.abs(avgGrowth) > 5) {
      const lastRevenue = monthlyTrend[monthlyTrend.length - 1].revenue;
      const projected = lastRevenue * (1 + avgGrowth / 100);
      const compactProjected = compactSSP(projected);
      
      insights.push({
        id: "prediction-next-month",
        type: "prediction",
        message: `Based on trends, next month projected at ${compactProjected}`,
        icon: "target",
      });
    }
  }

  // 6. Department performance insight
  const topGrowthDept = departmentGrowth
    .filter(d => !d.isNewDepartment && d.growth > 0)
    .sort((a, b) => b.growth - a.growth)[0];

  if (topGrowthDept && topGrowthDept.growth > 15) {
    insights.push({
      id: "department-star",
      type: "trend",
      message: `${topGrowthDept.name} is performing exceptionally well with +${topGrowthDept.growth.toFixed(1)}% growth`,
      icon: "trending",
    });
  }

  // 7. Warning for declining departments
  const decliningDepts = departmentGrowth
    .filter(d => !d.isNewDepartment && d.growth < -10)
    .sort((a, b) => a.growth - b.growth);

  if (decliningDepts.length > 0) {
    const worstDept = decliningDepts[0];
    insights.push({
      id: "warning-declining",
      type: "anomaly",
      message: `${worstDept.name} down ${Math.abs(worstDept.growth).toFixed(1)}% - investigation recommended`,
      icon: "alert",
    });
  }

  // Return insights, limiting to max 5 for rotation
  return insights.slice(0, 5);
}

// Helper function for compact SSP formatting
function compactSSP(n: number): string {
  const v = Math.abs(n);
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  
  if (v >= 1_000_000_000) return `SSP ${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `SSP ${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `SSP ${nf0.format(Math.round(n / 1_000))}k`;
  return `SSP ${nf0.format(Math.round(n))}`;
}
