// server/src/routes/claimReconciliation.ts

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

import { parseClaimsFile, parseRemittanceFile } from "../claimReconciliation/parseCic";
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
  // New staged workflow functions
  upsertClaimsForPeriod,
  upsertRemittanceForPeriod,
  getClaimsForPeriod,
  getRemittanceForPeriod,
  runClaimReconciliation,
} from "../claimReconciliation/service";

const router = Router();

// Utility function for period formatting
function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Auth middleware - same as before
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

    if (
      allowedMimes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed.")
      );
    }
  },
});

// Shared handler for POST /upload and POST /run
const uploadHandler = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { providerName, periodYear, periodMonth } = req.body;
    const userId = req.user?.id;

    // Validate required fields
    if (!providerName || !periodYear || !periodMonth) {
      return res.status(400).json({
        error: "Missing required fields: providerName, periodYear, periodMonth",
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: "User authentication required",
      });
    }

    if (!files?.claimsFile || !files?.remittanceFile) {
      return res.status(400).json({
        error: "Both claimsFile and remittanceFile are required",
      });
    }

    // Parse files
    const claimsBuffer = files.claimsFile[0].buffer;
    const remittanceBuffer = files.remittanceFile[0].buffer;

    const claims = parseClaimsFile(claimsBuffer);
    const remittances = parseRemittanceFile(remittanceBuffer);

    if (claims.length === 0) {
      return res.status(400).json({
        error: "No valid claims found in the uploaded file",
      });
    }

    if (remittances.length === 0) {
      return res.status(400).json({
        error: "No valid remittances found in the uploaded file",
      });
    }

    // Create reconciliation run
    const run = await createReconRun(
      providerName,
      parseInt(periodYear, 10),
      parseInt(periodMonth, 10),
      userId
    );

    // Insert claims and remittances
    await insertClaims(run.id, claims);
    await insertRemittances(run.id, remittances);

    // Perform matching
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

      // Validate required fields
      if (!providerName || !periodYear || !periodMonth) {
        return res.status(400).json({
          error: "Missing required fields: providerName, periodYear, periodMonth",
        });
      }

      if (!userId) {
        return res.status(401).json({
          error: "User authentication required",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "claimsFile is required",
        });
      }

      // Parse claims file
      const claimsBuffer = req.file.buffer;
      const claims = parseClaimsFile(claimsBuffer);

      if (claims.length === 0) {
        return res.status(400).json({
          error: "No valid claims found in the uploaded file",
        });
      }

      // Upsert claims for this provider+period
      const inserted = await upsertClaimsForPeriod(
        providerName,
        parseInt(periodYear, 10),
        parseInt(periodMonth, 10),
        claims
      );

      res.json({
        success: true,
        provider: providerName,
        period: formatPeriod(parseInt(periodYear, 10), parseInt(periodMonth, 10)),
        claimsStored: inserted.length,
        message: `${inserted.length} claims stored and awaiting remittance`,
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
 * POST /api/claim-reconciliation/upload-remittance
 * Upload remittance only (requires existing claims) for a specific provider and period
 * Runs reconciliation automatically after upload
 */
router.post(
  "/upload-remittance",
  requireAuth,
  upload.single("remittanceFile"),
  async (req: Request, res: Response) => {
    try {
      const { providerName, periodYear, periodMonth } = req.body;
      const userId = req.user?.id;

      // Validate required fields
      if (!providerName || !periodYear || !periodMonth) {
        return res.status(400).json({
          error: "Missing required fields: providerName, periodYear, periodMonth",
        });
      }

      if (!userId) {
        return res.status(401).json({
          error: "User authentication required",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "remittanceFile is required",
        });
      }

      // Parse remittance file
      const remittanceBuffer = req.file.buffer;
      const remittances = parseRemittanceFile(remittanceBuffer);

      if (remittances.length === 0) {
        return res.status(400).json({
          error: "No valid remittances found in the uploaded file",
        });
      }

      const year = parseInt(periodYear, 10);
      const month = parseInt(periodMonth, 10);

      // Upsert remittances for this provider+period
      // This will fail with 400 if no claims exist
      try {
        const inserted = await upsertRemittanceForPeriod(
          providerName,
          year,
          month,
          remittances
        );

        // Run reconciliation automatically
        const reconciliationResult = await runClaimReconciliation(
          providerName,
          year,
          month
        );

        res.json({
          success: true,
          provider: providerName,
          period: formatPeriod(year, month),
          remittancesStored: inserted.length,
          reconciliation: {
            totalClaims: reconciliationResult.summary.totalClaims,
            totalRemittances: reconciliationResult.summary.totalRemittances,
            autoMatched: reconciliationResult.summary.autoMatched,
            partialMatched: reconciliationResult.summary.partialMatched,
            manualReview: reconciliationResult.summary.manualReview,
            unpaidClaims: reconciliationResult.unpaidClaims,
            orphanRemittances: reconciliationResult.orphanRemittances,
          },
          message: "Remittances uploaded and reconciliation completed",
        });
      } catch (error: any) {
        // Check if it's the "no claims found" error
        if (error.message && error.message.includes("No claims found")) {
          return res.status(400).json({
            error: error.message,
            suggestion: "Please upload claims for this provider and period first",
          });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error uploading remittance:", error);
      res.status(500).json({
        error: error.message || "Failed to upload remittance",
      });
    }
  }
);

/**
 * GET /api/claim-reconciliation/period/:providerName/:year/:month
 * Get reconciliation status for a specific provider and period
 */
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

      // Calculate summary statistics
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

/**
 * POST /api/claim-reconciliation/upload
 * Upload and process claim reconciliation files
 */
router.post(
  "/upload",
  requireAuth,
  upload.fields([
    { name: "claimsFile", maxCount: 1 },
    { name: "remittanceFile", maxCount: 1 },
  ]),
  uploadHandler
);

/**
 * POST /api/claim-reconciliation/run
 * Alias for /upload endpoint
 */
router.post(
  "/run",
  requireAuth,
  upload.fields([
    { name: "claimsFile", maxCount: 1 },
    { name: "remittanceFile", maxCount: 1 },
  ]),
  uploadHandler
);

/**
 * GET /api/claim-reconciliation/runs
 * Get all reconciliation runs
 */
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

/**
 * GET /api/claim-reconciliation/runs/:runId
 * Get a specific reconciliation run
 */
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

/**
 * GET /api/claim-reconciliation/runs/:runId/claims
 * Get claims for a specific run
 */
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

/**
 * GET /api/claim-reconciliation/runs/:runId/remittances
 * Get remittances for a specific run
 */
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

/**
 * GET /api/claim-reconciliation/runs/:runId/issues/export
 * Export problem claims (partial / unpaid / review) as an Excel file
 */
router.get("/runs/:runId/issues/export", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    const run = await getReconRun(runId);

    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    const issueClaims = await getIssueClaimsForRun(runId);

    // Basic stats for the summary sheet
    const totalClaims = run.totalClaimRows ?? issueClaims.length;
    const totalRemits = run.totalRemittanceRows ?? 0;

    const unpaidCount = issueClaims.filter(
      (c) => parseFloat(c.amountPaid || "0") === 0
    ).length;

    const partialCount = issueClaims.filter(
      (c) =>
        parseFloat(c.amountPaid || "0") > 0 &&
        parseFloat(c.amountPaid) < parseFloat(c.billedAmount || "0")
    ).length;

    const problemCount = issueClaims.length;
    const fullyPaid = Math.max(totalClaims - problemCount, 0);

    const periodLabel = new Date(run.periodYear, run.periodMonth - 1).toLocaleString(
      "default",
      { month: "short", year: "numeric" }
    );

    // Build worksheet: summary + detail table
    const rows: any[][] = [];

    rows.push(["Provider", run.providerName]);
    rows.push(["Period", periodLabel]);
    rows.push(["Run date", new Date().toISOString().slice(0, 10)]);
    rows.push([]);
    rows.push(["Total claims sent", totalClaims]);
    rows.push(["Total remittances received", totalRemits]);
    rows.push(["Fully paid claims", fullyPaid]);
    rows.push(["Partially paid claims", partialCount]);
    rows.push(["Unpaid / no remittance", unpaidCount]);
    rows.push(["Total problem claims in this file", problemCount]);
    rows.push([]);
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

    const filename = `CIC-issues-${run.periodYear}-${run.periodMonth}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting issue claims:", error);
    res.status(500).json({
      error: error.message || "Failed to export issue claims",
    });
  }
});

/**
 * DELETE /api/claim-reconciliation/runs/:runId
 * Delete a reconciliation run and all its data (for test runs)
 */
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

export { router as claimReconciliationRouter };
