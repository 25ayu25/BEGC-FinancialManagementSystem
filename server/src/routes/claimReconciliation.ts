// server/src/routes/claimReconciliation.ts

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
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
  deleteReconRun,
} from "../claimReconciliation/service";

const router = Router();

// Auth middleware - extracted from main routes for consistency
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
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));

    if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed."));
    }
  },
});

// Shared handler for POST /upload and POST /run
const uploadHandler = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { providerName, periodYear, periodMonth } = req.body;
    const userId = req.user?.id; // Get from authenticated user

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

    if (!files.claimsFile || !files.remittanceFile) {
      return res.status(400).json({
        error: "Both claimsFile and remittanceFile are required",
      });
    }

    // Parse files
    const claimsBuffer = files.claimsFile[0].buffer;
    const remittanceBuffer = files.remittanceFile[0].buffer;

    const claims = parseClaimsFile(claimsBuffer);
    const remittances = parseRemittanceFile(remittanceBuffer);

    // Validate parsed data
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
 * Alias for /upload endpoint - accepts the same multipart form-data
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
    if (Number.isNaN(runId)) {
      return res.status(400).json({ error: "Invalid runId" });
    }

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
    if (Number.isNaN(runId)) {
      return res.status(400).json({ error: "Invalid runId" });
    }

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
    if (Number.isNaN(runId)) {
      return res.status(400).json({ error: "Invalid runId" });
    }

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
 * DELETE /api/claim-reconciliation/runs/:runId
 * Delete a reconciliation run (and its claims/remittances)
 */
router.delete("/runs/:runId", requireAuth, async (req, res) => {
  try {
    const runId = parseInt(req.params.runId, 10);
    if (Number.isNaN(runId)) {
      return res.status(400).json({ error: "Invalid runId" });
    }

    // Optional: only allow admin or the user who created the run to delete it
    const run = await getReconRun(runId);
    if (!run) {
      return res.status(404).json({ error: "Reconciliation run not found" });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = run.createdBy === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "You are not allowed to delete this run" });
    }

    await deleteReconRun(runId);

    res.json({
      success: true,
      message: "Reconciliation run deleted",
    });
  } catch (error: any) {
    console.error("Error deleting reconciliation run:", error);
    res.status(500).json({
      error: error.message || "Failed to delete reconciliation run",
    });
  }
});

export { router as claimReconciliationRouter };
