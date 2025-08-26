export const DEPARTMENTS = {
  CON: { name: "Consultation", code: "CON" },
  LAB: { name: "Laboratory", code: "LAB" },
  ULTRASOUND: { name: "Ultrasound", code: "ULTRASOUND" },
  XRAY: { name: "X-Ray", code: "XRAY" },
  PHARMACY: { name: "Pharmacy", code: "PHARMACY" },
  OTHER: { name: "Other", code: "OTHER" },
} as const;

// Insurance providers are now loaded from the database via API
// No more hardcoded list to avoid inconsistencies

export const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  SSP: { symbol: "SSP", name: "South Sudanese Pound" },
} as const;

export const EXPENSE_CATEGORIES = [
  "Clinic Operations",
  "Doctor Payments", 
  "Lab Tech Payments",
  "Radiographer Payments",
  "Insurance Payments",
  "Staff Salaries",
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
  "other"
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
