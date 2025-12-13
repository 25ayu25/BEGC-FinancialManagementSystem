// client/src/lib/constants.ts

/* ---------------- Domain constants (unchanged) ---------------- */

export const DEPARTMENTS = {
  CON: { name: "Consultation", code: "CON" },
  LAB: { name: "Laboratory", code: "LAB" },
  ULTRASOUND: { name: "Ultrasound", code: "ULTRASOUND" },
  XRAY: { name: "X-Ray", code: "XRAY" },
  PHARMACY: { name: "Pharmacy", code: "PHARMACY" },
  PHARMACY_SR: { name: "Pharmacy - Station Road", code: "PHARMACY_SR" },
} as const;

export const INSURANCE_PROVIDERS = {
  CIC: { name: "CIC", code: "CIC" },
  UAP: { name: "UAP", code: "UAP" },
  CIGNA: { name: "CIGNA", code: "CIGNA" },
  NEW_SUDAN: { name: "New Sudan", code: "NEW_SUDAN" },
  AMANAH: { name: "Amanah", code: "AMANAH" },
  ALIMA: { name: "ALIMA", code: "ALIMA" },
  NILE_INTERNATIONAL: { name: "Nile International", code: "NILE" },
  OTHER: { name: "Other", code: "OTHER" },
} as const;

export const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  SSP: { symbol: "SSP", name: "South Sudanese Pound" },
} as const;

export const EXPENSE_CATEGORIES = [
  "Clinic Operations",
  "Doctor Payments",
  "Lab Tech Payments",
  "Radiographer Payments",
  "Fuel",
  "Staff Salaries",
  "Insurance Payments",
  "Drugs Purchased",
  "Lab Reagents",
  "Equipment",
  "Landlord",
  "Sono Papers",
  "X-Ray films",
  "Utilities",
  "Other",
] as const;

export const STAFF_TYPES = [
  "doctor",
  "lab_tech",
  "radiographer",
  "nurse",
  "admin",
  "other",
] as const;

export const SYNC_STATUS = {
  PENDING: "pending",
  SYNCED: "synced",
  FAILED: "failed",
} as const;

export const REPORT_STATUS = {
  DRAFT: "draft",
  APPROVED: "approved",
  LOCKED: "locked",
} as const;

/* ---------------- API base URL (updated) ---------------- */

/**
 * Proxy mode:
 * - When VITE_USE_API_PROXY === "true", the app should call the API via same-origin paths like:
 *   /api/dashboard, /api/transactions, /api/insurance/...
 * - We will use this flag in queryClient.ts and api-insurance-lab.ts to avoid cross-site auth issues on Vercel.
 */
export const USE_API_PROXY: boolean =
  String((import.meta as any)?.env?.VITE_USE_API_PROXY ?? "").toLowerCase() ===
  "true";

/**
 * Where the frontend will send API requests (when NOT using proxy mode).
 * - Uses VITE_API_URL if provided at build time (Netlify/Vercel env).
 * - Back-compat: also reads VITE_API_BASE_URL.
 * - Falls back to localhost:5000 for local dev, or the code.run URL in prod.
 */
const FALLBACK_PROD_API =
  "https://site--financial-management--2rbpdlgj47wb.code.run";
const FALLBACK_DEV_API = "http://localhost:5000";

function normalizeBaseUrl(url?: string) {
  if (!url) return "";
  return String(url).trim().replace(/\/+$/, "");
}

export const API_BASE_URL: string = (() => {
  const fromEnv =
    (import.meta as any)?.env?.VITE_API_URL ??
    (import.meta as any)?.env?.VITE_API_BASE_URL;

  const chosen = normalizeBaseUrl(
    typeof fromEnv === "string" ? fromEnv : undefined
  );
  if (chosen) return chosen;

  // SSR / static render fallback (treat as prod)
  if (typeof window === "undefined") return FALLBACK_PROD_API;

  // Local dev vs deployed
  const host = window.location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");

  return isLocal ? FALLBACK_DEV_API : FALLBACK_PROD_API;
})();

// Helpful at boot to confirm where requests go
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[CFG] USE_API_PROXY =", USE_API_PROXY);
  // eslint-disable-next-line no-console
  console.log("[CFG] API base URL =", API_BASE_URL);
}
