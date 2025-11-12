/**
 * Calculation utilities for insurance overview metrics
 */

export type AgingBucket = {
  range: string;
  count: number;
  amount: number;
};

/**
 * Calculate collection rate as a percentage
 */
export function calculateCollectionRate(billed: number, collected: number): number {
  if (billed === 0) return 0;
  return (collected / billed) * 100;
}

/**
 * Calculate average days to payment
 */
export function calculateAverageDaysToPayment(
  claims: Array<{ periodStart: string }>,
  payments: Array<{ paymentDate?: string | null; createdAt?: string | null }>
): number {
  if (claims.length === 0 || payments.length === 0) return 0;

  let totalDays = 0;
  let count = 0;

  claims.forEach(claim => {
    const claimDate = new Date(claim.periodStart);
    
    payments.forEach(payment => {
      const paymentDate = payment.paymentDate || payment.createdAt;
      if (!paymentDate) return;
      
      const payDate = new Date(paymentDate);
      const days = Math.floor((payDate.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (days >= 0) {
        totalDays += days;
        count++;
      }
    });
  });

  return count > 0 ? Math.round(totalDays / count) : 0;
}

/**
 * Calculate aging buckets for outstanding claims
 */
export function calculateAgingBuckets(
  claims: Array<{
    id: string;
    claimedAmount: number | string;
    status: string;
    periodStart: string;
  }>,
  payments: Array<{
    claimId?: string | null;
    amount: number | string;
  }>
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: "0-30 days", count: 0, amount: 0 },
    { range: "31-60 days", count: 0, amount: 0 },
    { range: "61-90 days", count: 0, amount: 0 },
    { range: "91+ days", count: 0, amount: 0 },
  ];

  const now = new Date();

  claims.forEach(claim => {
    // Skip fully paid claims
    if (claim.status === "paid") return;

    // Calculate outstanding amount
    const claimAmount = Number(claim.claimedAmount);
    const paidAmount = payments
      .filter(p => p.claimId === claim.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const outstanding = claimAmount - paidAmount;
    if (outstanding <= 0) return;

    // Calculate age in days
    const claimDate = new Date(claim.periodStart);
    const ageInDays = Math.floor((now.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));

    // Assign to bucket
    if (ageInDays <= 30) {
      buckets[0].count++;
      buckets[0].amount += outstanding;
    } else if (ageInDays <= 60) {
      buckets[1].count++;
      buckets[1].amount += outstanding;
    } else if (ageInDays <= 90) {
      buckets[2].count++;
      buckets[2].amount += outstanding;
    } else {
      buckets[3].count++;
      buckets[3].amount += outstanding;
    }
  });

  return buckets;
}

/**
 * Calculate performance score for a provider (0-100)
 */
export function calculatePerformanceScore(
  collectionRate: number,
  avgDaysToPayment: number
): number {
  // Collection rate contributes 70% of score
  const collectionScore = Math.min(collectionRate, 100) * 0.7;
  
  // Payment speed contributes 30% (inverse relationship - faster is better)
  // Assume ideal is 30 days or less
  const speedScore = avgDaysToPayment <= 30 
    ? 30 
    : Math.max(0, 30 - (avgDaysToPayment - 30) * 0.2);
  
  return Math.round(collectionScore + speedScore);
}

/**
 * Calculate trend percentage change
 */
export function calculateTrendPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Calculate summary metrics from claims and payments
 */
export function calculateSummaryMetrics(
  claims: Array<{ claimedAmount: number | string }>,
  payments: Array<{ amount: number | string }>
) {
  const totalBilled = claims.reduce((sum, c) => sum + Number(c.claimedAmount), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = totalBilled - totalCollected;
  const collectionRate = calculateCollectionRate(totalBilled, totalCollected);

  return {
    totalBilled,
    totalCollected,
    outstanding,
    collectionRate,
  };
}
