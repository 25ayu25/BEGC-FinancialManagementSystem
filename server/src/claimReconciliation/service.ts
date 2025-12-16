// server/src/claimReconciliation/service.ts

import { db } from "../../../server/db";
import {
  claimReconRuns,
  claimReconClaims,
  claimReconRemittances,
} from "@shared/schema";
import { eq, and, or, isNull, desc, inArray } from "drizzle-orm";
import type { ClaimRow, RemittanceRow, ReconciliationSummary } from "./types";
import {
  buildClaimCompositeKeyFromRow,
  buildRemittanceKeyVariantsFromRow,
  matchClaimsToRemittances,
} from "./matching";

/**
 * NOTE ON TERMINOLOGY
 * - Claims "period" = claim upload/submission period (month/year selected in UI)
 * - Remittance "period" = remittance statement filing/received period (month/year selected in UI)
 * - CIC reconciliation is cross-period: match a statement against ALL outstanding claims across all periods.
 */

function normalizeCurrencyForProvider(providerName: string, currency?: string | null) {
  const p = (providerName || "").toUpperCase();
  if (p === "CIC") return "USD";
  return currency || "USD";
}

/**
 * These are the claim statuses that should still be considered "outstanding"
 * and therefore eligible to be matched when a new remittance statement is uploaded.
 */
const OUTSTANDING_CLAIM_STATUSES = [
  "awaiting_remittance",
  "unpaid",
  "partially_paid",
  "manual_review",
  "submitted", // legacy runs can leave claims here
] as const;

/* -------------------------------------------------------------------------- */
/* Runs                                                                        */
/* -------------------------------------------------------------------------- */

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

export async function updateReconRunMetrics(
  runId: number,
  metrics: Partial<{
    totalClaimRows: number;
    totalRemittanceRows: number;
    autoMatched: number;
    partialMatched: number;
    manualReview: number;
  }>
) {
  await db.update(claimReconRuns).set(metrics as any).where(eq(claimReconRuns.id, runId));
}

export async function getReconRun(runId: number) {
  const [run] = await db.select().from(claimReconRuns).where(eq(claimReconRuns.id, runId));
  return run;
}

export async function getAllReconRuns() {
  const runs = await db.select().from(claimReconRuns).orderBy(desc(claimReconRuns.createdAt));
  return runs;
}

/* -------------------------------------------------------------------------- */
/* Legacy run-based insert + matching                                          */
/* -------------------------------------------------------------------------- */

export async function insertClaims(runId: number, claims: ClaimRow[]) {
  const [run] = await db.select().from(claimReconRuns).where(eq(claimReconRuns.id, runId));
  if (!run) throw new Error(`Run ${runId} not found`);

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

  return await db.insert(claimReconClaims).values(claimsToInsert).returning();
}

export async function insertRemittances(runId: number, remittances: RemittanceRow[]) {
  const [run] = await db.select().from(claimReconRuns).where(eq(claimReconRuns.id, runId));
  if (!run) throw new Error(`Run ${runId} not found`);

  const remittancesToInsert = remittances.map((rem) => {
    const keyVariants = buildRemittanceKeyVariantsFromRow({
      memberNumber: rem.memberNumber,
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

  return await db.insert(claimReconRemittances).values(remittancesToInsert).returning();
}

export async function performMatching(runId: number) {
  const claims = await db.select().from(claimReconClaims).where(eq(claimReconClaims.runId, runId));
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
      claimNumber: r.claimNumber,
      serviceDate: new Date(r.serviceDate),
      claimAmount: parseFloat(r.claimAmount),
    } as any)[0],
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
    } as any,
  }));

  const matches = matchClaimsToRemittances(claimData, remitData);

  for (const match of matches) {
    await db
      .update(claimReconClaims)
      .set({
        status: match.status,
        amountPaid: match.amountPaid.toString(),
        remittanceLineId: match.remittanceId,
      })
      .where(eq(claimReconClaims.id, match.claimId));

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

  const summary: ReconciliationSummary = {
    totalClaims: claims.length,
    totalRemittances: remittances.length,
    autoMatched: matches.filter((m) => m.matchType === "exact" && m.remittanceId !== null).length,
    partialMatched: matches.filter((m) => m.matchType === "partial" && m.remittanceId !== null).length,
    manualReview: matches.filter((m) => m.status === "manual_review").length,
  };

  await updateReconRunMetrics(runId, {
    totalClaimRows: summary.totalClaims,
    totalRemittanceRows: summary.totalRemittances,
    autoMatched: summary.autoMatched,
    partialMatched: summary.partialMatched,
    manualReview: summary.manualReview,
  });

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Run detail fetchers (with staged fallback)                                  */
/* -------------------------------------------------------------------------- */

export async function getClaimsForRun(runId: number) {
  const runClaims = await db.select().from(claimReconClaims).where(eq(claimReconClaims.runId, runId));
  if (runClaims.length > 0) return runClaims;

  const run = await getReconRun(runId);
  if (!run) return [];

  // ✅ staged fallback: return ALL claims for provider (cross-period view)
  return await db
    .select()
    .from(claimReconClaims)
    .where(eq(claimReconClaims.providerName, run.providerName));
}

export async function getRemittancesForRun(runId: number) {
  const runRemits = await db
    .select()
    .from(claimReconRemittances)
    .where(eq(claimReconRemittances.runId, runId));

  if (runRemits.length > 0) return runRemits;

  const run = await getReconRun(runId);
  if (!run) return [];

  // staged fallback: show remittances for the run’s filing period
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
        inArray(claimReconClaims.status as any, OUTSTANDING_CLAIM_STATUSES as any)
      )
    );

  if (runIssues.length > 0) return runIssues;

  const run = await getReconRun(runId);
  if (!run) return [];

  // staged fallback: provider-wide issues
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

export async function deleteReconRun(runId: number) {
  await db.transaction(async (tx) => {
    await tx.delete(claimReconClaims).where(eq(claimReconClaims.runId, runId));
    await tx.delete(claimReconRemittances).where(eq(claimReconRemittances.runId, runId));
    await tx.delete(claimReconRuns).where(eq(claimReconRuns.id, runId));
  });

  return { success: true };
}

/* -------------------------------------------------------------------------- */
/* Staged Workflow: Claims-only, Remittance-only                               */
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

export async function upsertRemittanceForPeriod(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  remittances: RemittanceRow[]
) {
  return await db.transaction(async (tx) => {
    const existingClaims = await tx
      .select()
      .from(claimReconClaims)
      .where(eq(claimReconClaims.providerName, providerName))
      .limit(1);

    if (existingClaims.length === 0) {
      throw new Error(`No claims found for ${providerName}. Please upload claims first.`);
    }

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

    const remittancesToInsert = remittances.map((rem) => {
      const keyVariants = buildRemittanceKeyVariantsFromRow({
        memberNumber: rem.memberNumber,
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

    return await tx.insert(claimReconRemittances).values(remittancesToInsert).returning();
  });
}

export async function getClaimsForPeriod(providerName: string, periodYear: number, periodMonth: number) {
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

/* -------------------------------------------------------------------------- */
/* Cross-period reconciliation (staged)                                        */
/* -------------------------------------------------------------------------- */

export async function runClaimReconciliation(
  providerName: string,
  periodYear: number,
  periodMonth: number,
  opts?: { runId?: number }
) {
  return await db.transaction(async (tx) => {
    // ✅ FIX: include ALL outstanding claims, not just "awaiting_remittance"
    const claims = await tx
      .select()
      .from(claimReconClaims)
      .where(
        and(
          eq(claimReconClaims.providerName, providerName),
          inArray(claimReconClaims.status as any, OUTSTANDING_CLAIM_STATUSES as any)
        )
      );

    // ✅ Correct: only NEW/UNMATCHED remittance lines for the filing period
    const remittances = await tx
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
        claimNumber: r.claimNumber,
        serviceDate: new Date(r.serviceDate),
        claimAmount: parseFloat(r.claimAmount),
      } as any)[0],
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
      } as any,
    }));

    const matches = matchClaimsToRemittances(claimData, remitData);

    const matchedRemittanceIds = new Set<number>();

    for (const match of matches) {
      await tx
        .update(claimReconClaims)
        .set({
          status: match.status,
          amountPaid: match.amountPaid.toString(),
          remittanceLineId: match.remittanceId,
        })
        .where(eq(claimReconClaims.id, match.claimId));

      if (match.remittanceId) {
        matchedRemittanceIds.add(match.remittanceId);
        await tx
          .update(claimReconRemittances)
          .set({
            matchedClaimId: match.claimId,
            matchType: match.matchType,
            status: null,
          })
          .where(eq(claimReconRemittances.id, match.remittanceId));
      }
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

    const claimsMatchedInThisRun = matches.filter((m) => m.remittanceId !== null).length;

    const summary: ReconciliationSummary = {
      totalClaims: claims.length, // ✅ claims searched (not only matched)
      totalRemittances: remittances.length,
      autoMatched: matches.filter((m) => m.matchType === "exact" && m.remittanceId !== null).length,
      partialMatched: matches.filter((m) => m.matchType === "partial" && m.remittanceId !== null).length,
      manualReview: matches.filter((m) => m.status === "manual_review").length,
    };

    if (opts?.runId) {
      await tx
        .update(claimReconRuns)
        .set({
          totalClaimRows: summary.totalClaims,
          totalRemittanceRows: summary.totalRemittances,
          autoMatched: summary.autoMatched,
          partialMatched: summary.partialMatched,
          manualReview: summary.manualReview,
        })
        .where(eq(claimReconRuns.id, opts.runId));
    }

    return {
      summary,
      orphanRemittances: orphanRemittances.length,
      unpaidClaims: matches.filter((m) => m.status === "unpaid").length,
      totalClaimsSearched: claims.length,
      claimsMatched: claimsMatchedInThisRun,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Claims Inventory                                                            */
/* -------------------------------------------------------------------------- */

export async function getAllClaims(options?: {
  providerName?: string;
  status?: string;
  periodYear?: number;
  periodMonth?: number;
  page?: number;
  limit?: number;
}) {
  const { providerName, status, periodYear, periodMonth, page = 1, limit = 50 } = options || {};

  let query = db.select().from(claimReconClaims);

  const filters = [];
  if (providerName) filters.push(eq(claimReconClaims.providerName, providerName));
  if (status) filters.push(eq(claimReconClaims.status, status));
  if (periodYear !== undefined) filters.push(eq(claimReconClaims.periodYear, periodYear));
  if (periodMonth !== undefined) filters.push(eq(claimReconClaims.periodMonth, periodMonth));

  if (filters.length > 0) query = query.where(and(...filters)) as any;

  const offset = (page - 1) * limit;
  const claims = await query.limit(limit).offset(offset);

  let countQuery = db.select().from(claimReconClaims);
  if (filters.length > 0) countQuery = countQuery.where(and(...filters)) as any;
  const allClaims = await countQuery;
  const total = allClaims.length;

  return {
    claims,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
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
  const filters = providerName ? [eq(claimReconClaims.providerName, providerName)] : [];

  let query = db.select().from(claimReconClaims);
  if (filters.length > 0) query = query.where(and(...filters)) as any;

  const allClaims = await query;

  const periodMap = new Map<
    string,
    {
      periodYear: number;
      periodMonth: number;
      providerName: string;
      claims: typeof allClaims;
    }
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

      const totalBilled = period.claims.reduce((sum, c) => sum + parseFloat(c.billedAmount), 0);
      const totalPaid = period.claims.reduce((sum, c) => sum + parseFloat(c.amountPaid || "0"), 0);

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
