// server/src/claimReconciliation/service.ts

import { db } from "../../../server/db";
import {
  claimReconRuns,
  claimReconClaims,
  claimReconRemittances,
} from "@shared/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import type {
  ClaimRow,
  RemittanceRow,
  ReconciliationSummary,
} from "./types";
import {
  buildClaimCompositeKey,
  buildRemittanceKeyVariants,
  matchClaimsToRemittances,
} from "./matching";

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
 * Insert parsed claims (legacy - for backward compatibility)
 */
export async function insertClaims(runId: number, claims: ClaimRow[]) {
  // Get provider and period from the run
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const claimsToInsert = claims.map((claim) => ({
    runId,
    providerName: run.providerName,
    periodYear: run.periodYear,
    periodMonth: run.periodMonth,
    memberNumber: claim.memberNumber,
    patientName: claim.patientName || null,
    serviceDate: claim.serviceDate.toISOString().split("T")[0],
    invoiceNumber: claim.invoiceNumber || null,
    claimType: claim.claimType || null,
    schemeName: claim.schemeName || null,
    benefitDesc: claim.benefitDesc || null,
    billedAmount: claim.billedAmount.toString(),
    currency: claim.currency || "SSP",
    status: "submitted" as const,
    amountPaid: "0",
    compositeKey: buildClaimCompositeKey(
      claim.memberNumber,
      claim.serviceDate,
      claim.billedAmount
    ),
    rawRow: claim as any,
  }));

  const inserted = await db
    .insert(claimReconClaims)
    .values(claimsToInsert)
    .returning();

  return inserted;
}

/**
 * Insert parsed remittances (legacy - for backward compatibility)
 */
export async function insertRemittances(
  runId: number,
  remittances: RemittanceRow[]
) {
  // Get provider and period from the run
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const remittancesToInsert = remittances.map((rem) => {
    // For remittances, we store the first variant as the composite key
    // The matching algorithm will generate all variants during matching
    const keyVariants = buildRemittanceKeyVariants(
      rem.memberNumber,
      rem.serviceDate,
      rem.claimAmount
    );

    return {
      runId,
      providerName: run.providerName,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      employerName: rem.employerName || null,
      patientName: rem.patientName || null,
      memberNumber: rem.memberNumber,
      claimNumber: rem.claimNumber || null,
      relationship: rem.relationship || null,
      serviceDate: rem.serviceDate.toISOString().split("T")[0],
      claimAmount: rem.claimAmount.toString(),
      paidAmount: rem.paidAmount.toString(),
      paymentNo: rem.paymentNo || null,
      paymentMode: rem.paymentMode || null,
      compositeKey: keyVariants[0], // Store the base key (no delta)
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
 * Perform matching and update claims/remittances
 */
export async function performMatching(runId: number) {
  // Fetch all claims for this run
  const claims = await db
    .select()
    .from(claimReconClaims)
    .where(eq(claimReconClaims.runId, runId));

  // Fetch all remittances for this run
  const remittances = await db
    .select()
    .from(claimReconRemittances)
    .where(eq(claimReconRemittances.runId, runId));

  // Convert to matching format
  const claimData = claims.map((c) => ({
    id: c.id,
    compositeKey: c.compositeKey,
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
    },
  }));

  const remitData = remittances.map((r) => ({
    id: r.id,
    compositeKey: r.compositeKey,
    data: {
      employerName: r.employerName || undefined,
      patientName: r.patientName || undefined,
      memberNumber: r.memberNumber,
      claimNumber: r.claimNumber || undefined,
      relationship: r.relationship || undefined,
      serviceDate: new Date(r.serviceDate),
      claimAmount: parseFloat(r.claimAmount),
      paidAmount: parseFloat(r.paidAmount),
      paymentNo: r.paymentNo || undefined,
      paymentMode: r.paymentMode || undefined,
    },
  }));

  // Perform matching
  const matches = matchClaimsToRemittances(claimData, remitData);

  // Update claims with match results
  for (const match of matches) {
    await db
      .update(claimReconClaims)
      .set({
        status: match.status,
        amountPaid: match.amountPaid.toString(),
        remittanceLineId: match.remittanceId,
      })
      .where(eq(claimReconClaims.id, match.claimId));

    // Update remittance if matched
    if (match.remittanceId) {
      await db
        .update(claimReconRemittances)
        .set({
          matchedClaimId: match.claimId,
          matchType: match.matchType,
        })
        .where(eq(claimReconRemittances.id, match.remittanceId));
    }
  }

  // Calculate summary
  const summary: ReconciliationSummary = {
    totalClaims: claims.length,
    totalRemittances: remittances.length,
    autoMatched: matches.filter((m) => m.matchType === "exact").length,
    partialMatched: matches.filter((m) => m.matchType === "partial").length,
    manualReview: matches.filter((m) => m.status === "manual_review").length,
  };

  // Update run with summary
  await db
    .update(claimReconRuns)
    .set({
      totalClaimRows: summary.totalClaims,
      totalRemittanceRows: summary.totalRemittances,
      autoMatched: summary.autoMatched,
      partialMatched: summary.partialMatched,
      manualReview: summary.manualReview,
    })
    .where(eq(claimReconRuns.id, runId));

  return summary;
}

/**
 * Get reconciliation run details
 */
export async function getReconRun(runId: number) {
  const [run] = await db
    .select()
    .from(claimReconRuns)
    .where(eq(claimReconRuns.id, runId));

  return run;
}

/**
 * Get all reconciliation runs
 */
export async function getAllReconRuns() {
  const runs = await db
    .select()
    .from(claimReconRuns)
    .orderBy(claimReconRuns.createdAt);
  return runs;
}

/**
 * Get claims for a run
 */
export async function getClaimsForRun(runId: number) {
  const claims = await db
    .select()
    .from(claimReconClaims)
    .where(eq(claimReconClaims.runId, runId));

  return claims;
}

/**
 * Get remittances for a run
 */
export async function getRemittancesForRun(runId: number) {
  const remittances = await db
    .select()
    .from(claimReconRemittances)
    .where(eq(claimReconRemittances.runId, runId));

  return remittances;
}

/* -------------------------------------------------------------------------- */
/* Extra helpers: issue claims + delete run                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get "issue" claims for a run:
 * - partially paid
 * - marked for manual review
 * - still submitted with amountPaid = 0 (no remittance / unpaid)
 */
export async function getIssueClaimsForRun(runId: number) {
  const claims = await db
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

  return claims;
}

/**
 * Delete a reconciliation run and all its child rows.
 * Useful for removing test runs.
 */
export async function deleteReconRun(runId: number) {
  await db.transaction(async (tx) => {
    await tx
      .delete(claimReconClaims)
      .where(eq(claimReconClaims.runId, runId));

    await tx
      .delete(claimReconRemittances)
      .where(eq(claimReconRemittances.runId, runId));

    await tx.delete(claimReconRuns).where(eq(claimReconRuns.id, runId));
  });

  return { success: true };
}

/* -------------------------------------------------------------------------- */
/* Staged Workflow Functions (Claims-only, Remittance-only)                  */
/* -------------------------------------------------------------------------- */

/**
 * Upsert claims for a specific provider and period.
 * Replaces existing claims for that provider+period and resets their status to awaiting_remittance.
 * Does NOT create a run or perform reconciliation.
 */
export async function upsertClaimsForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  claims: ClaimRow[]
) {
  return await db.transaction(async (tx) => {
    // Delete existing claims for this provider+period (only standalone claims without runId)
    await tx
      .delete(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          eq(claimReconClaims.periodYear, periodYear),
          eq(claimReconClaims.periodMonth, periodMonth),
          isNull(claimReconClaims.runId) // Only delete standalone claims to preserve audit trail
        )
      );

    // Insert new claims with awaiting_remittance status
    const claimsToInsert = claims.map((claim) => ({
      runId: null,
      providerName,
      periodYear,
      periodMonth,
      memberNumber: claim.memberNumber,
      patientName: claim.patientName || null,
      serviceDate: claim.serviceDate.toISOString().split("T")[0],
      invoiceNumber: claim.invoiceNumber || null,
      claimType: claim.claimType || null,
      schemeName: claim.schemeName || null,
      benefitDesc: claim.benefitDesc || null,
      billedAmount: claim.billedAmount.toString(),
      currency: claim.currency || "SSP",
      status: "awaiting_remittance" as const,
      amountPaid: "0",
      compositeKey: buildClaimCompositeKey(
        claim.memberNumber,
        claim.serviceDate,
        claim.billedAmount
      ),
      rawRow: claim as any,
    }));

    const inserted = await tx
      .insert(claimReconClaims)
      .values(claimsToInsert)
      .returning();

    return inserted;
  });
}

/**
 * Upsert remittances for a specific provider and period.
 * Replaces existing remittances for that provider+period.
 * Validates that claims exist before proceeding.
 */
export async function upsertRemittanceForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  remittances: RemittanceRow[]
) {
  return await db.transaction(async (tx) => {
    // Check if claims exist for this provider+period
    const existingClaims = await tx
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          eq(claimReconClaims.periodYear, periodYear),
          eq(claimReconClaims.periodMonth, periodMonth)
        )
      )
      .limit(1);

    if (existingClaims.length === 0) {
      throw new Error(
        `No claims found for ${providerName} for ${periodYear}-${String(periodMonth).padStart(2, '0')}. Please upload claims first.`
      );
    }

    // Delete existing remittances for this provider+period (standalone only)
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

    // Insert new remittances
    const remittancesToInsert = remittances.map((rem) => {
      const keyVariants = buildRemittanceKeyVariants(
        rem.memberNumber,
        rem.serviceDate,
        rem.claimAmount
      );

      return {
        runId: null,
        providerName,
        periodYear,
        periodMonth,
        employerName: rem.employerName || null,
        patientName: rem.patientName || null,
        memberNumber: rem.memberNumber,
        claimNumber: rem.claimNumber || null,
        relationship: rem.relationship || null,
        serviceDate: rem.serviceDate.toISOString().split("T")[0],
        claimAmount: rem.claimAmount.toString(),
        paidAmount: rem.paidAmount.toString(),
        paymentNo: rem.paymentNo || null,
        paymentMode: rem.paymentMode || null,
        compositeKey: keyVariants[0],
        rawRow: rem as any,
      };
    });

    const inserted = await tx
      .insert(claimReconRemittances)
      .values(remittancesToInsert)
      .returning();

    return inserted;
  });
}

/**
 * Get claims for a specific provider and period
 */
export async function getClaimsForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number
) {
  const claims = await db
    .select()
    .from(claimReconClaims)
    .where(
      and(
        eq(claimReconClaims.providerName, providerName),
        eq(claimReconClaims.periodYear, periodYear),
        eq(claimReconClaims.periodMonth, periodMonth)
      )
    );

  return claims;
}

/**
 * Get remittances for a specific provider and period
 */
export async function getRemittanceForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number
) {
  const remittances = await db
    .select()
    .from(claimReconRemittances)
    .where(
      and(
        eq(claimReconRemittances.providerName, providerName),
        eq(claimReconRemittances.periodYear, periodYear),
        eq(claimReconRemittances.periodMonth, periodMonth)
      )
    );

  return remittances;
}

/**
 * Run claim reconciliation for a specific provider and period.
 * Uses persisted claims and remittances (not raw files).
 * Updates claim and remittance statuses based on matching results.
 * Returns a summary of the reconciliation.
 */
export async function runClaimReconciliation(
  providerName: string,
  periodYear: number,
  periodMonth: number
) {
  return await db.transaction(async (tx) => {
    // Fetch claims for this provider+period
    const claims = await tx
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          eq(claimReconClaims.periodYear, periodYear),
          eq(claimReconClaims.periodMonth, periodMonth)
        )
      );

    // Fetch remittances for this provider+period
    const remittances = await tx
      .select()
      .from(claimReconRemittances)
      .where(
        and(
          eq(claimReconRemittances.providerName, providerName),
          eq(claimReconRemittances.periodYear, periodYear),
          eq(claimReconRemittances.periodMonth, periodMonth)
        )
      );

    if (claims.length === 0) {
      throw new Error(
        `No claims found for ${providerName} for ${periodYear}-${String(periodMonth).padStart(2, '0')}`
      );
    }

    if (remittances.length === 0) {
      throw new Error(
        `No remittances found for ${providerName} for ${periodYear}-${String(periodMonth).padStart(2, '0')}`
      );
    }

    // Convert to matching format
    const claimData = claims.map((c) => ({
      id: c.id,
      compositeKey: c.compositeKey,
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
      },
    }));

    const remitData = remittances.map((r) => ({
      id: r.id,
      compositeKey: r.compositeKey,
      data: {
        employerName: r.employerName || undefined,
        patientName: r.patientName || undefined,
        memberNumber: r.memberNumber,
        claimNumber: r.claimNumber || undefined,
        relationship: r.relationship || undefined,
        serviceDate: new Date(r.serviceDate),
        claimAmount: parseFloat(r.claimAmount),
        paidAmount: parseFloat(r.paidAmount),
        paymentNo: r.paymentNo || undefined,
        paymentMode: r.paymentMode || undefined,
      },
    }));

    // Perform matching
    const matches = matchClaimsToRemittances(claimData, remitData);

    // Track which remittances were matched
    const matchedRemittanceIds = new Set<number>();

    // Update claims with match results
    for (const match of matches) {
      await tx
        .update(claimReconClaims)
        .set({
          status: match.status,
          amountPaid: match.amountPaid.toString(),
          remittanceLineId: match.remittanceId,
        })
        .where(eq(claimReconClaims.id, match.claimId));

      // Update remittance if matched
      if (match.remittanceId) {
        matchedRemittanceIds.add(match.remittanceId);
        await tx
          .update(claimReconRemittances)
          .set({
            matchedClaimId: match.claimId,
            matchType: match.matchType,
            status: null, // Clear orphan status if previously set
          })
          .where(eq(claimReconRemittances.id, match.remittanceId));
      }
    }

    // Mark unmatched remittances as orphans
    const orphanRemittances = remittances.filter(
      (r) => !matchedRemittanceIds.has(r.id)
    );
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

    // Calculate summary
    const summary: ReconciliationSummary = {
      totalClaims: claims.length,
      totalRemittances: remittances.length,
      autoMatched: matches.filter((m) => m.matchType === "exact").length,
      partialMatched: matches.filter((m) => m.matchType === "partial").length,
      manualReview: matches.filter((m) => m.status === "manual_review").length,
    };

    return {
      summary,
      orphanRemittances: orphanRemittances.length,
      unpaidClaims: matches.filter((m) => m.status === "unpaid" && m.remittanceId === null).length,
    };
  });
}
