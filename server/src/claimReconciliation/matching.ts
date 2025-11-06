// server/src/claimReconciliation/matching.ts

import type { ClaimRow, RemittanceRow, MatchResult } from "./types";

/**
 * Normalize a member number: remove whitespace, uppercase
 */
const normalizeMember = (m: string) =>
  m.trim().replace(/\s+/g, "").toUpperCase();

/**
 * Normalize a date into YYYY-MM-DD
 */
const normalizeDate = (d: Date | string) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10); // e.g. "2025-08-03"
};

/**
 * Convert to integer cents
 */
const toCents = (amount: number) => Math.round(amount * 100);

/**
 * For claims table: single canonical composite key
 */
export function buildClaimCompositeKey(
  memberNumber: string,
  serviceDate: Date | string,
  billedAmount: number
): string {
  return [
    normalizeMember(memberNumber),
    normalizeDate(serviceDate),
    toCents(billedAmount).toString(),
  ].join("|");
}

/**
 * For remittance lines: generate several key variants with small
 * ±1–2 currency unit tolerance to account for rounding / small changes.
 */
export function buildRemittanceKeyVariants(
  memberNumber: string,
  serviceDate: Date | string,
  claimAmount: number
): string[] {
  const member = normalizeMember(memberNumber);
  const date = normalizeDate(serviceDate);
  const baseCents = toCents(claimAmount);

  // 0, ±1, ±2 units of currency (in cents)
  const deltas = [0, 100, -100, 200, -200];

  return deltas.map((delta) =>
    [member, date, (baseCents + delta).toString()].join("|")
  );
}

/**
 * Legacy function - kept for backward compatibility but deprecated
 * @deprecated Use buildClaimCompositeKey instead
 */
export function generateCompositeKey(
  memberNumber: string,
  serviceDate: Date
): string {
  const dateStr = serviceDate.toISOString().split("T")[0]; // YYYY-MM-DD
  return `${memberNumber.trim().toLowerCase()}_${dateStr}`;
}

/**
 * Normalize amount for comparison (handle floating point precision)
 */
function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Match claims against remittances
 */
export function matchClaimsToRemittances(
  claims: Array<{ id: number; data: ClaimRow; compositeKey: string }>,
  remittances: Array<{ id: number; data: RemittanceRow; compositeKey: string }>
): MatchResult[] {
  const results: MatchResult[] = [];
  
  // Build a map of claims by composite key for efficient lookup
  const claimMap = new Map<string, { id: number; data: ClaimRow }>();
  for (const claim of claims) {
    claimMap.set(claim.compositeKey, claim);
  }

  // Track which claims have been matched to avoid duplicates
  const matchedClaims = new Set<number>();

  // Match each remittance to claims using key variants
  for (const rem of remittances) {
    // Generate key variants for this remittance
    const keyVariants = buildRemittanceKeyVariants(
      rem.data.memberNumber,
      rem.data.serviceDate,
      rem.data.claimAmount
    );

    // Try to find a matching claim using any of the key variants
    let matchedClaim: { id: number; data: ClaimRow } | undefined;
    for (const key of keyVariants) {
      const claim = claimMap.get(key);
      if (claim && !matchedClaims.has(claim.id)) {
        matchedClaim = claim;
        break;
      }
    }

    if (matchedClaim) {
      matchedClaims.add(matchedClaim.id);
      
      const claimAmount = normalizeAmount(matchedClaim.data.billedAmount);
      const paidAmount = normalizeAmount(rem.data.paidAmount);

      // Determine match status based on amounts
      let status: "submitted" | "paid" | "partially_paid" | "manual_review";
      let matchType: "exact" | "partial" | "none";

      if (paidAmount === claimAmount) {
        // Exact match
        status = "paid";
        matchType = "exact";
      } else if (paidAmount >= claimAmount) {
        // Overpaid (still considered paid)
        status = "paid";
        matchType = "partial";
      } else if (paidAmount > 0 && paidAmount < claimAmount) {
        // Partially paid
        status = "partially_paid";
        matchType = "partial";
      } else {
        // Manual review needed
        status = "manual_review";
        matchType = "partial";
      }

      results.push({
        claimId: matchedClaim.id,
        remittanceId: rem.id,
        matchType,
        amountPaid: rem.data.paidAmount,
        status,
      });
    }
  }

  // Add unmatched claims
  for (const claim of claims) {
    if (!matchedClaims.has(claim.id)) {
      results.push({
        claimId: claim.id,
        remittanceId: null,
        matchType: "none",
        amountPaid: 0,
        status: "submitted",
      });
    }
  }

  return results;
}
