/**
 * Department Analytics Calculations
 * 
 * Utility functions for calculating department metrics, rankings, trends, and insights
 */

import { format, isValid, parseISO } from 'date-fns';

export interface DepartmentMetrics {
  id: string;
  name: string;
  code: string;
  revenue: number;
  share: number;
  avgPerMonth: number;
  bestMonth: { month: string; revenue: number } | null;
  growth: number;
  rank: number;
  monthlyData: Array<{ month: string; revenue: number }>;
  color?: string;
}

export interface MonthlyTrendData {
  month: string;
  fullMonth?: string;
  year: number;
  monthNum: number;
  revenue: number;
  departmentBreakdown: Record<string, number>;
}

/**
 * Calculate comprehensive metrics for all departments
 */
export function calculateDepartmentMetrics(
  departments: Array<{ id: string; name: string; code: string }>,
  trendData: MonthlyTrendData[],
  previousPeriodData: MonthlyTrendData[]
): DepartmentMetrics[] {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  // Calculate total revenue per department for current period
  const deptRevenue = new Map<string, number>();
  const deptMonthlyData = new Map<string, Array<{ month: string; revenue: number }>>();

  trendData.forEach((monthData) => {
    Object.entries(monthData.departmentBreakdown || {}).forEach(([deptId, amount]) => {
      deptRevenue.set(deptId, (deptRevenue.get(deptId) || 0) + amount);
      
      if (!deptMonthlyData.has(deptId)) {
        deptMonthlyData.set(deptId, []);
      }
      deptMonthlyData.get(deptId)!.push({
        month: monthData.month,
        revenue: amount,
      });
    });
  });

  // Calculate previous period revenue for growth calculation
  const prevDeptRevenue = new Map<string, number>();
  previousPeriodData.forEach((monthData) => {
    Object.entries(monthData.departmentBreakdown || {}).forEach(([deptId, amount]) => {
      prevDeptRevenue.set(deptId, (prevDeptRevenue.get(deptId) || 0) + amount);
    });
  });

  // Calculate total revenue
  const totalRevenue = Array.from(deptRevenue.values()).reduce((sum, val) => sum + val, 0);

  // Build metrics for each department
  const metrics: DepartmentMetrics[] = departments
    .map((dept, index) => {
      const revenue = deptRevenue.get(dept.id) || 0;
      const prevRevenue = prevDeptRevenue.get(dept.id) || 0;
      const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      const monthlyData = deptMonthlyData.get(dept.id) || [];
      const avgPerMonth = monthlyData.length > 0 ? revenue / monthlyData.length : 0;
      
      // Calculate growth
      let growth = 0;
      if (prevRevenue > 0) {
        growth = ((revenue - prevRevenue) / prevRevenue) * 100;
      } else if (revenue > 0) {
        growth = 100; // New department with revenue
      }

      // Find best month
      let bestMonth: { month: string; revenue: number } | null = null;
      if (monthlyData.length > 0) {
        const best = monthlyData.reduce((max, curr) => 
          curr.revenue > max.revenue ? curr : max
        );
        bestMonth = best;
      }

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        revenue,
        share,
        avgPerMonth,
        bestMonth,
        growth,
        rank: 0, // Will be set after sorting
        monthlyData,
        color: colors[index % colors.length],
      };
    })
    .filter(m => m.revenue > 0) // Only include departments with revenue
    .sort((a, b) => b.revenue - a.revenue); // Sort by revenue descending

  // Assign ranks
  metrics.forEach((m, index) => {
    m.rank = index + 1;
  });

  return metrics;
}

/**
 * Generate performance insights based on department metrics
 */
export function generateInsights(metrics: DepartmentMetrics[]): Array<{
  type: 'info' | 'warning' | 'success';
  icon: string;
  message: string;
}> {
  const insights: Array<{
    type: 'info' | 'warning' | 'success';
    icon: string;
    message: string;
  }> = [];

  if (metrics.length === 0) {
    return insights;
  }

  // Top performer insight
  const topDept = metrics[0];
  if (topDept) {
    insights.push({
      type: 'info',
      icon: '💡',
      message: `${topDept.name} is your top performer with ${topDept.share.toFixed(1)}% of total revenue`,
    });
  }

  // Fastest growing department
  const fastestGrowing = [...metrics].sort((a, b) => b.growth - a.growth)[0];
  if (fastestGrowing && typeof fastestGrowing.growth === 'number' && fastestGrowing.growth > 10) {
    insights.push({
      type: 'success',
      icon: '💡',
      message: `${fastestGrowing.name} grew ${fastestGrowing.growth > 0 ? '+' : ''}${fastestGrowing.growth.toFixed(1)}% this period - fastest growing department`,
    });
  }

  // Departments with negative growth
  const declining = metrics.filter(m => m.growth < -5);
  if (declining.length > 0) {
    declining.forEach(dept => {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        message: `${dept.name} dropped ${Math.abs(dept.growth).toFixed(1)}% - investigate potential issues`,
      });
    });
  }

  // Low revenue but high potential departments
  const lowRevenue = metrics.filter(m => m.share < 10 && m.rank > 3);
  if (lowRevenue.length > 0) {
    const dept = lowRevenue[0];
    insights.push({
      type: 'info',
      icon: '💡',
      message: `${dept.name} has potential for growth but currently only ${dept.share.toFixed(1)}% of revenue`,
    });
  }

  // New departments (high growth from low base)
  const newDepts = metrics.filter(m => m.growth > 90 && m.share < 5);
  if (newDepts.length > 0) {
    newDepts.forEach(dept => {
      insights.push({
        type: 'success',
        icon: '🆕',
        message: `${dept.name} is new and generating SSP ${(dept.revenue / 1000000).toFixed(1)}M`,
      });
    });
  }

  return insights;
}

/**
 * Format currency in SSP
 */
export function formatSSP(amount: number, compact: boolean = false): string {
  if (compact) {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
  }
  return Math.round(amount).toLocaleString();
}

/**
 * Safely format a month to a readable format
 * Can accept either a short month string or a MonthlyTrendData-like object
 */
export function formatMonthSafely(
  monthData: string | { month?: string; fullMonth?: string; year?: number; monthNum?: number } | null | undefined,
  formatPattern: string = 'MMM yyyy'
): string {
  if (!monthData) return '-';
  
  try {
    // If it's a string, return it directly (already formatted like "Nov")
    if (typeof monthData === 'string') {
      return monthData;
    }
    
    // If it's an object with fullMonth, use that for full format
    if (monthData.fullMonth) {
      return monthData.fullMonth;
    }
    
    // If it's an object with year and monthNum, construct a date
    if (monthData.year && monthData.monthNum) {
      const date = new Date(monthData.year, monthData.monthNum - 1, 1);
      if (isValid(date)) {
        return format(date, formatPattern);
      }
    }
    
    // Fallback to month field
    return monthData.month || '-';
  } catch (err) {
    console.warn(`Failed to format month:`, monthData, err);
    return '-';
  }
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get department icon color based on code
 */
export function getDepartmentColor(code: string): string {
  const key = code.toLowerCase();
  if (key.includes('lab')) return '#10b981'; // emerald
  if (key.includes('ultra')) return '#3b82f6'; // blue
  if (key.includes('xray') || key.includes('x-ray')) return '#f59e0b'; // amber
  if (key.includes('pharm')) return '#8b5cf6'; // purple
  if (key.includes('con')) return '#ef4444'; // red
  return '#64748b'; // slate
}
