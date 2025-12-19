// server/src/routes/claimReconciliation.ts

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

import {
  parseClaimsFile,
  parseRemittanceFile,
} from "../claimReconciliation/parseCic";

import {
  createReconRun,
  insertClaims,
  insertRemittances,
  performMatching,
  getAllReconRuns,
  getReconRun,
  getClaimsForRun,
  getRemittancesForRun,
  getIssueClaimsForRun,
  deleteReconRun,

  // Staged workflow (claims)
  upsertClaimsForPeriod,
  getClaimsForPeriod,
  getRemittanceForPeriod,

  // Cross-period reconciliation (service)
  runClaimReconciliation,

  // Claims inventory
  getAllClaims,
  deleteClaim,
  deleteClaimsForPeriod,
  deleteRemittancesForPeriod,
  getPeriodsSummary,

  // Metrics helper
  updateReconRunMetrics,
  getActualRunCounts,
} from "../claimReconciliation/service";

const router = Router();

// Constants
const CLINIC_NAME = "BAHR EL GHAZAL CLINIC";
const MAX_EXPORT_LIMIT = 10000; // Maximum records for Excel export

/** Utility function for period formatting */
function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Convert an Excel serial date (1900 system) into a JS Date.
 * Best-effort helper for cases where parsers return numeric dates.
 */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  // Excel serial date: days since 1899-12-30 (Excel's 1900 system)
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Best-effort parse of a receivedDate from body (string/number/Date) into Date. */
function parseReceivedDate(input: any): Date | null {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    // Could be Excel serial
    return excelSerialToDate(input);
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Try to infer a statement date from parsed remittance rows.
 * We look for common fields that might carry cheque/EFT date.
 */
function inferStatementDateFromRemittances(remittances: any[]): Date | null {
  if (!Array.isArray(remittances) || remittances.length === 0) return null;

  const candidateKeys = [
    "chequeEftDate",
    "chequeDate",
    "eftDate",
    "paymentDate",
    "paidDate",
    "datePaid",
    "statementDate",
    "remittanceDate",
    "cheque_eft_date",
    "cheque_date",
    "eft_date",
  ];

  const N = Math.min(remittances.length, 50);
  for (let i = 0; i < N; i++) {
    const r = remittances[i];
    if (!r || typeof r !== "object") continue;

    for (const k of candidateKeys) {
      if (r[k] === undefined || r[k] === null) continue;
      const d = parseReceivedDate(r[k]);
      if (d) return d;
    }

    for (const v of Object.values(r)) {
      const d = parseReceivedDate(v);
      if (d) return d;
    }
  }

  return null;
}

/** Auth middleware */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

/** Configure multer for file uploads */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".xlsx", ".xls"];
    const fileExtension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));

    if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed."));
    }
  },
});

/**
 * Ensure provider has at least one claim stored (so remittance uploads make sense).
 * Uses existing inventory function (cheap: limit 1).
 */
async function ensureProviderHasClaims(providerName: string) {
  const { claims } = await getAllClaims({ providerName, page: 1, limit: 1 });
  if (!claims || claims.length === 0) {
    throw new Error(`No claims found for ${providerName}. Please upload claims first.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Legacy combined upload/run (claims + remittance)                            */
/* -------------------------------------------------------------------------- */

const uploadHandler = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { providerName, periodYear, periodMonth } = req.body;
    const userId = req.user?.id;

    if (!providerName || !periodYear || !periodMonth) {
      return res.status(400).json({
        error: "Missing required fields: providerName, periodYear, periodMonth",
      });
    }

    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    if (!files?.claimsFile || !files?.remittanceFile) {
      return res.status(400).json({
        error: "Both claimsFile and remittanceFile are required",
      });
    }

    const claimsBuffer = files.claimsFile[0].buffer;
    const remittanceBuffer = files.remittanceFile[0].buffer;

    const claims = parseClaimsFile(claimsBuffer);
    const remittances = parseRemittanceFile(remittanceBuffer);

    if (claims.length === 0) {
      return res.status(400).json({ error: "No valid claims found in the uploaded file" });
    }
    if (remittances.length === 0) {
      return res.status(400).json({ error: "No valid remittances found in the uploaded file" });
    }

    const run = await createReconRun(
      providerName,
      parseInt(periodYear, 10),
      parseInt(periodMonth, 10),
      userId
    );

    await insertClaims(run.id, claims);
    await insertRemittances(run.id, remittances);

    const summary = await performMatching(run.id);

    res.json({
      success: true,
      runId: run.id,
      summary,
    });
  } catch (error: any) {
    console.error("Error processing reconciliation:", error);
    res.status(500).json({
      error: error.message || "Failed to process reconciliation",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Staged Uploads                                                              */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/claim-reconciliation/upload-claims
 * Upload claims only (without remittance) for a specific provider and period
 * Stores claims with status "awaiting_remittance"
 */
router.post(
  "/upload-claims",
  requireAuth,
  upload.single("claimsFile"),
  async (req: Request, res: Response) => {
    try {
      const { providerName, periodYear, periodMonth } = req.body;
      const userId = req.user?.id;

      if (!providerName || !periodYear || !periodMonth) {
        return res.status(400).json({
          error: "Missing required fields: providerName, periodYear, periodMonth",
        });
      }

      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "claimsFile is required" });
      }

      const claims = parseClaimsFile(req.file.buffer);

      if (claims.length === 0) {
        return res.status(400).json({ error: "No valid claims found in the uploaded file" });
      }

      const inserted = await upsertClaimsForPeriod(
        providerName,
        parseInt(periodYear, 10),
        parseInt(periodMonth, 10),
        claims
      );

      // Claims-only uploads should NOT create a run record.
      // Runs should only be created when remittances are uploaded and matching occurs.
      
      res.json({
        success: true,
        provider: providerName,
        period: formatPeriod(parseInt(periodYear, 10), parseInt(periodMonth, 10)),
        claimsStored: inserted.length,
        message: `${inserted.length} claims stored and pending remittance`,
      });
    } catch (error: any) {
      console.error("Error uploading claims:", error);
      res.status(500).json({
        error: error.message || "Failed to upload claims",
      });
    }
  }
);

/**
 * POST /api/claim-reconciliation/upload-remittance-statement
 * Upload remittance at PROVIDER level (no period selection required).
 *
 * CIC remittances are mixed across months/years.
 * We store the statement under a filing period (derived from receivedDate / inferred / today),
 * but matching is cross-period across ALL outstanding claims.
 *
 * Required: providerName, remittanceFile
 * Optional: receivedDate
 */
router.post(
  "/upload-remittance-statement",
  requireAuth,
  upload.single("remittanceFile"),
  async (req: Request, res: Response) => {
    try {
      const { providerName, receivedDate } = req.body;
      const userId = req.user?.id;

      if (!providerName) {
        return res.status(400).json({ error: "Missing required field: providerName" });
      }

      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "remittanceFile is required" });
      }

      const remittances = parseRemittanceFile(req.file.buffer);
      if (remittances.length === 0) {
        return res.status(400).json({ error: "No valid remittances found in the uploaded file" });
      }

      // Require at least one claim on file for provider
      try {
        await ensureProviderHasClaims(providerName);
      } catch (e: any) {
        return res.status(400).json({
          error: e?.message || `No claims found for ${providerName}. Please upload claims first.`,
          suggestion:
            "Upload claims for this provider first (claims can be across any months/years). Then re-upload this remittance statement.",
        });
      }

      // Determine filing date (for organizing statements)
      const received = parseReceivedDate(receivedDate);
      const inferred = inferStatementDateFromRemittances(remittances);
      const filingDate = received ?? inferred ?? new Date();

      const year = filingDate.getFullYear();
      const month = filingDate.getMonth() + 1;

      // ✅ IMPORTANT FIX:
      // Create the run FIRST, then insert remittances WITH runId so /runs/:runId/remittances works
      const run = await createReconRun(providerName, year, month, userId);

      const inserted = await insertRemittances(run.id, remittances);

      // Cross-period reconciliation (service currently matches provider-wide outstanding claims)
      const reconciliationResult = await runClaimReconciliation(providerName, year, month, { runId: run.id });

      // Get actual counts from persisted rows (audit-proof)
      const actualCounts = await getActualRunCounts(run.id);

      await updateReconRunMetrics(run.id, {
        totalClaimRows: actualCounts.totalClaimRows, // COUNT from claim_recon_run_claims
        totalRemittanceRows: actualCounts.totalRemittanceRows, // COUNT from claim_recon_remittances
        autoMatched: reconciliationResult.summary.autoMatched,
        partialMatched: reconciliationResult.summary.partialMatched,
        manualReview: reconciliationResult.summary.manualReview,
        unpaidCount: reconciliationResult.unpaidCount || 0,
      });

      res.json({
        success: true,
        runId: run.id,
        provider: providerName,
        filingPeriod: formatPeriod(year, month),
        filingDate: filingDate.toISOString().slice(0, 10),
        remittancesStored: inserted.length,
        reconciliation: {
          totalClaimsSearched: reconciliationResult.totalClaimsSearched,
          claimsMatched: reconciliationResult.claimsMatched,
          totalRemittances: reconciliationResult.summary.totalRemittances,
          autoMatched: reconciliationResult.summary.autoMatched,
          partialMatched: reconciliationResult.summary.partialMatched,
          manualReview: reconciliationResult.summary.manualReview,
          unpaidClaims: reconciliationResult.unpaidClaims,
          orphanRemittances: reconciliationResult.orphanRemittances,
        },
        message:
          "Remittance statement uploaded. Matching ran across ALL outstanding claims (all periods).",
        info: `Stored under filing period ${formatPeriod(
          year,
          month
        )} for organization only. Matched against ${reconciliationResult.totalClaimsSearched} outstanding claims across all periods.`,
      });
    } catch (error: any) {
      console.error("Error uploading remittance statement:", error);
      res.status(500).json({
        error: error.message || "Failed to upload remittance statement",
      });
    }
  }
);

/**
 * LEGACY: POST /api/claim-reconciliation/upload-remittance
 * Upload remittance for a selected provider + month/year (kept for compatibility),
 * but matching still runs cross-period.
 */
router.post(
  "/upload-remittance",
  requireAuth,
  upload.single("remittanceFile"),
  async (req: Request, res: Response) => {
    try {
      const { providerName, periodYear, periodMonth } = req.body;
      const userId = req.user?.id;

      if (!providerName || !periodYear || !periodMonth) {
        return res.status(400).json({
          error: "Missing required fields: providerName, periodYear, periodMonth",
        });
      }

      if (!userId) {
        return res.status(401).json({ error: "User authentication required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "remittanceFile is required" });
      }

      const remittances = parseRemittanceFile(req.file.buffer);
      if (remittances.length === 0) {
        return res.status(400).json({ error: "No valid remittances found in the uploaded file" });
      }

      // Require at least one claim on file for provider
      try {
        await ensureProviderHasClaims(providerName);
      } catch (e: any) {
        return res.status(400).json({
          error: e?.message || `No claims found for ${providerName}. Please upload claims first.`,
          suggestion: "Please upload claims for this provider first",
        });
      }

      const year = parseInt(periodYear, 10);
      const month = parseInt(periodMonth, 10);

      // ✅ IMPORTANT FIX: create run first, then store remittances with runId
      const run = await createReconRun(providerName, year, month, userId);

      const inserted = await insertRemittances(run.id, remittances);

      const reconciliationResult = await runClaimReconciliation(providerName, year, month, { runId: run.id });

      // Get actual counts from persisted rows (audit-proof)
      const actualCounts = await getActualRunCounts(run.id);

      await updateReconRunMetrics(run.id, {
        totalClaimRows: actualCounts.totalClaimRows, // COUNT from claim_recon_run_claims
        totalRemittanceRows: actualCounts.totalRemittanceRows, // COUNT from claim_recon_remittances
        autoMatched: reconciliationResult.summary.autoMatched,
        partialMatched: reconciliationResult.summary.partialMatched,
        manualReview: reconciliationResult.summary.manualReview,
        unpaidCount: reconciliationResult.unpaidCount || 0,
      });

      res.json({
        success: true,
        runId: run.id,
        provider: providerName,
        period: formatPeriod(year, month),
        remittancesStored: inserted.length,
        reconciliation: {
          totalClaimsSearched: reconciliationResult.totalClaimsSearched,
          claimsMatched: reconciliationResult.claimsMatched,
          totalRemittances: reconciliationResult.summary.totalRemittances,
          autoMatched: reconciliationResult.summary.autoMatched,
          partialMatched: reconciliationResult.summary.partialMatched,
          manualReview: reconciliationResult.summary.manualReview,
          unpaidClaims: reconciliationResult.unpaidClaims,
          orphanRemittances: reconciliationResult.orphanRemittances,
        },
        message: "Remittances uploaded and cross-period reconciliation completed",
        info: `Matched against ${reconciliationResult.totalClaimsSearched} outstanding claims across all periods`,
      });
    } catch (error: any) {
      console.error("Error uploading remittance:", error);
      res.status(500).json({
        error: error.message || "Failed to upload remittance",
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Period status                                                               */
/* -------------------------------------------------------------------------- */

router.get(
  "/period/:providerName/:year/:month",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerName, year, month } = req.params;
      const periodYear = parseInt(year, 10);
      const periodMonth = parseInt(month, 10);

      const claims = await getClaimsForPeriod(providerName, periodYear, periodMonth);
      const remittances = await getRemittanceForPeriod(providerName, periodYear, periodMonth);

      const claimsAwaiting = claims.filter((c) => c.status === "awaiting_remittance").length;
      const claimsMatched = claims.filter((c) => c.status === "matched" || c.status === "paid").length;
      const claimsPartial = claims.filter((c) => c.status === "partially_paid").length;
      const claimsUnpaid = claims.filter((c) => c.status === "unpaid").length;
      const orphanRemittances = remittances.filter((r) => r.status === "orphan_remittance").length;

      res.json({
        provider: providerName,
        period: formatPeriod(periodYear, periodMonth),
        claims: {
          total: claims.length,
          awaitingRemittance: claimsAwaiting,
          matched: claimsMatched,
          partiallyPaid: claimsPartial,
          unpaid: claimsUnpaid,
        },
        remittances: {
          total: remittances.length,
          orphans: orphanRemittances,
        },
        hasClaimsOnly: claims.length > 0 && remittances.length === 0,
        hasRemittances: remittances.length > 0,
        isReconciled: remittances.length > 0 && claimsAwaiting === 0,
      });
    } catch (error: any) {
      console.error("Error fetching period status:", error);
      res.status(500).json({
        error: error.message || "Failed to fetch period status",
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Legacy combined endpoints                                                   */
/* -------------------------------------------------------------------------- */

router.post(
  "/upload",
  requireAuth,
  upload.fields([
    { name: "claimsFile", maxCount: 1 },
    { name: "remittanceFile", maxCount: 1 },
  ]),
  uploadHandler
);

router.post(
  "/run",
  requireAuth,
  upload.fields([
    { name: "claimsFile", maxCount: 1 },
    { name: "remittanceFile", maxCount: 1 },
  ]),
  uploadHandler
);

/* -------------------------------------------------------------------------- */
/* Runs                                                                        */
/* -------------------------------------------------------------------------- */

router.get("/runs", requireAuth, async (_req, res) => {
  try {
    const runs = await getAllReconRuns();
    res.json(runs);
  } catch (error: any) {
    console.error("Error fetching reconciliation runs:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch reconciliation runs",
    });
  }
});

router.get("/runs/:runId", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const run = await getReconRun(runId);

    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    res.json(run);
  } catch (error: any) {
    console.error("Error fetching reconciliation run:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch reconciliation run",
    });
  }
});

router.get("/runs/:runId/claims", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const claims = await getClaimsForRun(runId);
    res.json(claims);
  } catch (error: any) {
    console.error("Error fetching claims:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch claims",
    });
  }
});

router.get("/runs/:runId/remittances", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const remittances = await getRemittancesForRun(runId);
    res.json(remittances);
  } catch (error: any) {
    console.error("Error fetching remittances:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch remittances",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Export issues                                                               */
/* -------------------------------------------------------------------------- */

router.get("/runs/:runId/issues/export", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    
    // Validate runId
    if (isNaN(runId) || runId <= 0) {
      return res.status(400).json({ error: "Invalid run ID" });
    }
    
    const run = await getReconRun(runId);

    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    const issueClaims = await getIssueClaimsForRun(runId);

    // CRITICAL FIX: Allow export even if no issues - user might want to verify
    // Don't block export for January or any other month with 0 issues
    const totalClaims = run.totalClaimRows ?? issueClaims.length;
    const totalRemits = run.totalRemittanceRows ?? 0;

    const unpaidCount = issueClaims.filter((c) => parseFloat(c.amountPaid || "0") === 0).length;

    const partialCount = issueClaims.filter((c) => {
      const paid = parseFloat(c.amountPaid || "0");
      const billed = parseFloat(c.billedAmount || "0");
      return paid > 0 && paid < billed;
    }).length;

    const problemCount = issueClaims.length;
    const fullyPaid = Math.max(totalClaims - problemCount, 0);

    const periodLabel = new Date(run.periodYear, run.periodMonth - 1).toLocaleString("default", {
      month: "short",
      year: "numeric",
    });

    const rows: any[][] = [];

    rows.push(["Provider", run.providerName]);
    rows.push(["Period", periodLabel]);
    rows.push(["Run date", new Date().toISOString().slice(0, 10)]);
    rows.push([]);
    rows.push(["Total claims sent / checked", totalClaims]);
    rows.push(["Total remittances received", totalRemits]);
    rows.push(["Fully paid claims", fullyPaid]);
    rows.push(["Partially paid claims", partialCount]);
    rows.push(["Unpaid / no remittance", unpaidCount]);
    rows.push(["Total problem claims in this export", problemCount]);
    rows.push([]);
    
    // Add message if no issues found
    if (problemCount === 0) {
      rows.push(["Note:", "No claims requiring follow-up found for this reconciliation run."]);
      rows.push(["", "All claims were either fully paid or are still pending remittance."]);
      rows.push([]);
    }
    
    rows.push([
      "Member #",
      "Patient name",
      "Service date",
      "Invoice #",
      "Claim type",
      "Scheme",
      "Benefit",
      "Billed amount",
      "Amount paid",
      "Balance",
      "Status",
    ]);

    for (const c of issueClaims) {
      const billed = parseFloat(c.billedAmount || "0");
      const paid = parseFloat(c.amountPaid || "0");
      const balance = billed - paid;

      rows.push([
        c.memberNumber,
        c.patientName,
        c.serviceDate,
        c.invoiceNumber,
        c.claimType,
        c.schemeName,
        c.benefitDesc,
        billed || null,
        paid || null,
        balance || null,
        c.status,
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Problem claims");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const filename = `CIC-issues-${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}.xlsx`;

    // CRITICAL FIX: Set headers BEFORE sending buffer
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    
    // Send buffer and explicitly end response
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting issue claims:", error);
    // CRITICAL FIX: Only send JSON error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || "Failed to export issue claims",
      });
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Deletes                                                                     */
/* -------------------------------------------------------------------------- */

router.delete("/runs/:runId", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);

    const run = await getReconRun(runId);
    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    await deleteReconRun(runId);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting reconciliation run:", error);
    res.status(500).json({
      error: error.message || "Failed to delete reconciliation run",
    });
  }
});

router.get("/claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const { providerName, status, periodYear, periodMonth, page, limit } = req.query;

    const options = {
      providerName: providerName as string | undefined,
      status: status as string | undefined,
      periodYear: periodYear ? parseInt(periodYear as string, 10) : undefined,
      periodMonth: periodMonth ? parseInt(periodMonth as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    const result = await getAllClaims(options);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching claims:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch claims",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Export Claims to Excel */
/* -------------------------------------------------------------------------- */

router.get("/export-claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const { providerName, status, periodYear, periodMonth } = req.query;

    const options = {
      providerName: providerName as string | undefined,
      status: status as string | undefined,
      periodYear: periodYear ? parseInt(periodYear as string, 10) : undefined,
      periodMonth: periodMonth ? parseInt(periodMonth as string, 10) : undefined,
      page: undefined,
      limit: MAX_EXPORT_LIMIT, // Use configurable constant for export limit
    };

    const result = await getAllClaims(options);
    const claims = result.claims;

    if (!claims || claims.length === 0) {
      return res.status(404).json({ error: "No claims found for export" });
    }

    // Warn if results were limited
    if (claims.length >= MAX_EXPORT_LIMIT) {
      console.warn(`Export limit reached: ${claims.length} claims. Some records may be excluded.`);
    }

    // Map status to friendly names (consistent terminology)
    const statusLabels: Record<string, string> = {
      awaiting_remittance: "Pending remittance",
      matched: "Paid in full",
      partially_paid: "Paid partially",
      unpaid: "Not paid (0 paid)",
      manual_review: "Needs review",
      all: "All",
    };

    const statusName = statusLabels[status as string] || "All Claims";
    const periodLabel = periodYear && periodMonth
      ? `${new Date(parseInt(periodYear as string), parseInt(periodMonth as string) - 1).toLocaleString("default", { month: "long", year: "numeric" })}`
      : "All Periods";

    // Calculate totals
    let totalBilled = 0;
    let totalPaid = 0;
    claims.forEach(c => {
      totalBilled += parseFloat(c.billedAmount || "0");
      totalPaid += parseFloat(c.amountPaid || "0");
    });
    const totalOutstanding = totalBilled - totalPaid;

    // Build Excel rows
    const rows: any[][] = [];

    // Header Section (rows 1-6) - use configurable clinic name
    rows.push([CLINIC_NAME]);
    rows.push([`Claims Report - ${statusName}`]);
    rows.push([`Provider: ${providerName || "All"}`]);
    rows.push([`Period: ${periodLabel}`]);
    rows.push([`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`]);
    rows.push([`Total Claims: ${claims.length} | Total Billed: USD ${totalBilled.toFixed(2)}`]);
    rows.push([]); // Empty row

    // Data Table Header (row 8)
    rows.push([
      "Member #",
      "Patient Name",
      "Service Date",
      "Period",
      "Billed Amount",
      "Amount Paid",
      "Balance",
      "Status",
    ]);

    // Data rows
    claims.forEach(c => {
      const billed = parseFloat(c.billedAmount || "0");
      const paid = parseFloat(c.amountPaid || "0");
      const balance = billed - paid;

      const periodStr = `${new Date(c.periodYear, c.periodMonth - 1).toLocaleString("default", { month: "short" })} ${c.periodYear}`;
      
      const statusDisplay = statusLabels[c.status] || c.status;

      rows.push([
        c.memberNumber,
        c.patientName || "N/A",
        new Date(c.serviceDate).toLocaleDateString(),
        periodStr,
        billed.toFixed(2),
        paid.toFixed(2),
        balance.toFixed(2),
        statusDisplay,
      ]);
    });

    // Summary Footer
    rows.push([]); // Empty row
    rows.push(["Summary"]);
    rows.push(["Total Billed:", `USD ${totalBilled.toFixed(2)}`]);
    rows.push(["Total Paid:", `USD ${totalPaid.toFixed(2)}`]);
    rows.push(["Total Outstanding:", `USD ${totalOutstanding.toFixed(2)}`]);

    // Create workbook
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Claims Report");

    // Style: Set column widths (approximate)
    worksheet["!cols"] = [
      { wch: 12 }, // Member #
      { wch: 25 }, // Patient Name
      { wch: 12 }, // Service Date
      { wch: 12 }, // Period
      { wch: 14 }, // Billed Amount
      { wch: 14 }, // Amount Paid
      { wch: 12 }, // Balance
      { wch: 18 }, // Status
    ];

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Generate filename: CIC_Claims_{StatusOrAll}_{YYYY-MM-DD}.xlsx
    const dateStr = new Date().toISOString().slice(0, 10);
    const statusSlug = status ? String(status).replace(/_/g, "") : "All";
    const providerSlug = (providerName as string || "All").replace(/\s+/g, "");
    const filename = `${providerSlug}_Claims_${statusSlug}_${dateStr}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting claims:", error);
    res.status(500).json({
      error: error.message || "Failed to export claims",
    });
  }
});

router.delete("/claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const claimId = parseInt(req.params.id, 10);
    await deleteClaim(claimId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting claim:", error);
    res.status(500).json({
      error: error.message || "Failed to delete claim",
    });
  }
});

router.delete(
  "/claims/period/:providerName/:year/:month",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerName, year, month } = req.params;
      const periodYear = parseInt(year, 10);
      const periodMonth = parseInt(month, 10);

      await deleteClaimsForPeriod(providerName, periodYear, periodMonth);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting claims for period:", error);
      res.status(500).json({
        error: error.message || "Failed to delete claims for period",
      });
    }
  }
);

router.delete(
  "/remittances/period/:providerName/:year/:month",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { providerName, year, month } = req.params;
      const periodYear = parseInt(year, 10);
      const periodMonth = parseInt(month, 10);

      await deleteRemittancesForPeriod(providerName, periodYear, periodMonth);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting remittances for period:", error);
      res.status(500).json({
        error: error.message || "Failed to delete remittances for period",
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Periods summary                                                             */
/* -------------------------------------------------------------------------- */

router.get("/periods-summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const { providerName } = req.query;
    const summaries = await getPeriodsSummary(providerName as string | undefined);
    res.json(summaries);
  } catch (error: any) {
    console.error("Error fetching periods summary:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch periods summary",
    });
  }
});

export { router as claimReconciliationRouter };
