/**
 * Custom hook for fetching and managing insurance overview data
 */

import { useState, useEffect, useCallback } from "react";
import type { AdvancedFilters } from "./useAdvancedFilters";

interface Provider {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Claim {
  id: string;
  providerId: string;
  providerName?: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  currency: "USD" | "SSP";
  claimedAmount: number | string;
  status: string;
  notes?: string | null;
  createdAt?: string;
}

interface Payment {
  id: string;
  providerId: string;
  providerName?: string;
  claimId?: string | null;
  paymentDate?: string | null;
  amount: number | string;
  currency: "USD" | "SSP";
  reference?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

interface OverviewData {
  providers: Provider[];
  claims: Claim[];
  payments: Payment[];
}

const RAW_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  (typeof window !== "undefined" && (window as any).__API_URL__) ||
  "";

function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(RAW_BASE || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const backup = localStorage.getItem("user_session_backup");
    if (backup) headers.set("x-session-token", backup);
  }
  const res = await fetch(toUrl(path), { credentials: "include", ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(txt || res.statusText || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

export function useInsuranceOverview(filters: AdvancedFilters) {
  const [data, setData] = useState<OverviewData>({
    providers: [],
    claims: [],
    payments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (filters.startDate) params.set("start", filters.startDate);
      if (filters.endDate) params.set("end", filters.endDate);
      if (filters.providers.length > 0) {
        params.set("providers", filters.providers.join(","));
      }

      // Fetch all data in parallel from USD-only endpoints
      const [providersRes, claimsRes, paymentsRes] = await Promise.all([
        api<Provider[]>("/api/insurance-providers"),
        api<Claim[]>(`/api/insurance-claims?${params}&currency=USD`),
        api<Payment[]>(`/api/insurance-payments?${params}&currency=USD`),
      ]);

      // Apply additional client-side filtering
      // Filter USD only (double-check server-side filtering)
      let filteredClaims = (Array.isArray(claimsRes) ? claimsRes : []).filter(c => c.currency === "USD");
      let filteredPayments = (Array.isArray(paymentsRes) ? paymentsRes : []).filter(p => p.currency === "USD");

      // Amount filters
      if (filters.minAmount !== undefined) {
        filteredClaims = filteredClaims.filter(
          c => Number(c.claimedAmount) >= filters.minAmount!
        );
        filteredPayments = filteredPayments.filter(
          p => Number(p.amount) >= filters.minAmount!
        );
      }
      if (filters.maxAmount !== undefined) {
        filteredClaims = filteredClaims.filter(
          c => Number(c.claimedAmount) <= filters.maxAmount!
        );
        filteredPayments = filteredPayments.filter(
          p => Number(p.amount) <= filters.maxAmount!
        );
      }

      // Status filters
      if (filters.statuses.length > 0) {
        filteredClaims = filteredClaims.filter(c =>
          filters.statuses.includes(c.status as any)
        );
      }

      // Search text
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        filteredClaims = filteredClaims.filter(
          c =>
            c.notes?.toLowerCase().includes(search) ||
            c.providerName?.toLowerCase().includes(search)
        );
        filteredPayments = filteredPayments.filter(
          p =>
            p.notes?.toLowerCase().includes(search) ||
            p.reference?.toLowerCase().includes(search) ||
            p.providerName?.toLowerCase().includes(search)
        );
      }

      // High value filter (>10000 USD)
      if (filters.highValueOnly) {
        filteredClaims = filteredClaims.filter(c => Number(c.claimedAmount) > 10000);
        filteredPayments = filteredPayments.filter(p => Number(p.amount) > 10000);
      }

      // Recent filter (last 7 days)
      if (filters.recentOnly) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filteredClaims = filteredClaims.filter(c => {
          const date = c.createdAt || c.periodStart;
          return new Date(date) >= sevenDaysAgo;
        });
        filteredPayments = filteredPayments.filter(p => {
          const date = p.paymentDate || p.createdAt;
          return date && new Date(date) >= sevenDaysAgo;
        });
      }

      // Overdue filter (claims older than 30 days without full payment)
      if (filters.overdueOnly) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filteredClaims = filteredClaims.filter(c => {
          if (c.status === "paid") return false;
          return new Date(c.periodStart) < thirtyDaysAgo;
        });
      }

      setData({
        providers: Array.isArray(providersRes) ? providersRes : [],
        claims: filteredClaims,
        payments: filteredPayments,
      });
    } catch (err: any) {
      console.error("Error fetching insurance overview data:", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
