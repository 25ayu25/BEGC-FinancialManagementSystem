import { Router } from "express";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { insuranceDepartmentPortions, insuranceLabPayments } from "@shared/schema";
import { ensureAuth } from "../middleware/auth"; // your existing auth
const router = Router();

// helpers
function normalizePeriod(q: any) {
  const year = parseInt(String(q.year), 10);
  const month = parseInt(String(q.month), 10);
  if (!year || !month || month < 1 || month > 12) throw new Error("Invalid period");
  return { year, month };
}

/** GET summary: portion (LAB), due (35%), payments, balance */
router.get("/lab-summary", ensureAuth, async (req, res) => {
  try {
    const { year, month } = normalizePeriod(req.query);

    const [portion] = await db
      .select()
      .from(insuranceDepartmentPortions)
      .where(and(
        eq(insuranceDepartmentPortions.periodYear, year),
        eq(insuranceDepartmentPortions.periodMonth, month),
        eq(insuranceDepartmentPortions.departmentCode, "LAB")
      ))
      .limit(1);

    const pays = await db
      .select()
      .from(insuranceLabPayments)
      .where(and(
        eq(insuranceLabPayments.periodYear, year),
        eq(insuranceLabPayments.periodMonth, month)
      ))
      .orderBy(insuranceLabPayments.payDate);

    const currency = portion?.currency ?? "SSP";
    const portionNum = portion ? Number(portion.amount) : 0;
    const due = +(portionNum * 0.35).toFixed(2);

    const paid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const balance = +(due - paid).toFixed(2);

    res.json({
      period: { year, month },
      portion: portion ? {
        currency,
        amount: portionNum,
        createdBy: portion.createdBy,
        createdAt: portion.createdAt
      } : null,
      due: { currency, amount: due },
      paid: { currency, amount: +paid.toFixed(2) },
      balance: { currency, amount: balance },
      payments: pays
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Bad request" });
  }
});

/** POST/PUT portion for LAB (upsert per period) */
router.post("/lab-portion", ensureAuth, async (req, res) => {
  try {
    const { periodYear, periodMonth, currency, amount } = req.body;
    if (!periodYear || !periodMonth || !currency || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // upsert via ON CONFLICT
    const inserted = await db.execute(`
      INSERT INTO insurance_department_portions (period_year, period_month, department_code, currency, amount, created_by)
      VALUES ($1, $2, 'LAB', $3, $4, $5)
      ON CONFLICT (period_year, period_month, department_code)
      DO UPDATE SET currency = excluded.currency, amount = excluded.amount, created_by = excluded.created_by, created_at = now()
      RETURNING *;
    `, [periodYear, periodMonth, currency, amount, req.user?.email ?? "system"]);

    res.json(inserted.rows?.[0] ?? { ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Failed to save portion" });
  }
});

/** POST record a payment to lab tech */
router.post("/lab-payment", ensureAuth, async (req, res) => {
  try {
    const { payDate, periodYear, periodMonth, currency, amount, note } = req.body;
    if (!payDate || !periodYear || !periodMonth || !currency || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const [row] = await db.insert(insuranceLabPayments).values({
      payDate, periodYear, periodMonth, currency, amount, note,
      createdBy: req.user?.email ?? "system"
    }).returning();
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Failed to save payment" });
  }
});

/** GET list payments for period */
router.get("/lab-payments", ensureAuth, async (req, res) => {
  try {
    const { year, month } = normalizePeriod(req.query);
    const rows = await db.select().from(insuranceLabPayments)
      .where(and(
        eq(insuranceLabPayments.periodYear, year),
        eq(insuranceLabPayments.periodMonth, month)
      ))
      .orderBy(insuranceLabPayments.payDate);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Bad request" });
  }
});

export default router;
