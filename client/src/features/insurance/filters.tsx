import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type InsuranceMode = "period" | "payment" | "asof";

export interface InsuranceFilters {
  // Mode:
  mode: InsuranceMode; // "period" (month range), "payment" (date range), "asof" (single month snapshot)

  // Period mode (claims/balances by claim month):
  fromMonth?: string; // "YYYY-MM"
  toMonth?: string;   // "YYYY-MM"

  // Payment mode (payments by exact date):
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"

  // Common:
  providerId?: string; // "ALL" or specific ID as string
  status?: "" | "submitted" | "partially_paid" | "paid";
}

type Ctx = {
  filters: InsuranceFilters;
  setFilters: (next: Partial<InsuranceFilters>) => void;
};

const FilterCtx = createContext<Ctx | null>(null);

// --- URL helpers (no router dependency) ---
function readInitialFromUrl(): InsuranceFilters {
  const sp = new URLSearchParams(window.location.search);
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const thisMonth = `${yyyy}-${mm}`;

  const mode = (sp.get("mode") as InsuranceMode) || "period";
  return {
    mode,
    fromMonth: sp.get("from") || thisMonth,
    toMonth: sp.get("to") || thisMonth,
    startDate: sp.get("start") || "",
    endDate: sp.get("end") || "",
    providerId: sp.get("providerId") || sp.get("provider") || "ALL",
    status: (sp.get("status") as any) || "",
  };
}

function writeToUrl(f: InsuranceFilters) {
  const p = new URLSearchParams();
  p.set("mode", f.mode);

  if (f.mode === "period" || f.mode === "asof") {
    if (f.fromMonth) p.set("from", f.fromMonth);
    if (f.mode === "period" && f.toMonth) p.set("to", f.toMonth);
  }
  if (f.mode === "payment") {
    if (f.startDate) p.set("start", f.startDate);
    if (f.endDate) p.set("end", f.endDate);
  }
  if (f.providerId && f.providerId !== "ALL") p.set("providerId", f.providerId);
  if (f.status) p.set("status", f.status);

  const qs = p.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  window.history.replaceState(null, "", url);
}

// --- Public helpers you can reuse in the page when calling the API ---
export function monthToStartISO(yyyyMm: string): string {
  // "2025-10" -> "2025-10-01"
  return `${yyyyMm}-01`;
}
export function monthToEndExclusiveISO(yyyyMm: string): string {
  // "2025-10" -> first day of next month (exclusive end)
  const [y, m] = yyyyMm.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const d = new Date(Date.UTC(ny, nm - 1, 1));
  return d.toISOString().slice(0, 10);
}

// --- Provider + hook ---
export function InsuranceFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<InsuranceFilters>(readInitialFromUrl);

  // keep URL in sync with state
  useEffect(() => {
    writeToUrl(filters);
  }, [filters]);

  // update state if user presses back/forward
  useEffect(() => {
    const onPop = () => setFiltersState(readInitialFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setFilters = useCallback((next: Partial<InsuranceFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo(() => ({ filters, setFilters }), [filters, setFilters]);

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>;
}

export function useInsuranceFilters() {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error("useInsuranceFilters must be used within InsuranceFilterProvider");
  return ctx;
}
