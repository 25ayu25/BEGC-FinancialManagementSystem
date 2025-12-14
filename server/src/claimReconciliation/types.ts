// server/src/claimReconciliation/types.ts

export interface ClaimRow {
  memberNumber: string;
  patientName?: string;
  serviceDate: Date;
  invoiceNumber?: string;
  claimType?: string;
  schemeName?: string;
  benefitDesc?: string;
  billedAmount: number;
  currency?: string;
}

export interface RemittanceRow {
  employerName?: string;
  patientName?: string;
  memberNumber: string;
  claimNumber?: string;
  relationship?: string;
  serviceDate: Date;
  claimAmount: number;
  paidAmount: number;
  paymentNo?: string;
  paymentMode?: string;
}

export interface MatchResult {
  claimId: number;
  remittanceId: number | null;
  matchType: "exact" | "partial" | "none";
  amountPaid: number;
  status: "awaiting_remittance" | "matched" | "paid" | "partially_paid" | "unpaid" | "manual_review";
}

export interface ReconciliationSummary {
  totalClaims: number;
  totalRemittances: number;
  autoMatched: number;
  partialMatched: number;
  manualReview: number;
}
