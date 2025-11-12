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

/* ---------------- API base URL (new) ---------------- */

/**
 * Where the frontend will send API requests.
 * - Uses VITE_API_BASE_URL if provided at build time.
 * - Falls back to localhost:5000 for local dev, or the Render URL in prod.
 */
const FALLBACK_PROD_API = "https://bgc-financialmanagementsystem.onrender.com";
const FALLBACK_DEV_API = "http://localhost:5000";

export const API_BASE_URL: string = (() => {
  const fromEnv = (import.meta as any)?.env?.VITE_API_BASE_URL;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();

  if (typeof window === "undefined") return FALLBACK_PROD_API;

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");

  return isLocal ? FALLBACK_DEV_API : FALLBACK_PROD_API;
})();

// Helpful at boot to confirm where requests go
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[CFG] API base URL =", API_BASE_URL);
}
