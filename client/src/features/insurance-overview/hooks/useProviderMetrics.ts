/**
 * Custom hook for calculating provider-specific metrics
 */

import { useMemo } from "react";
import {
  calculateCollectionRate,
  calculateAverageDaysToPayment,
  calculateAgingBuckets,
  calculatePerformanceScore,
} from "../utils/calculations";

interface Claim {
  id: string;
  providerId: string;
  periodStart: string;
  claimedAmount: number | string;
  status: string;
}

interface Payment {
  id: string;
  providerId: string;
  claimId?: string | null;
  paymentDate?: string | null;
  amount: number | string;
  createdAt?: string | null;
}

interface Provider {
  id: string;
  code: string;
  name: string;
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number;
  avgDaysToPayment: number;
  performanceScore: number;
  agingBuckets: ReturnType<typeof calculateAgingBuckets>;
}

export function useProviderMetrics(
  providers: Provider[],
  claims: Claim[],
  payments: Payment[]
) {
  const metrics = useMemo(() => {
    const result: ProviderMetrics[] = [];

    providers.forEach(provider => {
      const providerClaims = claims.filter(c => c.providerId === provider.id);
      const providerPayments = payments.filter(p => p.providerId === provider.id);

      const totalBilled = providerClaims.reduce(
        (sum, c) => sum + Number(c.claimedAmount),
        0
      );
      const totalCollected = providerPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const outstanding = totalBilled - totalCollected;
      const collectionRate = calculateCollectionRate(totalBilled, totalCollected);
      const avgDaysToPayment = calculateAverageDaysToPayment(
        providerClaims,
        providerPayments
      );
      const performanceScore = calculatePerformanceScore(
        collectionRate,
        avgDaysToPayment
      );
      const agingBuckets = calculateAgingBuckets(providerClaims, providerPayments);

      result.push({
        providerId: provider.id,
        providerName: provider.name,
        totalBilled,
        totalCollected,
        outstanding,
        collectionRate,
        avgDaysToPayment,
        performanceScore,
        agingBuckets,
      });
    });

    return result;
  }, [providers, claims, payments]);

  return {
    metrics,
    loading: false,
  };
}
