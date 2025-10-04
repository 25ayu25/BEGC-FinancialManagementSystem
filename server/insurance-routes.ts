import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
// If your auth middleware has a different name, replace `requireAuth` below:
import { requireAuth } from "./production"; // <-- adjust if needed

const r = Router();

/* Zod schemas */
const ClaimCreate = z.object({
  providerId: z.string().min(1),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  periodStart: z.string().min(8),
  periodEnd: z.string().min(8),
  currency: z.enum(["USD", "SSP"]).default("USD"),
  claimedAmount: z.number().nonnegative(),
  status: z.enum(["submitted","partially_paid","paid","rejected","written_off"]).optional(),
  notes: z.string().optional(),
});

const ClaimPatch = z.object({
  claimedAmount: z.number().nonnegative().optional(),
  status: z.enum(["submitted","partially_paid","paid","rejected","written_off"]).optional(),
  notes: z.string().optional(),
});

const PaymentCreate = z.object({
  providerId: z.string().min(1),
  claimId: z.string().min(1).optional(),
  paymentDate: z.string().min(8),
  amount: z.number().positive(),
  currency: z.enum(["USD","SSP"]).default("USD"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/* Routes */
r.post("/api/insurance-claims", requireAuth, async (req, res, next) => {
  try {
    const input = ClaimCreate.parse(req.body);
    const row = await storage.createInsuranceClaim({
      ...input,
      // @ts-ignore
      createdBy: (req as any).user?.id ?? null,
    });
    res.json(row);
  } catch (e) { next(e); }
});

r.get("/api/insurance-claims", requireAuth, async (req, res, next) => {
  try {
    const rows = await storage.listInsuranceClaims({
      providerId: req.query.providerId as string | undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      month: req.query.month ? Number(req.query.month) : undefined,
      status: req.query.status as string | undefined,
    });
    res.json(rows);
  } catch (e) { next(e); }
});

r.get("/api/insurance-claims/:id", requireAuth, async (req, res, next) => {
  try {
    const row = await storage.getInsuranceClaim(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) { next(e); }
});

r.patch("/api/insurance-claims/:id", requireAuth, async (req, res, next) => {
  try {
    const patch = ClaimPatch.parse(req.body);
    const row = await storage.updateInsuranceClaim(req.params.id, patch);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) { next(e); }
});

r.post("/api/insurance-payments", requireAuth, async (req, res, next) => {
  try {
    const input = PaymentCreate.parse(req.body);
    const row = await storage.createInsurancePayment({
      ...input,
      // @ts-ignore
      createdBy: (req as any).user?.id ?? null,
    });
    res.json(row);
  } catch (e) { next(e); }
});

r.get("/api/insurance-balances", requireAuth, async (req, res, next) => {
  try {
    const data = await storage.getInsuranceBalances({
      providerId: req.query.providerId as string | undefined,
    });
    res.json(data);
  } catch (e) { next(e); }
});

export default r;
