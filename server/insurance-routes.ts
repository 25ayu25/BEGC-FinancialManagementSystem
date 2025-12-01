import { Router, Request, Response } from "express";
import { z } from "zod";
// ⬇️ If your db.ts exports something else, adjust this import + query calls.
import { pool } from "./db";

const router = Router();

/* ---------------------------- ZOD SCHEMAS ---------------------------- */

const ClaimCreate = z.object({
  providerId: z.string().min(1),
  periodStart: z.string().min(8), // "YYYY-MM-DD"
  periodEnd: z.string().min(8),
  currency: z.enum(["USD", "SSP"]).default("USD"),
  claimedAmount: z.number().positive(),
  notes: z.string().optional(),
});

const ClaimPatch = ClaimCreate.partial();

const PaymentCreate = z.object({
  providerId: z.string().min(1),
  claimId: z.string().min(1).optional(),
  paymentDate: z.string().min(8),
  amount: z.number().positive(),
  currency: z.enum(["USD", "SSP"]).default("USD"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

/* ------------------------------ HELPERS ------------------------------ */

type Window = { start?: string; end?: string };
const isIso = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function getWindow(req: Request): Window {
  // NEW UI sends start & end for YTD/Year/Custom. “All time” sends none.
  const start = typeof req.query.start === "string" ? req.query.start : undefined;
  const end = typeof req.query.end === "string" ? req.query.end : undefined;

  if (isIso(start) && isIso(end)) return { start, end };

  // Backward-compat: ?year=2025 or ?year=2025&month=10
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  if (year && !month) return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (year && month) {
    const mm = String(month).padStart(2, "0");
    // last day of month
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` };
  }

  // no window = all time
  return {};
}

function paramsIndex(startAt: number, list: unknown[]) {
  // helper to generate $1, $2, ... starting from startAt
  return list.map((_, i) => `$${startAt + i}`).join(", ");
}

/* ------------------------------ QUERIES ------------------------------ */

async function query<T = any>(text: string, values: any[] = []): Promise<T[]> {
  const res = await pool.query(text, values);
  return res.rows as T[];
}

/* ------------------------------- ROUTES ------------------------------ */

/**
 * GET /api/insurance-claims
 * Supports: ?providerId= & ?status= & ?start=YYYY-MM-DD & ?end=YYYY-MM-DD
 */
router.get("/insurance-claims", async (req: Request, res: Response) => {
  try {
    const { start, end } = getWindow(req);
    const providerId = (req.query.providerId as string) || "";
    const status = (req.query.status as string) || "";

    const where: string[] = [];
    const vals: any[] = [];

    if (providerId) {
      vals.push(providerId);
      where.push(`c.provider_id = $${vals.length}`);
    }
    if (status) {
      vals.push(status);
      where.push(`c.status = $${vals.length}`);
    }
    if (start && end) {
      vals.push(start, end);
      where.push(`c.period_start >= $${vals.length - 1} AND c.period_end <= $${vals.length}`);
    }

    const sql = `
      SELECT
        c.id, c.provider_id as "providerId", c.period_year as "periodYear",
        c.period_month as "periodMonth", c.period_start as "periodStart",
        c.period_end as "periodEnd", c.currency, c.claimed_amount as "claimedAmount",
        c.status, c.notes, c.created_at as "createdAt"
      FROM insurance_claims c
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.period_start DESC, c.created_at DESC
    `;

    const rows = await query(sql, vals);
    res.json(rows);
  } catch (e: any) {
    console.error("GET /insurance-claims", e);
    res.status(500).json({ error: "Failed to load claims" });
  }
});

/**
 * GET /api/insurance-payments
 * Supports: ?providerId= & ?start=YYYY-MM-DD & ?end=YYYY-MM-DD
 */
router.get("/insurance-payments", async (req: Request, res: Response) => {
  try {
    const { start, end } = getWindow(req);
    const providerId = (req.query.providerId as string) || "";

    const where: string[] = [];
    const vals: any[] = [];

    if (providerId) {
      vals.push(providerId);
      where.push(`p.provider_id = $${vals.length}`);
    }
    if (start && end) {
      vals.push(start, end);
      where.push(`p.payment_date >= $${vals.length - 1} AND p.payment_date <= $${vals.length}`);
    }

    const sql = `
      SELECT
        p.id, p.provider_id as "providerId", p.claim_id as "claimId",
        TO_CHAR(COALESCE(p.payment_date, p.created_at), 'YYYY-MM-DD') as "paymentDate", p.amount, p.currency,
        p.reference, p.notes, TO_CHAR(p.created_at, 'YYYY-MM-DD') as "createdAt"
      FROM insurance_payments p
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY p.payment_date DESC, p.created_at DESC
    `;

    const rows = await query(sql, vals);
    res.json(rows);
  } catch (e: any) {
    console.error("GET /insurance-payments", e);
    res.status(500).json({ error: "Failed to load payments" });
  }
});

/**
 * GET /api/insurance-balances
 * Supports: ?providerId= & ?start=YYYY-MM-DD & ?end=YYYY-MM-DD
 * Returns:
 *  {
 *    providers: [{ providerId, providerName, claimed, paid, balance, openingBalance, openingBalanceAsOf }],
 *    claims: [{...claim, providerName, paidToDate, balance }]
 *  }
 */
router.get("/insurance-balances", async (req: Request, res: Response) => {
  try {
    const { start, end } = getWindow(req);
    const providerId = (req.query.providerId as string) || "";

    const providerFilter: string[] = [];
    const providerVals: any[] = [];

    if (providerId) {
      providerVals.push(providerId);
      providerFilter.push(`p.id = $${providerVals.length}`);
    }

    // ---- per-provider aggregates within window ----
    const withinWhere: string[] = [];
    const withinVals: any[] = [];

    if (providerId) {
      withinVals.push(providerId);
      withinWhere.push(`c.provider_id = $${withinVals.length}`);
    }
    if (start && end) {
      withinVals.push(start, end);
      withinWhere.push(`c.period_start >= $${withinVals.length - 1} AND c.period_end <= $${withinVals.length}`);
    }

    const withinBilledSql = `
      SELECT c.provider_id, COALESCE(SUM(c.claimed_amount),0) AS billed
      FROM insurance_claims c
      ${withinWhere.length ? "WHERE " + withinWhere.join(" AND ") : ""}
      GROUP BY c.provider_id
    `;
    const billedRows = await query<{ provider_id: string; billed: string }>(withinBilledSql, withinVals);

    const withinPaidWhere: string[] = [];
    const withinPaidVals: any[] = [];
    if (providerId) {
      withinPaidVals.push(providerId);
      withinPaidWhere.push(`p.provider_id = $${withinPaidVals.length}`);
    }
    if (start && end) {
      withinPaidVals.push(start, end);
      withinPaidWhere.push(`p.payment_date >= $${withinPaidVals.length - 1} AND p.payment_date <= $${withinPaidVals.length}`);
    }

    const withinPaidSql = `
      SELECT p.provider_id, COALESCE(SUM(p.amount),0) AS paid
      FROM insurance_payments p
      ${withinPaidWhere.length ? "WHERE " + withinPaidWhere.join(" AND ") : ""}
      GROUP BY p.provider_id
    `;
    const paidRows = await query<{ provider_id: string; paid: string }>(withinPaidSql, withinPaidVals);

    // ---- opening balance (carry forward) before start ----
    let openingRows: { provider_id: string; opening: string }[] = [];
    if (start) {
      const openVals: any[] = [start];
      const openProv = providerId ? "AND c.provider_id = $2" : "";
      if (providerId) openVals.push(providerId);

      const openClaimSql = `
        SELECT c.provider_id, COALESCE(SUM(c.claimed_amount),0) as opening_claimed
        FROM insurance_claims c
        WHERE c.period_start < $1 ${openProv}
        GROUP BY c.provider_id
      `;
      const openPaySql = `
        SELECT p.provider_id, COALESCE(SUM(p.amount),0) as opening_paid
        FROM insurance_payments p
        WHERE p.payment_date < $1 ${providerId ? "AND p.provider_id = $2" : ""}
        GROUP BY p.provider_id
      `;

      const [oc, op] = await Promise.all([
        query<{ provider_id: string; opening_claimed: string }>(openClaimSql, openVals),
        query<{ provider_id: string; opening_paid: string }>(openPaySql, openVals),
      ]);

      const map = new Map<string, number>();
      oc.forEach(r => map.set(r.provider_id, Number(r.opening_claimed)));
      op.forEach(r => map.set(r.provider_id, (map.get(r.provider_id) || 0) - Number(r.opening_paid)));

      openingRows = Array.from(map.entries()).map(([provider_id, opening]) => ({ provider_id, opening: String(opening) }));
    }

    // ---- providers list to project names and zero-fill ----
    const providersSql = `
      SELECT p.id, p.name
      FROM insurance_providers p
      ${providerFilter.length ? "WHERE " + providerFilter.join(" AND ") : ""}
    `;
    const providers = await query<{ id: string; name: string }>(providersSql, providerVals);

    // index helpers
    const billedMap = new Map(billedRows.map(r => [r.provider_id, Number(r.billed)]));
    const paidMap = new Map(paidRows.map(r => [r.provider_id, Number(r.paid)]));
    const openingMap = new Map(openingRows.map(r => [r.provider_id, Number(r.opening)]));

    const providerAgg = providers.map(p => {
      const claimed = billedMap.get(p.id) || 0;
      const paid = paidMap.get(p.id) || 0;
      const openingBalance = openingMap.get(p.id) || 0;
      const balance = claimed - paid + openingBalance;
      return {
        providerId: p.id,
        providerName: p.name,
        claimed,
        paid,
        balance,
        openingBalance,
        openingBalanceAsOf: start || null,
      };
    });

    // ---- individual claims within window (for drawer + table) ----
    const claimsWhere: string[] = [];
    const claimsVals: any[] = [];
    if (providerId) {
      claimsVals.push(providerId);
      claimsWhere.push(`c.provider_id = $${claimsVals.length}`);
    }
    if (start && end) {
      claimsVals.push(start, end);
      claimsWhere.push(`c.period_start >= $${claimsVals.length - 1} AND c.period_end <= $${claimsVals.length}`);
    }

    const claimsSql = `
      SELECT
        c.id, c.provider_id as "providerId", p.name as "providerName",
        c.period_year as "periodYear", c.period_month as "periodMonth",
        c.period_start as "periodStart", c.period_end as "periodEnd",
        c.currency, c.claimed_amount as "claimedAmount", c.status, c.notes, c.created_at as "createdAt",
        COALESCE(SUM(pp.amount),0) as "paidToDate"
      FROM insurance_claims c
      JOIN insurance_providers p ON p.id = c.provider_id
      LEFT JOIN insurance_payments pp ON pp.claim_id = c.id
      ${claimsWhere.length ? "WHERE " + claimsWhere.join(" AND ") : ""}
      GROUP BY c.id, p.name
      ORDER BY c.period_start DESC, c.created_at DESC
    `;
    const claimRows = await query<any>(claimsSql, claimsVals);
    const claims = claimRows.map(r => ({
      ...r,
      balance: Number(r.claimedAmount) - Number(r.paidToDate),
    }));

    res.json({ providers: providerAgg, claims });
  } catch (e: any) {
    console.error("GET /insurance-balances", e);
    res.status(500).json({ error: "Failed to load balances" });
  }
});

/**
 * POST /api/insurance-claims
 * Body: { providerId, periodStart, periodEnd, currency, claimedAmount, notes? }
 * Computes period_year/month server-side.
 */
router.post("/insurance-claims", async (req: Request, res: Response) => {
  try {
    const data = ClaimCreate.parse(req.body);
    const start = new Date(data.periodStart + "T00:00:00Z");
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;

    const vals = [
      data.providerId,
      year,
      month,
      data.periodStart,
      data.periodEnd,
      data.currency,
      data.claimedAmount,
      "submitted",
      data.notes || null,
    ];

    const sql = `
      INSERT INTO insurance_claims
        (provider_id, period_year, period_month, period_start, period_end,
         currency, claimed_amount, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `;
    const rows = await query<{ id: string }>(sql, vals);
    res.json({ id: rows[0].id });
  } catch (e: any) {
    console.error("POST /insurance-claims", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

/**
 * PATCH /api/insurance-claims/:id
 */
router.patch("/insurance-claims/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = ClaimPatch.parse(req.body);

    // Build dynamic patch
    const sets: string[] = [];
    const vals: any[] = [];
    const add = (col: string, val: any) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };

    if (data.providerId) add("provider_id", data.providerId);
    if (data.periodStart) add("period_start", data.periodStart);
    if (data.periodEnd) add("period_end", data.periodEnd);
    if (data.currency) add("currency", data.currency);
    if (typeof data.claimedAmount === "number") add("claimed_amount", data.claimedAmount);
    if (typeof data.notes === "string") add("notes", data.notes);

    // If periodStart changed, recompute year/month
    if (data.periodStart) {
      const d = new Date(data.periodStart + "T00:00:00Z");
      add("period_year", d.getUTCFullYear());
      add("period_month", d.getUTCMonth() + 1);
    }

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);
    const sql = `UPDATE insurance_claims SET ${sets.join(", ")} WHERE id = $${vals.length}`;
    await query(sql, vals);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("PATCH /insurance-claims/:id", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

/**
 * POST /api/insurance-payments
 */
router.post("/insurance-payments", async (req: Request, res: Response) => {
  try {
    const data = PaymentCreate.parse(req.body);
    const vals = [
      data.providerId,
      data.claimId || null,
      data.paymentDate,
      data.amount,
      data.currency,
      data.reference || null,
      data.notes || null,
    ];
    const sql = `
      INSERT INTO insurance_payments
        (provider_id, claim_id, payment_date, amount, currency, reference, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const rows = await query<{ id: string }>(sql, vals);
    res.json({ id: rows[0].id });
  } catch (e: any) {
    console.error("POST /insurance-payments", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

/**
 * PATCH /api/insurance-payments/:id
 */
router.patch("/insurance-payments/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = PaymentCreate.partial().parse(req.body);

    const sets: string[] = [];
    const vals: any[] = [];
    const add = (col: string, val: any) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };

    if (data.providerId) add("provider_id", data.providerId);
    if (typeof data.claimId !== "undefined") add("claim_id", data.claimId || null);
    if (data.paymentDate) add("payment_date", data.paymentDate);
    if (typeof data.amount === "number") add("amount", data.amount);
    if (data.currency) add("currency", data.currency);
    if (typeof data.reference !== "undefined") add("reference", data.reference || null);
    if (typeof data.notes !== "undefined") add("notes", data.notes || null);

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);
    const sql = `UPDATE insurance_payments SET ${sets.join(", ")} WHERE id = $${vals.length}`;
    await query(sql, vals);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("PATCH /insurance-payments/:id", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

/**
 * DELETE endpoints (used by the UI)
 */
router.delete("/insurance-claims/:id", async (req, res) => {
  try {
    await query(`DELETE FROM insurance_claims WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /insurance-claims/:id", e);
    res.status(500).json({ error: "Failed to delete claim" });
  }
});

router.delete("/insurance-payments/:id", async (req, res) => {
  try {
    await query(`DELETE FROM insurance_payments WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /insurance-payments/:id", e);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

export default router;
