/**
 * useDailyInsurance Hook
 * 
 * Provides CRUD operations for daily insurance data (claims and payments)
 * USD-only, all operations use credentials: 'include'
 */

import React, { useState, useCallback } from "react";

interface Provider {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Claim {
  id: string;
  providerId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  currency: "USD";
  claimedAmount: number;
  status: "submitted" | "partially_paid" | "paid";
  notes?: string | null;
  createdAt?: string;
}

interface Payment {
  id: string;
  providerId: string;
  claimId?: string | null;
  paymentDate?: string | null;
  amount: number;
  currency: "USD";
  reference?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

interface CreateClaimInput {
  providerId: string;
  periodStart: string;
  periodEnd: string;
  claimedAmount: number;
  notes?: string;
}

interface UpdateClaimInput {
  claimedAmount?: number;
  status?: "submitted" | "partially_paid" | "paid";
  notes?: string;
}

interface CreatePaymentInput {
  providerId: string;
  claimId?: string;
  paymentDate: string;
  amount: number;
  reference?: string;
  notes?: string;
}

interface UpdatePaymentInput {
  paymentDate?: string;
  amount?: number;
  reference?: string;
  notes?: string;
}

interface DailyInsuranceData {
  providers: Provider[];
  claims: Claim[];
  payments: Payment[];
  loading: boolean;
  error: string | null;
}

interface DailyInsuranceActions {
  // Claims
  createClaim: (input: CreateClaimInput) => Promise<Claim>;
  updateClaim: (id: string, input: UpdateClaimInput) => Promise<Claim>;
  deleteClaim: (id: string) => Promise<void>;
  
  // Payments
  createPayment: (input: CreatePaymentInput) => Promise<Payment>;
  updatePayment: (id: string, input: UpdatePaymentInput) => Promise<Payment>;
  deletePayment: (id: string) => Promise<void>;
  
  // Utility
  refetch: () => Promise<void>;
}

type UseDailyInsuranceReturn = DailyInsuranceData & DailyInsuranceActions;

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
  
  const res = await fetch(toUrl(path), { 
    credentials: "include", 
    ...init, 
    headers 
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(txt || res.statusText || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  
  return res.json();
}

/**
 * Hook for managing daily insurance data with full CRUD operations
 * @param filters - Optional date range filters
 */
export function useDailyInsurance(filters?: {
  startDate?: string;
  endDate?: string;
  providers?: string[];
}): UseDailyInsuranceReturn {
  const [data, setData] = useState<DailyInsuranceData>({
    providers: [],
    claims: [],
    payments: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Build query params (NO currency=USD, filter client-side)
      const params = new URLSearchParams();
      if (filters?.startDate) params.set("start", filters.startDate);
      if (filters?.endDate) params.set("end", filters.endDate);
      if (filters?.providers && filters.providers.length > 0) {
        params.set("providers", filters.providers.join(","));
      }

      // Fetch all data in parallel
      const [providersRes, claimsRes, paymentsRes] = await Promise.all([
        api<Provider[]>("/api/insurance-providers"),
        api<Claim[]>(`/api/insurance-claims?${params}`),
        api<Payment[]>(`/api/insurance-payments?${params}`),
      ]);

      // Client-side USD filtering
      const filteredClaims = (Array.isArray(claimsRes) ? claimsRes : [])
        .filter(c => c.currency === "USD")
        .map(c => ({
          ...c,
          claimedAmount: Number(c.claimedAmount),
        }));

      const filteredPayments = (Array.isArray(paymentsRes) ? paymentsRes : [])
        .filter(p => p.currency === "USD")
        .map(p => ({
          ...p,
          amount: Number(p.amount),
        }));

      setData({
        providers: Array.isArray(providersRes) ? providersRes : [],
        claims: filteredClaims,
        payments: filteredPayments,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error("Error fetching daily insurance data:", err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to fetch data",
      }));
    }
  }, [filters]);

  // CRUD Operations

  const createClaim = useCallback(async (input: CreateClaimInput): Promise<Claim> => {
    const claim = await api<Claim>("/api/insurance-claims", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        currency: "USD",
        status: "submitted",
      }),
    });

    // Update local state
    setData(prev => ({
      ...prev,
      claims: [...prev.claims, { ...claim, claimedAmount: Number(claim.claimedAmount) }],
    }));

    return claim;
  }, []);

  const updateClaim = useCallback(async (id: string, input: UpdateClaimInput): Promise<Claim> => {
    const claim = await api<Claim>(`/api/insurance-claims/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });

    // Update local state
    setData(prev => ({
      ...prev,
      claims: prev.claims.map(c => 
        c.id === id ? { ...claim, claimedAmount: Number(claim.claimedAmount) } : c
      ),
    }));

    return claim;
  }, []);

  const deleteClaim = useCallback(async (id: string): Promise<void> => {
    await api(`/api/insurance-claims/${id}`, {
      method: "DELETE",
    });

    // Update local state
    setData(prev => ({
      ...prev,
      claims: prev.claims.filter(c => c.id !== id),
    }));
  }, []);

  const createPayment = useCallback(async (input: CreatePaymentInput): Promise<Payment> => {
    const payment = await api<Payment>("/api/insurance-payments", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        currency: "USD",
      }),
    });

    // Update local state
    setData(prev => ({
      ...prev,
      payments: [...prev.payments, { ...payment, amount: Number(payment.amount) }],
    }));

    return payment;
  }, []);

  const updatePayment = useCallback(async (id: string, input: UpdatePaymentInput): Promise<Payment> => {
    const payment = await api<Payment>(`/api/insurance-payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });

    // Update local state
    setData(prev => ({
      ...prev,
      payments: prev.payments.map(p => 
        p.id === id ? { ...payment, amount: Number(payment.amount) } : p
      ),
    }));

    return payment;
  }, []);

  const deletePayment = useCallback(async (id: string): Promise<void> => {
    await api(`/api/insurance-payments/${id}`, {
      method: "DELETE",
    });

    // Update local state
    setData(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== id),
    }));
  }, []);

  // Initial fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    createClaim,
    updateClaim,
    deleteClaim,
    createPayment,
    updatePayment,
    deletePayment,
    refetch: fetchData,
  };
}
