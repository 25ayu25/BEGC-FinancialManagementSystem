// server/src/claimReconciliation/matching.ts

import type { ClaimRow, RemittanceRow, MatchResult } from "./types";

/**
 * Normalize a member number:
 * - uppercase
 * - remove whitespace and punctuation (so CS012160-00 === CS01216000)
 */
const normalizeMember = (m: string) =>
  (m || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Normalize invoice/bill numbers:
 * Keep alphanumerics only, uppercase, trim.
 */
const normalizeInvoice = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
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
 * Try to read a bill/invoice-like field from a remittance row.
 * IMPORTANT: CIC commonly stores the bill/invoice under claimNumber.
 */
function getRemittanceBill(row: any): string | null {
  return (
    normalizeInvoice(row?.claimNumber) ??   // ✅ ADDED
    normalizeInvoice(row?.claimNo) ??       // ✅ ADDED
    normalizeInvoice(row?.claim) ??         // ✅ ADDED
    normalizeInvoice(row?.billNo) ??
    normalizeInvoice(row?.billNumber) ??
    normalizeInvoice(row?.bill) ??
    normalizeInvoice(row?.invoiceNumber) ??
    normalizeInvoice(row?.invoiceNo) ??
    normalizeInvoice(row?.invoice) ??
    null
  );
}

/**
 * Build a match key from an entire claim row.
 * CIC best practice: member + invoice/bill number.
 * Fallback: member + serviceDate + billedAmount.
 */
export function buildClaimCompositeKeyFromRow(row: Partial<ClaimRow> & any): string {
  const member = normalizeMember((row as any)?.memberNumber ?? "");
  const inv = getClaimInvoice(row);

  if (inv) return `${member}|INV:${inv}`;

  const date = normalizeDate((row as any)?.serviceDate ?? "");
  const cents = toCents(Number((row as any)?.billedAmount ?? 0));
  return `${member}|DATE:${date}|AMT:${cents}`;
}

/**
 * Build key variants from an entire remittance row.
 * CIC best practice: member + bill number.
 * Fallback: member + serviceDate + claimAmount with ±1–2 currency unit tolerance.
 */
export function buildRemittanceKeyVariantsFromRow(row: Partial<RemittanceRow> & any): string[] {
  const member = normalizeMember((row as any)?.memberNumber ?? "");
  const bill = getRemittanceBill(row);

  if (bill) return [`${member}|INV:${bill}`];

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
 * Match claims against remittances
 */
export function matchClaimsToRemittances(
  claims: Array<{ id: number; data: ClaimRow; compositeKey: string }>,
  remittances: Array<{ id: number; data: RemittanceRow; compositeKey: string }>
): MatchResult[] {
  const results: MatchResult[] = [];

  const claimMap = new Map<string, { id: number; data: ClaimRow }>();
  for (const claim of claims) claimMap.set(claim.compositeKey, { id: claim.id, data: claim.data });

  const matchedClaims = new Set<number>();

  for (const rem of remittances) {
    const keyVariants = buildRemittanceKeyVariantsFromRow(rem.data as any);

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

      const claimAmount = normalizeAmount((matchedClaim.data as any).billedAmount ?? 0);
      const paidAmount = normalizeAmount((rem.data as any).paidAmount ?? 0);

      let status:
        | "awaiting_remittance"
        | "matched"
        | "paid"
        | "partially_paid"
        | "unpaid"
        | "manual_review";
      let matchType: "exact" | "partial" | "none";

      if (paidAmount === claimAmount && claimAmount > 0) {
        status = "matched";
        matchType = "exact";
      } else if (paidAmount > claimAmount && claimAmount > 0) {
        status = "matched";
        matchType = "partial";
      } else if (paidAmount > 0 && paidAmount < claimAmount) {
        status = "partially_paid";
        matchType = "partial";
      } else if (paidAmount === 0 && claimAmount > 0) {
        status = "unpaid";
        matchType = "partial";
      } else {
        status = "manual_review";
        matchType = "partial";
      }

      results.push({
        claimId: matchedClaim.id,
        remittanceId: rem.id,
        matchType,
        amountPaid: Number((rem.data as any).paidAmount ?? 0),
        status,
      });
    }
  }

  // Keep unmatched claims as-is (do NOT flip to unpaid automatically)
  for (const claim of claims) {
    if (!matchedClaims.has(claim.id)) {
      const currentStatus = (claim.data as any)?.status;

      results.push({
        claimId: claim.id,
        remittanceId: null,
        matchType: "none",
        amountPaid: 0,
        status: (currentStatus as any) ?? "awaiting_remittance",
      });
    }
  }

  return results;
}
