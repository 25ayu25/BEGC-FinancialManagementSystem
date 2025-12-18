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
 * Match claims against remittances
 */
export function matchClaimsToRemittances(
  claims: Array<{ id: number; data: ClaimRow; compositeKey: string }>,
  remittances: Array<{ id: number; data: RemittanceRow; compositeKey: string }>
): MatchResult[] {
  const results: MatchResult[] = [];

  // ✅ Handle duplicates: map key -> queue of claims
  const claimMap = new Map<string, Array<{ id: number; data: ClaimRow }>>();
  for (const claim of claims) {
    const arr = claimMap.get(claim.compositeKey) ?? [];
    arr.push({ id: claim.id, data: claim.data });
    claimMap.set(claim.compositeKey, arr);
  }

  const matchedClaims = new Set<number>();

  for (const rem of remittances) {
    const keyVariants = buildRemittanceKeyVariantsFromRow(rem.data as any);

    let matchedClaim: { id: number; data: ClaimRow } | undefined;

    for (const key of keyVariants) {
      const bucket = claimMap.get(key);
      if (!bucket || bucket.length === 0) continue;

      // skip already matched in this bucket
      while (bucket.length > 0 && matchedClaims.has(bucket[0].id)) bucket.shift();

      if (bucket.length > 0) {
        matchedClaim = bucket.shift(); // ✅ consume one claim
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

      // STRICT STATUS RULES (Requirement 4):
      // - matched AND paidAmount == billedAmount → "matched"/"paid"
      // - matched AND 0 < paidAmount < billedAmount → "partially_paid"
      // - matched AND paidAmount == 0 → "unpaid" (Not paid (0 paid))
      if (paidAmount === claimAmount && claimAmount > 0) {
        status = "matched";
        matchType = "exact";
      } else if (paidAmount > 0 && paidAmount < claimAmount && claimAmount > 0) {
        status = "partially_paid";
        matchType = "partial";
      } else if (paidAmount === 0 && claimAmount > 0) {
        // Claim is in the statement but with $0 paid
        status = "unpaid";
        matchType = "partial";
      } else if (paidAmount > claimAmount && claimAmount > 0) {
        // Overpayment - mark as matched but flag for review
        status = "matched";
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

  // CRITICAL (Requirement 4): Keep unmatched claims as "awaiting_remittance"
  // If claim NOT matched to any statement line → status must remain "awaiting_remittance"
  // DO NOT mark unmatched as "unpaid"
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
      });
    }
  }

  return results;
}
