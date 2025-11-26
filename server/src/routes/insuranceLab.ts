import { Router } from "express";
import { db } from "../../db";
import { and, eq, sql } from "drizzle-orm";
import {
  insuranceDepartmentPortions,
  insuranceLabPayments,
} from "@shared/schema";

const router = Router();

// helpers
function normalizePeriod(q: any) {
  const year = parseInt(String(q.year), 10);
  const month = parseInt(String(q.month), 10);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Invalid period");
  }
  return { year, month };
}

/** GET summary: portion (LAB), due (35%), payments, balance */
router.get("/lab-summary", async (req, res) => {
  try {
    const { year, month } = normalizePeriod(req.query);

    const [portion] = await db
      .select()
      .from(insuranceDepartmentPortions)
      .where(
        and(
          eq(insuranceDepartmentPortions.periodYear, year),
          eq(insuranceDepartmentPortions.periodMonth, month),
          eq(insuranceDepartmentPortions.departmentCode, "LAB"),
        ),
      )
      .limit(1);

    const pays = await db
      .select()
      .from(insuranceLabPayments)
      .where(
        and(
          eq(insuranceLabPayments.periodYear, year),
          eq(insuranceLabPayments.periodMonth, month),
        ),
      )
      .orderBy(insuranceLabPayments.payDate);

    const currency = portion?.currency ?? "SSP";
    const portionNum = portion ? Number(portion.amount) : 0;
    // Calculate 35% share
    const due = +(portionNum * 0.35).toFixed(2);

    const paid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const balance = +(due - paid).toFixed(2);

    res.json({
      period: { year, month },
      portion: portion
        ? {
            currency,
            amount: portionNum,
            createdBy: portion.createdBy,
            createdAt: portion.createdAt,
          }
        : null,
      due: { currency, amount: due },
      paid: { currency, amount: +paid.toFixed(2) },
      balance: { currency, amount: balance },
      payments: pays,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Bad request" });
  }
});

/** POST/PUT portion for LAB (upsert per period) */
router.post("/lab-portion", async (req, res) => {
  try {
    const { periodYear, periodMonth, currency, amount } = req.body;
    if (!periodYear || !periodMonth || !currency || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = (req as any).user;
    const username = user?.username ?? "system";

    // Upsert using Drizzle SQL tag to ensure compatibility
    const inserted = await db.execute(sql`
      INSERT INTO insurance_department_portions (period_year, period_month, department_code, currency, amount, created_by)
      VALUES (${periodYear}, ${periodMonth}, 'LAB', ${currency}, ${amount}, ${username})
      ON CONFLICT (period_year, period_month, department_code)
      DO UPDATE SET 
        currency = excluded.currency, 
        amount = excluded.amount, 
        created_by = excluded.created_by, 
        created_at = now()
      RETURNING *;
    `);

    res.json(inserted.rows?.[0] ?? { ok: true });
  } catch (e: any) {
    console.error("Save portion error:", e);
    res
      .status(400)
      .json({ error: e.message ?? "Failed to save portion" });
  }
});

/** POST record a payment to lab tech */
router.post("/lab-payment", async (req, res) => {
  try {
    const { payDate, periodYear, periodMonth, currency, amount, note } =
      req.body;
    if (!payDate || !periodYear || !periodMonth || !currency || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = (req as any).user;
    const username = user?.username ?? "system";

    const [row] = await db
      .insert(insuranceLabPayments)
      .values({
        payDate,
        periodYear,
        periodMonth,
        currency,
        amount: String(amount), // ensure string for numeric field
        note,
        createdBy: username,
      })
      .returning();

    res.json(row);
  } catch (e: any) {
    console.error("Save payment error:", e);
    res
      .status(400)
      .json({ error: e.message ?? "Failed to save payment" });
  }
});

/** GET list payments for period */
router.get("/lab-payments", async (req, res) => {
  try {
    const { year, month } = normalizePeriod(req.query);
    const rows = await db
      .select()
      .from(insuranceLabPayments)
      .where(
        and(
          eq(insuranceLabPayments.periodYear, year),
          eq(insuranceLabPayments.periodMonth, month),
        ),
      )
      .orderBy(insuranceLabPayments.payDate);
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Bad request" });
  }
});

/** PUT update a lab payment */
router.put("/lab-payment/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);

    if (!rawId || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid payment id" });
    }

    const { payDate, periodYear, periodMonth, currency, amount, note } =
      req.body;
    if (!payDate || !periodYear || !periodMonth || !currency || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const [row] = await db
      .update(insuranceLabPayments)
      .set({
        payDate,
        periodYear,
        periodMonth,
        currency,
        amount: String(amount),
        note,
      })
      .where(eq(insuranceLabPayments.id, id))
      .returning();

    if (!row) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json(row);
  } catch (e: any) {
    console.error("Update lab payment error:", e);
    res
      .status(400)
      .json({ error: e.message ?? "Failed to update lab payment" });
  }
});

/** DELETE a lab payment */
router.delete("/lab-payment/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);

    if (!rawId || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid payment id" });
    }

    const [row] = await db
      .delete(insuranceLabPayments)
      .where(eq(insuranceLabPayments.id, id))
      .returning();

    if (!row) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({ ok: true, deletedId: id });
  } catch (e: any) {
    console.error("Delete lab payment error:", e);
    res
      .status(400)
      .json({ error: e.message ?? "Failed to delete lab payment" });
  }
});

export default router;
