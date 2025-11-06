// server/src/routes/claimReconciliation.ts

import { Router } from "express";
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
} from "../claimReconciliation/service";

const router = Router();

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
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files are allowed."));
    }
  },
});

/**
 * POST /api/claim-reconciliation/upload
 * Upload and process claim reconciliation files
 */
router.post(
  "/upload",
  upload.fields([
    { name: "claimsFile", maxCount: 1 },
    { name: "remittanceFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const { providerName, periodYear, periodMonth, userId } = req.body;

      // Validate required fields
      if (!providerName || !periodYear || !periodMonth || !userId) {
        return res.status(400).json({
          error: "Missing required fields: providerName, periodYear, periodMonth, userId",
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
        parseInt(periodYear),
        parseInt(periodMonth),
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
  }
);

/**
 * GET /api/claim-reconciliation/runs
 * Get all reconciliation runs
 */
router.get("/runs", async (_req, res) => {
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
router.get("/runs/:runId", async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
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
router.get("/runs/:runId/claims", async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
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
router.get("/runs/:runId/remittances", async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    const remittances = await getRemittancesForRun(runId);
    res.json(remittances);
  } catch (error: any) {
    console.error("Error fetching remittances:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch remittances",
    });
  }
});

export { router as claimReconciliationRouter };
