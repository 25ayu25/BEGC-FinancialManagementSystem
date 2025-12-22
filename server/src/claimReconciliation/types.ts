// server/src/claimReconciliation/types.ts

export interface ClaimRow {
  memberNumber: string;
  patientName?: string;

  /**
   * Some rows may rely on invoice matching and may not have a usable date.
   * (We still strongly prefer having it when available.)
   */
  serviceDate?: Date;

  /**
   * CIC "Invoice No" (this is the key that matches remittance "BILL NO")
   */
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

  /**
   * BAHR remittance "BILL NO" (this is what matches ClaimRow.invoiceNumber)
   */
  billNo?: string;

  /**
   * BAHR remittance "CLAIM NO" (often a DP... id; useful for reference, not best for matching)
   */
  claimNumber?: string;

  relationship?: string;

  /**
   * Some remittance rows may not have a parseable date;
   * matching should still work via billNo/invoiceNumber.
   */
  serviceDate?: Date;

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
  status:
    | "awaiting_remittance"
    | "matched"
    | "paid"
    | "partially_paid"
    | "unpaid"
    | "manual_review";
  // Track how the match was made
  matchMethod?: "invoice" | "date_amount" | "manual" | null;
}

export interface ReconciliationSummary {
  totalClaims: number;
  totalRemittances: number;
  autoMatched: number;
  partialMatched: number;
  manualReview: number;
}
