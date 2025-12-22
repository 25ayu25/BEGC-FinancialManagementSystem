// server/src/claimReconciliation/matching.ts

import type { ClaimRow, RemittanceRow, MatchResult } from "./types";

/** Prevent Excel artifacts like "644472.0" from turning into "6444720" */
function stripExcelZeroDecimals(input: unknown): string {
  const s = String(input ?? "").trim().replace(/,/g, "");
  if (!s) return "";
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

/**
 * Normalize a member number:
 * - uppercase
 * - remove whitespace and punctuation (so CS012160-00 === CS01216000)
 */
const normalizeMember = (m: unknown) =>
  stripExcelZeroDecimals(m).toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Normalize invoice/bill numbers:
 * Keep alphanumerics only, uppercase, trim.
 */
const normalizeInvoice = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = stripExcelZeroDecimals(v);
  if (!s) return null;
  const cleaned = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned ? cleaned : null;
};

/**
 * Normalize a date into YYYY-MM-DD (best effort)
 */
const normalizeDate = (d: Date | string) => {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

/**
 * Convert to integer cents (best effort)
 */
const toCents = (amount: number) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

/**
 * Try to read an invoice-like field from a claim row.
 */
function getClaimInvoice(row: any): string | null {
  return (
    normalizeInvoice(row?.invoiceNumber) ??
    normalizeInvoice(row?.invoiceNo) ??
    normalizeInvoice(row?.invoice) ??
    normalizeInvoice(row?.billNo) ??
    normalizeInvoice(row?.billNumber) ??
    normalizeInvoice(row?.bill) ??
    null
  );
}

/**
 * Remittance: return candidates in priority order.
 * IMPORTANT: prefer BILL NO (matches CIC Invoice No) before CLAIM NO.
 */
function getRemittanceBillCandidates(row: any): string[] {
  const candidates = [
    row?.billNo,        // ✅ FIRST
    row?.billNumber,
    row?.invoiceNumber,
    row?.invoiceNo,
    row?.invoice,
    row?.claimNumber,   // fallback
    row?.claimNo,
    row?.claim,
  ];

  const out: string[] = [];
  for (const c of candidates) {
    const v = normalizeInvoice(c);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Build a match key from an entire claim row.
 * Best: member + invoice/bill number.
 * Fallback: member + serviceDate + billedAmount.
 */
export function buildClaimCompositeKeyFromRow(
  row: Partial<ClaimRow> & any
): string {
  const member = normalizeMember((row as any)?.memberNumber ?? "");
  const inv = getClaimInvoice(row);

  if (inv) return `${member}|INV:${inv}`;

  const date = normalizeDate((row as any)?.serviceDate ?? "");
  const cents = toCents(Number((row as any)?.billedAmount ?? 0));
  return `${member}|DATE:${date}|AMT:${cents}`;
}

/**
 * Build key variants from an entire remittance row.
 * Best: member + bill/invoice (may include both billNo and claimNumber as variants)
 * Fallback: member + serviceDate + claimAmount with ±1–2 currency unit tolerance.
 */
export function buildRemittanceKeyVariantsFromRow(
  row: Partial<RemittanceRow> & any
): string[] {
  const member = normalizeMember((row as any)?.memberNumber ?? "");
  const bills = getRemittanceBillCandidates(row);

  if (bills.length) return bills.map((b) => `${member}|INV:${b}`);

  const date = normalizeDate((row as any)?.serviceDate ?? "");
  const baseCents = toCents(Number((row as any)?.claimAmount ?? 0));
  const deltas = [0, 100, -100, 200, -200];

  return deltas.map((delta) => `${member}|DATE:${date}|AMT:${baseCents + delta}`);
}

export function buildClaimCompositeKey(
  memberNumber: string,
  serviceDate: Date | string,
  billedAmount: number
): string {
  return buildClaimCompositeKeyFromRow({ memberNumber, serviceDate, billedAmount } as any);
}

export function buildRemittanceKeyVariants(
  memberNumber: string,
  serviceDate: Date | string,
  claimAmount: number
): string[] {
  return buildRemittanceKeyVariantsFromRow({ memberNumber, serviceDate, claimAmount } as any);
}

/**
 * Normalize amount for comparison (handle floating point precision)
 */
function normalizeAmount(amount: number): number {
  return Math.round(Number(amount) * 100) / 100;
}

/**
 * Match claims against remittances using hybrid matching strategy:
 * 1. Primary: Invoice-based matching (memberNumber + invoice/bill number)
 * 2. Secondary: Date+Amount matching (memberNumber + exact date + exact amount) with 1-to-1 enforcement
 */
export function matchClaimsToRemittances(
  claims: Array<{ id: number; data: ClaimRow; compositeKey: string }>,
  remittances: Array<{ id: number; data: RemittanceRow; compositeKey: string }>
): MatchResult[] {
  const results: MatchResult[] = [];
  const matchedClaims = new Set<number>();
  const matchedRemittances = new Set<number>();

  // PHASE 1: PRIMARY INVOICE-BASED MATCHING
  // Build claim lookup by invoice key: memberNumber + invoice number
  const claimsByInvoiceKey = new Map<string, Array<{ id: number; data: ClaimRow }>>();
  
  for (const claim of claims) {
    const member = normalizeMember((claim.data as any)?.memberNumber ?? "");
    const inv = getClaimInvoice(claim.data as any);
    
    if (inv) {
      const key = `${member}|INV:${inv}`;
      const arr = claimsByInvoiceKey.get(key) ?? [];
      arr.push({ id: claim.id, data: claim.data });
      claimsByInvoiceKey.set(key, arr);
    }
  }

  // Match remittances using invoice/bill number
  for (const rem of remittances) {
    if (matchedRemittances.has(rem.id)) continue;
    
    const member = normalizeMember((rem.data as any)?.memberNumber ?? "");
    const bills = getRemittanceBillCandidates(rem.data as any);
    
    let matchedClaim: { id: number; data: ClaimRow } | undefined;
    
    // Try each bill number candidate
    for (const bill of bills) {
      const key = `${member}|INV:${bill}`;
      const bucket = claimsByInvoiceKey.get(key);
      if (!bucket || bucket.length === 0) continue;
      
      // Skip already matched claims in this bucket
      while (bucket.length > 0 && matchedClaims.has(bucket[0].id)) bucket.shift();
      
      if (bucket.length > 0) {
        matchedClaim = bucket.shift();
        break;
      }
    }
    
    if (matchedClaim) {
      matchedClaims.add(matchedClaim.id);
      matchedRemittances.add(rem.id);
      
      const claimAmount = normalizeAmount((matchedClaim.data as any).billedAmount ?? 0);
      const paidAmount = normalizeAmount((rem.data as any).paidAmount ?? 0);
      
      const { status, matchType } = determineMatchStatus(claimAmount, paidAmount);
      
      results.push({
        claimId: matchedClaim.id,
        remittanceId: rem.id,
        matchType,
        amountPaid: Number((rem.data as any).paidAmount ?? 0),
        status,
        matchMethod: "invoice",
      });
    }
  }

  // PHASE 2: SECONDARY DATE+AMOUNT MATCHING (with 1-to-1 enforcement)
  // Build claim lookup by date+amount key for unmatched claims
  const claimsByDateAmountKey = new Map<string, Array<{ id: number; data: ClaimRow }>>();
  
  for (const claim of claims) {
    if (matchedClaims.has(claim.id)) continue; // Skip already matched
    
    const member = normalizeMember((claim.data as any)?.memberNumber ?? "");
    const date = normalizeDate((claim.data as any)?.serviceDate ?? "");
    const cents = toCents(Number((claim.data as any)?.billedAmount ?? 0));
    
    if (date) {
      const key = `${member}|DATE:${date}|AMT:${cents}`;
      const arr = claimsByDateAmountKey.get(key) ?? [];
      arr.push({ id: claim.id, data: claim.data });
      claimsByDateAmountKey.set(key, arr);
    }
  }

  // Match unmatched remittances using date+amount (exact match only)
  for (const rem of remittances) {
    if (matchedRemittances.has(rem.id)) continue; // Skip already matched
    
    const member = normalizeMember((rem.data as any)?.memberNumber ?? "");
    const date = normalizeDate((rem.data as any)?.serviceDate ?? "");
    const cents = toCents(Number((rem.data as any)?.claimAmount ?? 0));
    
    if (!date) continue; // Need valid date for this match method
    
    const key = `${member}|DATE:${date}|AMT:${cents}`;
    const bucket = claimsByDateAmountKey.get(key);
    
    // CRITICAL: Only match if there's EXACTLY ONE unmatched claim for this key
    // This enforces 1-to-1 matching and prevents ambiguous matches
    if (bucket && bucket.length === 1 && !matchedClaims.has(bucket[0].id)) {
      const matchedClaim = bucket[0];
      matchedClaims.add(matchedClaim.id);
      matchedRemittances.add(rem.id);
      
      const claimAmount = normalizeAmount((matchedClaim.data as any).billedAmount ?? 0);
      const paidAmount = normalizeAmount((rem.data as any).paidAmount ?? 0);
      
      const { status, matchType } = determineMatchStatus(claimAmount, paidAmount);
      
      results.push({
        claimId: matchedClaim.id,
        remittanceId: rem.id,
        matchType,
        amountPaid: Number((rem.data as any).paidAmount ?? 0),
        status,
        matchMethod: "date_amount",
      });
    }
    // If bucket.length > 1, it's ambiguous - leave unmatched for manual review
    // If bucket.length === 0 or claim already matched, skip
  }

  // PHASE 3: Handle unmatched claims
  // Keep unmatched claims as "awaiting_remittance"
  for (const claim of claims) {
    if (!matchedClaims.has(claim.id)) {
      const currentStatus = (claim.data as any)?.status;
      
      results.push({
        claimId: claim.id,
        remittanceId: null,
        matchType: "none",
        amountPaid: 0,
        // Preserve existing status if it's already set, otherwise "awaiting_remittance"
        status: (currentStatus as any) ?? "awaiting_remittance",
        matchMethod: null,
      });
    }
  }

  return results;
}

/**
 * Determine match status based on claim and paid amounts
 */
function determineMatchStatus(
  claimAmount: number,
  paidAmount: number
): { status: MatchResult["status"]; matchType: "exact" | "partial" | "none" } {
  // STRICT STATUS RULES:
  // - matched AND paidAmount == billedAmount → "matched"/"paid"
  // - matched AND 0 < paidAmount < billedAmount → "partially_paid"
  // - matched AND paidAmount == 0 → "unpaid" (Not paid (0 paid))
  if (paidAmount === claimAmount && claimAmount > 0) {
    return { status: "matched", matchType: "exact" };
  } else if (paidAmount > 0 && paidAmount < claimAmount && claimAmount > 0) {
    return { status: "partially_paid", matchType: "partial" };
  } else if (paidAmount === 0 && claimAmount > 0) {
    // Claim is in the statement but with $0 paid
    return { status: "unpaid", matchType: "partial" };
  } else if (paidAmount > claimAmount && claimAmount > 0) {
    // Overpayment - mark as matched but flag for review
    return { status: "matched", matchType: "partial" };
  } else {
    return { status: "manual_review", matchType: "partial" };
  }
}
