// server/src/claimReconciliation/service.ts

import { db } from "../../../server/db";
import { claimReconRuns, claimReconClaims, claimReconRemittances } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { ClaimRow, RemittanceRow, ReconciliationSummary } from "./types";
import { generateCompositeKey, matchClaimsToRemittances } from "./matching";

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
 * Insert parsed claims
 */
export async function insertClaims(runId: number, claims: ClaimRow[]) {
  const claimsToInsert = claims.map((claim) => ({
    runId,
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
    compositeKey: generateCompositeKey(claim.memberNumber, claim.serviceDate),
    rawRow: claim as any,
  }));

  const inserted = await db
    .insert(claimReconClaims)
    .values(claimsToInsert)
    .returning();

  return inserted;
}

/**
 * Insert parsed remittances
 */
export async function insertRemittances(runId: number, remittances: RemittanceRow[]) {
  const remittancesToInsert = remittances.map((rem) => ({
    runId,
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
    compositeKey: generateCompositeKey(rem.memberNumber, rem.serviceDate),
    rawRow: rem as any,
  }));

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
  const runs = await db.select().from(claimReconRuns).orderBy(claimReconRuns.createdAt);
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
