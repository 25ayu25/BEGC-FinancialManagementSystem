/**
 * Insurance Overview Calculations Utility
 * 
 * Helper functions for processing insurance provider analytics data
 */

export interface InsuranceProvider {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MonthlyTrendData {
  month: string;
  fullMonth: string;
  year: number;
  monthNum: number;
  revenue: number;
  revenueUSD: number;
}

export interface ProviderMetrics {
  id: string;
  name: string;
  revenue: number;
  claimsCount: number;
  share: number;
  growth: number;
  avgClaim: number;
  bestMonth: { month: string; fullMonth: string; revenue: number } | null;
  monthlyTrend: Array<{ month: string; revenue: number }>;
  rank: number;
  status: 'TOP PERFORMER' | 'RISING STAR' | 'NEEDS ATTENTION' | 'STABLE';
}

export interface InsuranceInsight {
  type: 'success' | 'warning' | 'info' | 'neutral';
  icon: string;
  message: string;
}

/**
 * Format SSP currency
 */
export function formatSSP(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SSP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format USD currency
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format compact number (1.2M, 450K, etc.)
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Calculate provider metrics from transaction data
 */
export function calculateProviderMetrics(
  providers: InsuranceProvider[],
  transactions: Array<{
    insuranceProviderId: string | null;
    amount: number;
    currency: string;
    date: string;
  }>,
  prevTransactions: Array<{
    insuranceProviderId: string | null;
    amount: number;
    currency: string;
  }>
): ProviderMetrics[] {
  // Filter SSP insurance transactions
  const sspInsuranceTxs = transactions.filter(
    t => t.insuranceProviderId && t.currency === 'SSP'
  );
  
  const prevSspInsuranceTxs = prevTransactions.filter(
    t => t.insuranceProviderId && t.currency === 'SSP'
  );

  // Calculate total revenue for share calculation
  const totalRevenue = sspInsuranceTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  // Group by provider
  const providerData = new Map<string, {
    revenue: number;
    claimsCount: number;
    prevRevenue: number;
    monthlyData: Map<string, number>;
  }>();

  // Initialize for all active providers
  providers.filter(p => p.isActive).forEach(p => {
    providerData.set(p.id, {
      revenue: 0,
      claimsCount: 0,
      prevRevenue: 0,
      monthlyData: new Map(),
    });
  });

  // Process current period transactions
  sspInsuranceTxs.forEach(t => {
    if (!t.insuranceProviderId) return;
    
    const data = providerData.get(t.insuranceProviderId);
    if (!data) return;

    const amount = Number(t.amount);
    data.revenue += amount;
    data.claimsCount += 1;

    // Track monthly revenue
    const txDate = new Date(t.date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    data.monthlyData.set(monthKey, (data.monthlyData.get(monthKey) || 0) + amount);
  });

  // Process previous period transactions
  prevSspInsuranceTxs.forEach(t => {
    if (!t.insuranceProviderId) return;
    
    const data = providerData.get(t.insuranceProviderId);
    if (!data) return;

    data.prevRevenue += Number(t.amount);
  });

  // Convert to metrics array
  const metrics: ProviderMetrics[] = [];
  
  providers.filter(p => p.isActive).forEach(provider => {
    const data = providerData.get(provider.id);
    if (!data) return;

    const share = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
    const growth = data.prevRevenue > 0 
      ? ((data.revenue - data.prevRevenue) / data.prevRevenue) * 100 
      : 0;
    const avgClaim = data.claimsCount > 0 ? data.revenue / data.claimsCount : 0;

    // Find best month
    let bestMonth: { month: string; fullMonth: string; revenue: number } | null = null;
    let maxRevenue = 0;
    
    data.monthlyData.forEach((revenue, monthKey) => {
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        const [year, month] = monthKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthNum = parseInt(month) - 1;
        bestMonth = {
          month: monthNames[monthNum],
          fullMonth: `${fullMonthNames[monthNum]} ${year}`,
          revenue,
        };
      }
    });

    // Build monthly trend (last 6 months or available)
    const monthlyTrend = Array.from(data.monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, revenue]) => {
        const [, month] = monthKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          month: monthNames[parseInt(month) - 1],
          revenue,
        };
      })
      .slice(-6); // Last 6 months

    // Determine status
    let status: ProviderMetrics['status'] = 'STABLE';
    if (share >= 20) {
      status = 'TOP PERFORMER';
    } else if (growth >= 15) {
      status = 'RISING STAR';
    } else if (growth < -10) {
      status = 'NEEDS ATTENTION';
    }

    metrics.push({
      id: provider.id,
      name: provider.name,
      revenue: data.revenue,
      claimsCount: data.claimsCount,
      share,
      growth,
      avgClaim,
      bestMonth,
      monthlyTrend,
      rank: 0, // Will be set after sorting
      status,
    });
  });

  // Sort by revenue and assign ranks
  metrics.sort((a, b) => b.revenue - a.revenue);
  metrics.forEach((m, index) => {
    m.rank = index + 1;
  });

  return metrics;
}

/**
 * Generate AI-powered insights
 */
export function generateInsights(metrics: ProviderMetrics[]): InsuranceInsight[] {
  const insights: InsuranceInsight[] = [];

  if (metrics.length === 0) {
    return [{
      type: 'info',
      icon: '💡',
      message: 'No insurance provider data available for the selected period',
    }];
  }

  // Top performer insight
  const topProvider = metrics[0];
  if (topProvider && topProvider.share > 0) {
    insights.push({
      type: 'success',
      icon: '💡',
      message: `${topProvider.name} is your top performer with ${topProvider.share.toFixed(1)}% of total insurance revenue`,
    });
  }

  // Fastest growing
  const fastestGrowing = [...metrics].sort((a, b) => b.growth - a.growth)[0];
  if (fastestGrowing && fastestGrowing.growth > 20) {
    insights.push({
      type: 'success',
      icon: '📈',
      message: `${fastestGrowing.name} grew ${fastestGrowing.growth.toFixed(0)}% this period - fastest growing provider`,
    });
  }

  // Needs attention
  const declining = metrics.filter(m => m.growth < -10);
  if (declining.length > 0) {
    const worst = declining[0];
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `${worst.name} dropped ${Math.abs(worst.growth).toFixed(0)}% vs last period - investigate pending claims`,
    });
  }

  // High performers count
  const highPerformers = metrics.filter(m => m.status === 'TOP PERFORMER');
  if (highPerformers.length > 1) {
    insights.push({
      type: 'info',
      icon: '🎯',
      message: `${highPerformers.length} providers account for majority of insurance revenue`,
    });
  }

  // Average claim value insight
  const avgClaimOverall = metrics.reduce((sum, m) => sum + m.avgClaim, 0) / metrics.length;
  const highValueProviders = metrics.filter(m => m.avgClaim > avgClaimOverall * 1.5);
  if (highValueProviders.length > 0) {
    insights.push({
      type: 'info',
      icon: '💰',
      message: `${highValueProviders.length} providers have above-average claim values`,
    });
  }

  return insights;
}

/**
 * Prepare chart data for revenue trends
 */
export function prepareChartData(
  metrics: ProviderMetrics[],
  monthLabels: string[]
): Array<{ month: string; [key: string]: string | number }> {
  const chartData: Array<{ month: string; [key: string]: string | number }> = [];

  // Create a map of month -> provider revenues
  const monthDataMap = new Map<string, { month: string; [key: string]: number }>();

  monthLabels.forEach(month => {
    monthDataMap.set(month, { month });
  });

  // Fill in provider data
  metrics.forEach(provider => {
    provider.monthlyTrend.forEach(({ month, revenue }) => {
      const monthData = monthDataMap.get(month);
      if (monthData) {
        monthData[provider.name] = revenue;
      }
    });
  });

  // Convert to array
  monthLabels.forEach(month => {
    const data = monthDataMap.get(month);
    if (data) {
      chartData.push(data);
    }
  });

  return chartData;
}
