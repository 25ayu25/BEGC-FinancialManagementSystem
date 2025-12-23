// server/src/claimReconciliation/service.ts

import { db } from "../../../server/db";
import {
  claimReconRuns,
  claimReconClaims,
  claimReconRemittances,
  claimReconRunClaims,
} from "@shared/schema";
import { eq, and, or, isNull, desc, inArray, sql, count } from "drizzle-orm";
import type { ClaimRow, RemittanceRow, ReconciliationSummary } from "./types";
import {
  buildClaimCompositeKeyFromRow,
  buildRemittanceKeyVariantsFromRow,
  matchClaimsToRemittances,
} from "./matching";

function normalizeCurrencyForProvider(providerName: string, currency?: string | null) {
  const p = (providerName || "").toUpperCase();
  if (p === "CIC") return "USD";
  return currency || "USD";
}

const OUTSTANDING_CLAIM_STATUSES = [
  "awaiting_remittance",
  "unpaid",
  "partially_paid",
  "manual_review",
  "submitted",
] as const;

function isRemittanceRun(run: any) {
  return (run?.totalRemittanceRows ?? 0) > 0;
}

function isValidDate(d: any): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Create a new reconciliation run
 */
export async function createReconRun(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  createdBy: string
) {
  const [run] = await db
    .insert(claimReconRuns)
    .values({
      providerName,
      periodYear,
      periodMonth,
      createdBy,
    })
    .returning();

  return run;
}

/**
 * Get actual counts from persisted tables for audit-proof metrics
 * @param runId - The ID of the reconciliation run
 * @returns Object containing totalClaimRows and totalRemittanceRows counts
 * @throws Error if runId is invalid or database query fails
 */
export async function getActualRunCounts(runId: number) {
  // Execute queries in parallel for better performance
  const [claimCountResult, remittanceCountResult] = await Promise.all([
    // Count claims actually processed in this run (from join table)
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(claimReconRunClaims)
      .where(eq(claimReconRunClaims.runId, runId))
      .then(result => result[0]),
    
    // Count remittances for this run
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(claimReconRemittances)
      .where(eq(claimReconRemittances.runId, runId))
      .then(result => result[0]),
  ]);

  return {
    totalClaimRows: claimCountResult.count,
    totalRemittanceRows: remittanceCountResult.count,
  };
}

export async function updateReconRunMetrics(
  runId: number,
  metrics: Partial<{
    totalClaimRows: number;
    totalRemittanceRows: number;
    autoMatched: number;
    partialMatched: number;
    manualReview: number;
    unpaidCount: number;
  }>
) {
  await db
    .update(claimReconRuns)
    .set(metrics as any)
    .where(eq(claimReconRuns.id, runId));
}

/**
 * Insert parsed claims (legacy - for backward compatibility)
 */
export async function insertClaims(runId: number, claims: ClaimRow[]) {
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  if (!run) throw new Error(`Run ${runId} not found`);

  const claimsToInsert = claims
    .filter((c) => isValidDate(c.serviceDate))
    .map((claim) => ({
      runId,
      providerName: run.providerName,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      memberNumber: claim.memberNumber,
      patientName: claim.patientName || null,
      serviceDate: toISODate(claim.serviceDate),
      invoiceNumber: claim.invoiceNumber || null,
      claimType: claim.claimType || null,
      schemeName: claim.schemeName || null,
      benefitDesc: claim.benefitDesc || null,
      billedAmount: claim.billedAmount.toString(),
      currency: normalizeCurrencyForProvider(run.providerName, claim.currency),
      status: "submitted" as const,
      amountPaid: "0",
      compositeKey: buildClaimCompositeKeyFromRow({
        memberNumber: claim.memberNumber,
        invoiceNumber: claim.invoiceNumber,
        serviceDate: claim.serviceDate,
        billedAmount: claim.billedAmount,
      } as any),
      rawRow: claim as any,
    }));

  const inserted = await db.insert(claimReconClaims).values(claimsToInsert).returning();
  return inserted;
}

/**
 * Insert parsed remittances (legacy - for backward compatibility)
 */
export async function insertRemittances(runId: number, remittances: RemittanceRow[]) {
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  if (!run) throw new Error(`Run ${runId} not found`);

  const remittancesToInsert = remittances
    .filter((r) => isValidDate(r.serviceDate))
    .map((rem) => {
      const keyVariants = buildRemittanceKeyVariantsFromRow({
        memberNumber: rem.memberNumber,
        billNo: rem.billNo, // ✅ IMPORTANT
        claimNumber: rem.claimNumber,
        serviceDate: rem.serviceDate,
        claimAmount: rem.claimAmount,
      } as any);

      return {
        runId,
        providerName: run.providerName,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        employerName: rem.employerName || null,
        patientName: rem.patientName || null,
        memberNumber: rem.memberNumber,
        billNo: rem.billNo || null, // ✅ STORE
        claimNumber: rem.claimNumber || null,
        relationship: rem.relationship || null,
        serviceDate: toISODate(rem.serviceDate),
        claimAmount: rem.claimAmount.toString(),
        paidAmount: rem.paidAmount.toString(),
        paymentNo: rem.paymentNo || null,
        paymentMode: rem.paymentMode || null,
        compositeKey: keyVariants[0],
        rawRow: rem as any,
      };
    });

  const inserted = await db
    .insert(claimReconRemittances)
    .values(remittancesToInsert)
    .returning();

  return inserted;
}

/**
 * Perform matching and update claims/remittances (legacy run-based)
 */
export async function performMatching(runId: number) {
  const claims = await db
    .select()
    .from(claimReconClaims)
    .where(eq(claimReconClaims.runId, runId));

  const remittances = await db
    .select()
    .from(claimReconRemittances)
    .where(eq(claimReconRemittances.runId, runId));

  const claimData = claims.map((c) => ({
    id: c.id,
    compositeKey: buildClaimCompositeKeyFromRow({
      memberNumber: c.memberNumber,
      invoiceNumber: c.invoiceNumber,
      serviceDate: new Date(c.serviceDate),
      billedAmount: parseFloat(c.billedAmount),
      status: c.status,
    } as any),
    data: {
      memberNumber: c.memberNumber,
      patientName: c.patientName || undefined,
      serviceDate: new Date(c.serviceDate),
      invoiceNumber: c.invoiceNumber || undefined,
      claimType: c.claimType || undefined,
      schemeName: c.schemeName || undefined,
      benefitDesc: c.benefitDesc || undefined,
      billedAmount: parseFloat(c.billedAmount),
      currency: c.currency,
      status: c.status as any,
    } as any,
  }));

  const remitData = remittances.map((r) => ({
    id: r.id,
    compositeKey: buildRemittanceKeyVariantsFromRow({
      memberNumber: r.memberNumber,
      billNo: r.billNo,
      claimNumber: r.claimNumber,
      serviceDate: new Date(r.serviceDate),
      claimAmount: parseFloat(r.claimAmount),
    } as any)[0],
    data: {
      employerName: r.employerName || undefined,
      patientName: r.patientName || undefined,
      memberNumber: r.memberNumber,
      billNo: r.billNo || undefined,
      claimNumber: r.claimNumber || undefined,
      relationship: r.relationship || undefined,
      serviceDate: new Date(r.serviceDate),
      claimAmount: parseFloat(r.claimAmount),
      paidAmount: parseFloat(r.paidAmount),
      paymentNo: r.paymentNo || undefined,
      paymentMode: r.paymentMode || undefined,
    } as any,
  }));

  const matches = matchClaimsToRemittances(claimData, remitData);

  // Track status before updates for run claims join table
  const claimStatusBefore = new Map(claims.map(c => [c.id, c.status]));
  let unpaidCount = 0;

  for (const match of matches) {
    if (!match.remittanceId) continue;

    await db
      .update(claimReconClaims)
      .set({
        status: match.status,
        amountPaid: match.amountPaid.toString(),
        remittanceLineId: match.remittanceId,
        matchMethod: match.matchMethod || null,
      })
      .where(eq(claimReconClaims.id, match.claimId));

    await db
      .update(claimReconRemittances)
      .set({
        matchedClaimId: match.claimId,
        matchType: match.matchType,
      })
      .where(eq(claimReconRemittances.id, match.remittanceId));
  }

  // Record all claims processed in this run (Issue 1 fix) - Batch insert for performance
  const runClaimsToInsert = matches.map(match => {
    const statusBefore = claimStatusBefore.get(match.claimId);
    const statusAfter = match.status;
    
    // Count unpaid claims (Issue 2)
    if (statusAfter === "unpaid") {
      unpaidCount++;
    }

    return {
      runId,
      claimId: match.claimId,
      statusBeforeRun: statusBefore || null,
      statusAfterRun: statusAfter,
      matchedRemittanceId: match.remittanceId || null,
      matchType: match.matchType || "unmatched",
      amountPaidInRun: match.amountPaid.toString(),
      matchMethod: match.matchMethod || null,
    };
  });

  if (runClaimsToInsert.length > 0) {
    await db.insert(claimReconRunClaims).values(runClaimsToInsert);
  }

  const matchedOnly = matches.filter((m) => m.remittanceId !== null);

  const summary: ReconciliationSummary = {
    totalClaims: claims.length,
    totalRemittances: remittances.length,
    autoMatched: matchedOnly.filter((m) => m.matchType === "exact").length,
    partialMatched: matchedOnly.filter((m) => m.matchType === "partial").length,
    manualReview: matchedOnly.filter((m) => m.status === "manual_review").length,
  };

  // Get actual counts from persisted rows (audit-proof)
  const actualCounts = await getActualRunCounts(runId);

  await db
    .update(claimReconRuns)
    .set({
      totalClaimRows: actualCounts.totalClaimRows, // COUNT from claim_recon_run_claims
      totalRemittanceRows: actualCounts.totalRemittanceRows, // COUNT from claim_recon_remittances
      autoMatched: summary.autoMatched,
      partialMatched: summary.partialMatched,
      manualReview: summary.manualReview,
      unpaidCount,
    })
    .where(eq(claimReconRuns.id, runId));

  return summary;
}

export async function getReconRun(runId: number) {
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  return run;
}

export async function getAllReconRuns() {
  return await db.select().from(claimReconRuns).orderBy(desc(claimReconRuns.createdAt));
}

/**
 * ISSUE 1 FIX: Get claims that were actually processed in this specific run
 * Uses the join table to return exactly the claims that were considered during the run
 */
export async function getClaimsForRun(runId: number) {
  // First check if we have run claims recorded in the join table (new approach)
  const runClaimsFromJoinTable = await db
    .select({
      id: claimReconClaims.id,
      memberNumber: claimReconClaims.memberNumber,
      patientName: claimReconClaims.patientName,
      serviceDate: claimReconClaims.serviceDate,
      invoiceNumber: claimReconClaims.invoiceNumber,
      claimType: claimReconClaims.claimType,
      schemeName: claimReconClaims.schemeName,
      benefitDesc: claimReconClaims.benefitDesc,
      billedAmount: claimReconClaims.billedAmount,
      currency: claimReconClaims.currency,
      status: claimReconClaims.status,
      amountPaid: claimReconClaims.amountPaid,
      remittanceLineId: claimReconClaims.remittanceLineId,
      matchMethod: claimReconClaims.matchMethod,
      compositeKey: claimReconClaims.compositeKey,
      runId: claimReconClaims.runId,
      providerName: claimReconClaims.providerName,
      periodYear: claimReconClaims.periodYear,
      periodMonth: claimReconClaims.periodMonth,
      rawRow: claimReconClaims.rawRow,
      createdAt: claimReconClaims.createdAt,
    })
    .from(claimReconRunClaims)
    .innerJoin(claimReconClaims, eq(claimReconRunClaims.claimId, claimReconClaims.id))
    .where(eq(claimReconRunClaims.runId, runId));

  if (runClaimsFromJoinTable.length > 0) return runClaimsFromJoinTable;

  // Fallback to legacy behavior for old runs (before join table was added)
  const runClaims = await db
    .select()
    .from(claimReconClaims)
    .where(eq(claimReconClaims.runId, runId));

  if (runClaims.length > 0) return runClaims;

  const run = await getReconRun(runId);
  if (!run) return [];

  if (isRemittanceRun(run)) {
    return await db
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, run.providerName),
          inArray(claimReconClaims.status as any, OUTSTANDING_CLAIM_STATUSES as any)
        )
      );
  }

  const staged = await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, run.providerName),
        eq(claimReconClaims.periodYear, run.periodYear),
        eq(claimReconClaims.periodMonth, run.periodMonth),
        isNull(claimReconClaims.runId)
      )
    );

  if (staged.length > 0) return staged;

  return await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, run.providerName),
        eq(claimReconClaims.periodYear, run.periodYear),
        eq(claimReconClaims.periodMonth, run.periodMonth)
      )
    );
}

export async function getRemittancesForRun(runId: number) {
  const runRemits = await db
    .select()
    .from(claimReconRemittances)
    .where(eq(claimReconRemittances.runId, runId));

  if (runRemits.length > 0) return runRemits;

  const run = await getReconRun(runId);
  if (!run) return [];

  const staged = await db
    .select()
    .from(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, run.providerName),
        eq(claimReconRemittances.periodYear, run.periodYear),
        eq(claimReconRemittances.periodMonth, run.periodMonth),
        isNull(claimReconRemittances.runId)
      )
    );

  if (staged.length > 0) return staged;

  return await db
    .select()
    .from(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, run.providerName),
        eq(claimReconRemittances.periodYear, run.periodYear),
        eq(claimReconRemittances.periodMonth, run.periodMonth)
      )
    );
}

export async function getIssueClaimsForRun(runId: number) {
  const runIssues = await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.runId, runId),
        or(
          eq(claimReconClaims.status, "partially_paid"),
          eq(claimReconClaims.status, "manual_review"),
          eq(claimReconClaims.status, "submitted")
        )
      )
    );

  if (runIssues.length > 0) return runIssues;

  const run = await getReconRun(runId);
  if (!run) return [];

  if (isRemittanceRun(run)) {
    return await db
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, run.providerName),
          inArray(claimReconClaims.status as any, OUTSTANDING_CLAIM_STATUSES as any)
        )
      );
  }

  const staged = await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, run.providerName),
        eq(claimReconClaims.periodYear, run.periodYear),
        eq(claimReconClaims.periodMonth, run.periodMonth),
        isNull(claimReconClaims.runId)
      )
    );

  const base =
    staged.length > 0
      ? staged
      : await db
          .select()
          .from(claimReconClaims)
          .where(
            and(
              eq(claimReconClaims.providerName, run.providerName),
              eq(claimReconClaims.periodYear, run.periodYear),
              eq(claimReconClaims.periodMonth, run.periodMonth)
            )
          );

  return base.filter((c: any) =>
    ["awaiting_remittance", "unpaid", "partially_paid", "manual_review", "submitted"].includes(c.status)
  );
}

export async function deleteReconRun(runId: number) {
  await db.transaction(async (tx) => {
    // Step 1: Nullify matched_remittance_id in claim_recon_run_claims
    // This breaks the FK reference to remittances, preventing FK violations
    // Defense in depth: code + DB constraint (ON DELETE SET NULL)
    await tx
      .update(claimReconRunClaims)
      .set({ matchedRemittanceId: null })
      .where(eq(claimReconRunClaims.runId, runId));

    // Step 2: Delete remittances for this run
    // Safe now that all FK references are nullified
    await tx.delete(claimReconRemittances).where(eq(claimReconRemittances.runId, runId));
    
    // Step 3: Delete claims for this run
    // Explicit for predictable execution (would cascade from step 4 via runId FK)
    await tx.delete(claimReconClaims).where(eq(claimReconClaims.runId, runId));
    
    // Step 4: Delete the run
    // claimReconRunClaims will cascade via runId FK (claims already deleted above)
    await tx.delete(claimReconRuns).where(eq(claimReconRuns.id, runId));
  });

  return { success: true };
}

/* -------------------------------------------------------------------------- */
/* Staged Workflow Functions                                                  */
/* -------------------------------------------------------------------------- */

export async function upsertClaimsForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  claims: ClaimRow[]
) {
  return await db.transaction(async (tx) => {
    await tx
      .delete(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          eq(claimReconClaims.periodYear, periodYear),
          eq(claimReconClaims.periodMonth, periodMonth),
          isNull(claimReconClaims.runId)
        )
      );

    const claimsToInsert = claims
      .filter((c) => isValidDate(c.serviceDate))
      .map((claim) => ({
        runId: null,
        providerName,
        periodYear,
        periodMonth,
        memberNumber: claim.memberNumber,
        patientName: claim.patientName || null,
        serviceDate: toISODate(claim.serviceDate),
        invoiceNumber: claim.invoiceNumber || null,
        claimType: claim.claimType || null,
        schemeName: claim.schemeName || null,
        benefitDesc: claim.benefitDesc || null,
        billedAmount: claim.billedAmount.toString(),
        currency: normalizeCurrencyForProvider(providerName, claim.currency),
        status: "awaiting_remittance" as const,
        amountPaid: "0",
        compositeKey: buildClaimCompositeKeyFromRow({
          memberNumber: claim.memberNumber,
          invoiceNumber: claim.invoiceNumber,
          serviceDate: claim.serviceDate,
          billedAmount: claim.billedAmount,
          status: "awaiting_remittance",
        } as any),
        rawRow: claim as any,
      }));

    return await tx.insert(claimReconClaims).values(claimsToInsert).returning();
  });
}

/**
 * Stores a remittance statement under provider + (filing) period.
 */
export async function upsertRemittanceForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  remittances: RemittanceRow[]
) {
  return await db.transaction(async (tx) => {
    await tx
      .delete(claimReconRemittances)
      .where(
        and(
          eq(claimReconRemittances.providerName, providerName),
          eq(claimReconRemittances.periodYear, periodYear),
          eq(claimReconRemittances.periodMonth, periodMonth),
          isNull(claimReconRemittances.runId)
        )
      );

    const toInsert = remittances
      .filter((r) => isValidDate(r.serviceDate))
      .map((rem) => {
        const keyVariants = buildRemittanceKeyVariantsFromRow({
          memberNumber: rem.memberNumber,
          billNo: rem.billNo, // ✅ IMPORTANT
          claimNumber: rem.claimNumber,
          serviceDate: rem.serviceDate,
          claimAmount: rem.claimAmount,
        } as any);

        return {
          runId: null,
          providerName,
          periodYear,
          periodMonth,
          employerName: rem.employerName || null,
          patientName: rem.patientName || null,
          memberNumber: rem.memberNumber,
          billNo: rem.billNo || null, // ✅ STORE
          claimNumber: rem.claimNumber || null,
          relationship: rem.relationship || null,
          serviceDate: toISODate(rem.serviceDate),
          claimAmount: rem.claimAmount.toString(),
          paidAmount: rem.paidAmount.toString(),
          paymentNo: rem.paymentNo || null,
          paymentMode: rem.paymentMode || null,
          compositeKey: keyVariants[0],
          matchedClaimId: null,
          matchType: null,
          status: null,
          rawRow: rem as any,
        };
      });

    if (toInsert.length === 0) {
      throw new Error("No valid remittance rows found (invalid/missing serviceDate)");
    }

    return await tx.insert(claimReconRemittances).values(toInsert).returning();
  });
}

export async function getClaimsForPeriod(providerName: string, periodYear: number, periodMonth: number) {
  const staged = await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, providerName),
        eq(claimReconClaims.periodYear, periodYear),
        eq(claimReconClaims.periodMonth, periodMonth),
        isNull(claimReconClaims.runId)
      )
    );

  if (staged.length > 0) return staged;

  return await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, providerName),
        eq(claimReconClaims.periodYear, periodYear),
        eq(claimReconClaims.periodMonth, periodMonth)
      )
    );
}

export async function getRemittanceForPeriod(providerName: string, periodYear: number, periodMonth: number) {
  const staged = await db
    .select()
    .from(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, providerName),
        eq(claimReconRemittances.periodYear, periodYear),
        eq(claimReconRemittances.periodMonth, periodMonth),
        isNull(claimReconRemittances.runId)
      )
    );

  if (staged.length > 0) return staged;

  return await db
    .select()
    .from(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, providerName),
        eq(claimReconRemittances.periodYear, periodYear),
        eq(claimReconRemittances.periodMonth, periodMonth)
      )
    );
}

/**
 * Cross-period claim reconciliation
 */
export async function runClaimReconciliation(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  opts?: { runId?: number }
) {
  return await db.transaction(async (tx) => {
    const claims = await tx
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          inArray(claimReconClaims.status as any, OUTSTANDING_CLAIM_STATUSES as any)
        )
      );

    const remittances = opts?.runId
      ? await tx
          .select()
          .from(claimReconRemittances)
          .where(
            and(
              eq(claimReconRemittances.runId, opts.runId),
              isNull(claimReconRemittances.matchedClaimId)
            )
          )
      : await tx
          .select()
          .from(claimReconRemittances)
          .where(
            and(
              eq(claimReconRemittances.providerName, providerName),
              eq(claimReconRemittances.periodYear, periodYear),
              eq(claimReconRemittances.periodMonth, periodMonth),
              isNull(claimReconRemittances.matchedClaimId)
            )
          );

    if (claims.length === 0) throw new Error(`No outstanding claims found for ${providerName}`);
    if (remittances.length === 0) {
      throw new Error(
        `No NEW remittance lines found for ${providerName} for ${periodYear}-${String(periodMonth).padStart(2, "0")}`
      );
    }

    const claimData = claims.map((c) => ({
      id: c.id,
      compositeKey: buildClaimCompositeKeyFromRow({
        memberNumber: c.memberNumber,
        invoiceNumber: c.invoiceNumber,
        serviceDate: new Date(c.serviceDate),
        billedAmount: parseFloat(c.billedAmount),
        status: c.status,
      } as any),
      data: {
        memberNumber: c.memberNumber,
        patientName: c.patientName || undefined,
        serviceDate: new Date(c.serviceDate),
        invoiceNumber: c.invoiceNumber || undefined,
        claimType: c.claimType || undefined,
        schemeName: c.schemeName || undefined,
        benefitDesc: c.benefitDesc || undefined,
        billedAmount: parseFloat(c.billedAmount),
        currency: c.currency,
        status: c.status as any,
      } as any,
    }));

    const remitData = remittances.map((r) => ({
      id: r.id,
      compositeKey: buildRemittanceKeyVariantsFromRow({
        memberNumber: r.memberNumber,
        billNo: r.billNo,
        claimNumber: r.claimNumber,
        serviceDate: new Date(r.serviceDate),
        claimAmount: parseFloat(r.claimAmount),
      } as any)[0],
      data: {
        employerName: r.employerName || undefined,
        patientName: r.patientName || undefined,
        memberNumber: r.memberNumber,
        billNo: r.billNo || undefined,
        claimNumber: r.claimNumber || undefined,
        relationship: r.relationship || undefined,
        serviceDate: new Date(r.serviceDate),
        claimAmount: parseFloat(r.claimAmount),
        paidAmount: parseFloat(r.paidAmount),
        paymentNo: r.paymentNo || undefined,
        paymentMode: r.paymentMode || undefined,
      } as any,
    }));

    const matches = matchClaimsToRemittances(claimData, remitData);
    const matchedOnly = matches.filter((m) => m.remittanceId !== null);

    const matchedRemittanceIds = new Set<number>();
    
    // Track status before updates for run claims join table
    const claimStatusBefore = new Map(claims.map(c => [c.id, c.status]));
    let unpaidCount = 0;

    for (const match of matchedOnly) {
      matchedRemittanceIds.add(match.remittanceId as number);

      await tx
        .update(claimReconClaims)
        .set({
          status: match.status,
          amountPaid: match.amountPaid.toString(),
          remittanceLineId: match.remittanceId,
          matchMethod: match.matchMethod || null,
        })
        .where(eq(claimReconClaims.id, match.claimId));

      await tx
        .update(claimReconRemittances)
        .set({
          matchedClaimId: match.claimId,
          matchType: match.matchType,
          status: null,
        })
        .where(eq(claimReconRemittances.id, match.remittanceId as number));
    }

    // Record all claims processed in this run (Issue 1 fix) - Batch insert for performance
    // Only record if runId is provided (for new run tracking)
    if (opts?.runId && matches.length > 0) {
      const runClaimsToInsert = matches.map(match => {
        const statusBefore = claimStatusBefore.get(match.claimId);
        const statusAfter = match.status;
        
        // Count unpaid claims (Issue 2)
        if (statusAfter === "unpaid") {
          unpaidCount++;
        }

        return {
          runId: opts.runId,
          claimId: match.claimId,
          statusBeforeRun: statusBefore || null,
          statusAfterRun: statusAfter,
          matchedRemittanceId: match.remittanceId || null,
          matchType: match.matchType || "unmatched",
          amountPaidInRun: match.amountPaid.toString(),
          matchMethod: match.matchMethod || null,
        };
      });

      await tx.insert(claimReconRunClaims).values(runClaimsToInsert);
    }

    const orphanRemittances = remittances.filter((r) => !matchedRemittanceIds.has(r.id));
    for (const orphan of orphanRemittances) {
      await tx
        .update(claimReconRemittances)
        .set({
          status: "orphan_remittance",
          matchedClaimId: null,
          matchType: null,
        })
        .where(eq(claimReconRemittances.id, orphan.id));
    }

    // FIX: Do NOT mark unmatched claims as "unpaid"
    // Unmatched claims (no remittance line found) should remain as "awaiting_remittance"
    // Only claims with remittanceLineId AND amountPaid=0 should be marked "unpaid" (handled by matching logic)
    const matchedClaimIds = new Set(matchedOnly.map((m) => m.claimId));
    const unmatchedClaims = claims.filter((c) => !matchedClaimIds.has(c.id));

    const summary: ReconciliationSummary = {
      totalClaims: claims.length,
      totalRemittances: remittances.length,
      autoMatched: matchedOnly.filter((m) => m.matchType === "exact").length,
      partialMatched: matchedOnly.filter((m) => m.matchType === "partial").length,
      manualReview: matchedOnly.filter((m) => m.status === "manual_review").length,
    };

    return {
      summary,
      orphanRemittances: orphanRemittances.length,
      unpaidClaims: unmatchedClaims.length,
      unpaidCount, // Include for metrics update
      totalClaimsSearched: claims.length,
      claimsMatched: matchedOnly.length,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Claims inventory + periods summary                                         */
/* -------------------------------------------------------------------------- */

/**
 * Get all claims with filtering and pagination support.
 * 
 * IMPORTANT: This function is for VIEW-ONLY purposes (Claims Inventory UI).
 * Filters applied here DO NOT affect claim-remittance matching/reconciliation logic.
 * Matching is always performed across ALL outstanding claims regardless of filters.
 * 
 * @param options - Filter and pagination options
 * @param options.year - Filter by year (independent of month)
 * @param options.month - Filter by month (independent of year)
 * @param options.status - Filter by claim status
 * @param options.providerName - Filter by provider
 * @param options.page - Page number for pagination (default: 1)
 * @param options.limit - Items per page (default: 50)
 * @returns Claims with pagination info and summary counts for filtered view
 */
export async function getAllClaims(options?: {
  providerName?: string;
  status?: string;
  periodYear?: number;
  periodMonth?: number;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}) {
  const { 
    providerName, 
    status, 
    periodYear, 
    periodMonth,
    year,
    month,
    page = 1, 
    limit = 50,
  } = options || {};

  let query = db.select().from(claimReconClaims);

  const filters: any[] = [];
  if (providerName) filters.push(eq(claimReconClaims.providerName, providerName));
  if (status) filters.push(eq(claimReconClaims.status, status));
  
  // Support both old parameters (periodYear/periodMonth) and new ones (year/month)
  // for backward compatibility
  const finalYear = year ?? periodYear;
  const finalMonth = month ?? periodMonth;
  
  if (finalYear !== undefined) filters.push(eq(claimReconClaims.periodYear, finalYear));
  if (finalMonth !== undefined) filters.push(eq(claimReconClaims.periodMonth, finalMonth));

  if (filters.length > 0) query = (query.where(and(...filters)) as any);

  // Add sorting (default: serviceDate DESC)
  query = (query.orderBy(desc(claimReconClaims.serviceDate)) as any);

  const offset = (page - 1) * limit;
  const claims = await query.limit(limit).offset(offset);

  // Single query to get all counts using SQL CASE statements
  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  
  // Note: 'matched' and 'paid' are grouped together as they both represent fully paid claims
  // This matches the existing UI behavior where both statuses are treated equivalently
  // CRITICAL: Use COALESCE to ensure nulls become 0 when no rows match (prevents frontend crashes)
  const [countsResult] = await db
    .select({
      total: sql<number>`cast(count(*) as integer)`,
      awaiting_remittance: sql<number>`cast(coalesce(sum(case when ${claimReconClaims.status} = 'awaiting_remittance' then 1 else 0 end), 0) as integer)`,
      matched: sql<number>`cast(coalesce(sum(case when ${claimReconClaims.status} in ('matched', 'paid') then 1 else 0 end), 0) as integer)`,
      partially_paid: sql<number>`cast(coalesce(sum(case when ${claimReconClaims.status} = 'partially_paid' then 1 else 0 end), 0) as integer)`,
      unpaid: sql<number>`cast(coalesce(sum(case when ${claimReconClaims.status} = 'unpaid' then 1 else 0 end), 0) as integer)`,
    })
    .from(claimReconClaims)
    .where(whereClause);

  const total = countsResult.total;

  const summaryCounts = {
    total,
    awaiting_remittance: countsResult.awaiting_remittance ?? 0,
    matched: countsResult.matched ?? 0,
    partially_paid: countsResult.partially_paid ?? 0,
    unpaid: countsResult.unpaid ?? 0,
  };

  return {
    claims,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: summaryCounts,
  };
}

export async function deleteClaim(claimId: number) {
  await db.delete(claimReconClaims).where(eq(claimReconClaims.id, claimId));
  return { success: true };
}

export async function deleteClaimsForPeriod(providerName: string, periodYear: number, periodMonth: number) {
  await db
    .delete(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, providerName),
        eq(claimReconClaims.periodYear, periodYear),
        eq(claimReconClaims.periodMonth, periodMonth)
      )
    );
  return { success: true };
}

export async function deleteRemittancesForPeriod(providerName: string, periodYear: number, periodMonth: number) {
  await db
    .delete(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, providerName),
        eq(claimReconRemittances.periodYear, periodYear),
        eq(claimReconRemittances.periodMonth, periodMonth)
      )
    );
  return { success: true };
}

export async function getPeriodsSummary(providerName?: string) {
  // Helper to safely parse decimal values from database
  const parseDecimalValue = (value: string | number | null | undefined): number => {
    const val = parseFloat(String(value || '0'));
    return isNaN(val) ? 0 : val;
  };

  const filters = providerName ? [eq(claimReconClaims.providerName, providerName)] : [];

  let query = db.select({
    id: claimReconClaims.id,
    providerName: claimReconClaims.providerName,
    periodYear: claimReconClaims.periodYear,
    periodMonth: claimReconClaims.periodMonth,
    status: claimReconClaims.status,
    billedAmount: claimReconClaims.billedAmount,
    amountPaid: claimReconClaims.amountPaid,
    currency: claimReconClaims.currency,
  }).from(claimReconClaims);
  if (filters.length > 0) query = (query.where(and(...filters)) as any);

  const allClaims = await query;

  const periodMap = new Map<
    string,
    { periodYear: number; periodMonth: number; providerName: string; claims: typeof allClaims }
  >();

  for (const claim of allClaims) {
    const key = `${claim.providerName}-${claim.periodYear}-${claim.periodMonth}`;
    if (!periodMap.has(key)) {
      periodMap.set(key, {
        periodYear: claim.periodYear,
        periodMonth: claim.periodMonth,
        providerName: claim.providerName,
        claims: [],
      });
    }
    periodMap.get(key)!.claims.push(claim);
  }

  const summaries = Array.from(periodMap.values())
    .filter((period) => period.claims.length > 0)
    .map((period) => {
      const awaitingRemittance = period.claims.filter((c) => c.status === "awaiting_remittance").length;
      const matched = period.claims.filter((c) => c.status === "matched" || c.status === "paid").length;
      const partiallyPaid = period.claims.filter((c) => c.status === "partially_paid").length;
      const unpaid = period.claims.filter((c) => c.status === "unpaid").length;
      const manualReview = period.claims.filter((c) => c.status === "manual_review").length;

      const totalBilled = period.claims.reduce((sum, c) => sum + parseDecimalValue(c.billedAmount), 0);
      const totalPaid = period.claims.reduce((sum, c) => sum + parseDecimalValue(c.amountPaid), 0);

      const currency = period.claims[0]?.currency || "USD";

      return {
        providerName: period.providerName,
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        totalClaims: period.claims.length,
        awaitingRemittance,
        matched,
        partiallyPaid,
        unpaid,
        manualReview,
        totalBilled: totalBilled.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        currency,
      };
    });

  summaries.sort((a, b) => {
    if (a.periodYear !== b.periodYear) return b.periodYear - a.periodYear;
    return b.periodMonth - a.periodMonth;
  });

  return summaries;
}

/**
 * Get distinct available years and months for a provider
 * Used to populate Year and Month filter dropdowns in Claims Inventory
 */
export async function getAvailablePeriods(providerName: string) {
  const filters = [eq(claimReconClaims.providerName, providerName)];
  
  // Get distinct years using SQL aggregation for efficiency
  const yearsResult = await db
    .selectDistinct({ periodYear: claimReconClaims.periodYear })
    .from(claimReconClaims)
    .where(and(...filters))
    .orderBy(desc(claimReconClaims.periodYear));

  const years = yearsResult.map(r => r.periodYear);

  // Get distinct months for each year
  const monthsResult = await db
    .selectDistinct({ 
      periodYear: claimReconClaims.periodYear,
      periodMonth: claimReconClaims.periodMonth 
    })
    .from(claimReconClaims)
    .where(and(...filters))
    .orderBy(desc(claimReconClaims.periodYear), claimReconClaims.periodMonth);

  // Group months by year
  const monthsByYear = new Map<number, number[]>();
  for (const row of monthsResult) {
    const yearMonths = monthsByYear.get(row.periodYear);
    if (yearMonths) {
      yearMonths.push(row.periodMonth);
    } else {
      monthsByYear.set(row.periodYear, [row.periodMonth]);
    }
  }

  return {
    years,
    // monthsByYear included for future UI enhancement (e.g., showing only available months per year in dropdown)
    // Currently not used by frontend but provides flexibility for future improvements
    monthsByYear: Object.fromEntries(monthsByYear),
  };
}
