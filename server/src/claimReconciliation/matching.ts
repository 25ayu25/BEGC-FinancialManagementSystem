// server/src/claimReconciliation/matching.ts

import type { ClaimRow, RemittanceRow, MatchResult } from "./types";

/**
 * Generate a composite key for matching
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
  
  // Build a map of remittances by composite key
  const remitMap = new Map<string, Array<{ id: number; data: RemittanceRow }>>();
  for (const rem of remittances) {
    const existing = remitMap.get(rem.compositeKey) || [];
    existing.push(rem);
    remitMap.set(rem.compositeKey, existing);
  }

  // Match each claim
  for (const claim of claims) {
    const matchingRemits = remitMap.get(claim.compositeKey) || [];
    
    if (matchingRemits.length === 0) {
      // No match
      results.push({
        claimId: claim.id,
        remittanceId: null,
        matchType: "none",
        amountPaid: 0,
        status: "submitted",
      });
      continue;
    }

    // Try to find exact amount match
    const claimAmount = normalizeAmount(claim.data.billedAmount);
    let exactMatch = matchingRemits.find(
      (r) => normalizeAmount(r.data.paidAmount) === claimAmount
    );

    if (exactMatch) {
      // Exact match
      results.push({
        claimId: claim.id,
        remittanceId: exactMatch.id,
        matchType: "exact",
        amountPaid: exactMatch.data.paidAmount,
        status: "paid",
      });
      // Remove from map to avoid duplicate matching
      const arr = remitMap.get(claim.compositeKey)!;
      const idx = arr.indexOf(exactMatch);
      if (idx > -1) arr.splice(idx, 1);
    } else {
      // Partial match - sum all matching remittances
      const totalPaid = matchingRemits.reduce(
        (sum, r) => sum + r.data.paidAmount,
        0
      );
      const normalizedTotal = normalizeAmount(totalPaid);

      if (normalizedTotal > 0 && normalizedTotal < claimAmount) {
        // Partially paid
        results.push({
          claimId: claim.id,
          remittanceId: matchingRemits[0].id, // Link to first remittance
          matchType: "partial",
          amountPaid: totalPaid,
          status: "partially_paid",
        });
      } else if (normalizedTotal >= claimAmount) {
        // Overpaid or exact (after summing)
        results.push({
          claimId: claim.id,
          remittanceId: matchingRemits[0].id,
          matchType: normalizedTotal === claimAmount ? "exact" : "partial",
          amountPaid: totalPaid,
          status: "paid",
        });
      } else {
        // Manual review needed
        results.push({
          claimId: claim.id,
          remittanceId: matchingRemits[0].id,
          matchType: "partial",
          amountPaid: totalPaid,
          status: "manual_review",
        });
      }
    }
  }

  return results;
}
