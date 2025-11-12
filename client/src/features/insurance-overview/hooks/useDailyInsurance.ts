/**
 * Hook for fetching and aggregating daily insurance data
 * USD-only, client-side aggregation for performance with moderate datasets
 */

import { useState, useEffect, useCallback } from 'react';

export interface DailyInsuranceData {
  date: string; // YYYY-MM-DD
  providerId: string;
  providerName: string;
  amountUSD: number;
}

export interface DailyInsuranceFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  providerIds?: string[];
}

interface Payment {
  id: string;
  providerId: string;
  providerName?: string;
  paymentDate?: string | null;
  amount: number | string;
  currency: string;
  createdAt?: string | null;
}

interface Provider {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface UseDailyInsuranceReturn {
  data: DailyInsuranceData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  providers: Provider[];
}

const RAW_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  '';

function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(RAW_BASE || '').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('content-type', 'application/json');
  
  if (typeof window !== 'undefined') {
    const backup = localStorage.getItem('user_session_backup');
    if (backup) headers.set('x-session-token', backup);
  }
  
  const res = await fetch(toUrl(path), { credentials: 'include', ...init, headers });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(txt || res.statusText || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  
  return res.json();
}

/**
 * Aggregate payments by date and provider
 * Client-side aggregation for moderate datasets (<= 10k rows)
 * For larger datasets, recommend server-side aggregation endpoint
 */
function aggregateByDateAndProvider(
  payments: Payment[],
  providers: Provider[]
): DailyInsuranceData[] {
  // Create provider lookup map
  const providerMap = new Map<string, Provider>(
    providers.map(p => [p.id, p])
  );

  // Group by date and provider
  const aggregateMap = new Map<string, DailyInsuranceData>();

  payments.forEach(payment => {
    // Extract date from paymentDate or createdAt
    const dateStr = payment.paymentDate || payment.createdAt;
    if (!dateStr) return;

    // Parse date to YYYY-MM-DD format
    const date = new Date(dateStr);
    const dateKey = date.toISOString().split('T')[0];

    // Build unique key for date + provider
    const key = `${dateKey}:${payment.providerId}`;

    // Get or create aggregate entry
    if (!aggregateMap.has(key)) {
      const provider = providerMap.get(payment.providerId);
      aggregateMap.set(key, {
        date: dateKey,
        providerId: payment.providerId,
        providerName: provider?.name || payment.providerName || 'Unknown Provider',
        amountUSD: 0,
      });
    }

    // Add amount
    const entry = aggregateMap.get(key)!;
    entry.amountUSD += Number(payment.amount);
  });

  // Convert map to array and sort by date (newest first)
  return Array.from(aggregateMap.values()).sort((a, b) => {
    return b.date.localeCompare(a.date);
  });
}

/**
 * Custom hook to fetch and aggregate daily insurance payment data
 * 
 * Features:
 * - Fetches payments within date range
 * - Filters for USD-only (client-side to avoid 500s)
 * - Aggregates by date and provider
 * - Client-side filtering for performance
 * 
 * @param filters - Date range and provider filters
 * @returns Daily aggregated data, loading state, error, and refetch function
 */
export function useDailyInsurance(
  filters: DailyInsuranceFilters = {}
): UseDailyInsuranceReturn {
  const [data, setData] = useState<DailyInsuranceData[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params (no currency param to avoid 500s)
      const params = new URLSearchParams();
      if (filters.startDate) params.set('start', filters.startDate);
      if (filters.endDate) params.set('end', filters.endDate);

      // Fetch payments and providers in parallel
      const [paymentsRes, providersRes] = await Promise.all([
        api<Payment[]>(`/api/insurance-payments?${params}`),
        api<Provider[]>('/api/insurance-providers'),
      ]);

      // Filter for USD only (client-side)
      let filteredPayments = (Array.isArray(paymentsRes) ? paymentsRes : [])
        .filter(p => p.currency === 'USD');

      // Apply provider filter if specified
      if (filters.providerIds && filters.providerIds.length > 0) {
        const providerSet = new Set(filters.providerIds);
        filteredPayments = filteredPayments.filter(p => providerSet.has(p.providerId));
      }

      // Aggregate by date and provider
      const aggregated = aggregateByDateAndProvider(
        filteredPayments,
        Array.isArray(providersRes) ? providersRes : []
      );

      setData(aggregated);
      setProviders(Array.isArray(providersRes) ? providersRes : []);
    } catch (err: any) {
      console.error('Error fetching daily insurance data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.providerIds?.join(',')]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    providers,
  };
}
