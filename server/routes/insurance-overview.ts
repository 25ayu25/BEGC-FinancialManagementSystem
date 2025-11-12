/**
 * Insurance Overview Page - Independent API Endpoints
 * 
 * This module provides dedicated endpoints for the insurance-overview page
 * that are completely independent from the main insurance page.
 * 
 * All endpoints:
 * - Require authentication via requireAuth middleware
 * - Filter for USD currency only
 * - Support independent filter parameters
 * - Return proper error responses
 * - Handle empty data gracefully
 * 
 * @module InsuranceOverviewRoutes
 */

import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db";

const router = Router();

/* ------------------------------------------------------------------ */
/* Helper Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse date range from query parameters
 */
function parseDateRange(req: Request): { start?: string; end?: string } {
  const start = req.query.startDate as string | undefined;
  const end = req.query.endDate as string | undefined;
  return { start, end };
}

/**
 * Parse provider filter from query parameters
 */
function parseProviders(req: Request): string[] {
  const providersParam = req.query.providers as string | undefined;
  if (!providersParam) return [];
  return providersParam.split(",").filter(Boolean);
}

/**
 * Parse status filter from query parameters
 */
function parseStatuses(req: Request): string[] {
  const statusParam = req.query.status as string | undefined;
  if (!statusParam) return [];
  return statusParam.split(",").filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* API Endpoints                                                       */
/* ------------------------------------------------------------------ */

/**
 * GET /api/insurance-overview/summary
 * 
 * Returns high-level KPI metrics for executive dashboard.
 * Filters: providers[], startDate, endDate, status[]
 * 
 * Response: {
 *   totalBilled: number,
 *   totalCollected: number,
 *   outstanding: number,
 *   collectionRate: number (percentage),
 *   avgDaysToPayment: number,
 *   claimCount: number,
 *   paymentCount: number
 * }
 */
router.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = parseDateRange(req);
    const providers = parseProviders(req);
    const statuses = parseStatuses(req);

    // Build WHERE clauses
    const claimWhere: string[] = ["c.currency = 'USD'"];
    const paymentWhere: string[] = ["p.currency = 'USD'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      claimWhere.push(`c.provider_id = ANY($${values.length})`);
      paymentWhere.push(`p.provider_id = ANY($${values.length})`);
    }

    if (start && end) {
      values.push(start);
      const startIdx = values.length;
      values.push(end);
      const endIdx = values.length;
      claimWhere.push(`c.period_start >= $${startIdx} AND c.period_end <= $${endIdx}`);
      paymentWhere.push(`p.payment_date >= $${startIdx} AND p.payment_date <= $${endIdx}`);
    }

    if (statuses.length > 0) {
      values.push(statuses);
      claimWhere.push(`c.status = ANY($${values.length})`);
    }

    // Get total billed from claims
    const billedQuery = `
      SELECT 
        COALESCE(SUM(c.claimed_amount), 0) as total_billed,
        COUNT(*) as claim_count
      FROM insurance_claims c
      WHERE ${claimWhere.join(" AND ")}
    `;

    // Get total collected from payments
    const collectedQuery = `
      SELECT 
        COALESCE(SUM(p.amount), 0) as total_collected,
        COUNT(*) as payment_count
      FROM insurance_payments p
      WHERE ${paymentWhere.join(" AND ")}
    `;

    // Get average days to payment
    const avgDaysQuery = `
      SELECT 
        COALESCE(AVG(p.payment_date::date - c.period_start::date), 0) as avg_days
      FROM insurance_payments p
      JOIN insurance_claims c ON p.claim_id = c.id
      WHERE p.currency = 'USD' AND c.currency = 'USD'
      ${start && end ? `AND p.payment_date >= $1 AND p.payment_date <= $2` : ''}
      ${providers.length > 0 ? `AND p.provider_id = ANY($${start && end ? 3 : 1})` : ''}
    `;

    const [billedResult, collectedResult, avgDaysResult] = await Promise.all([
      pool.query(billedQuery, values),
      pool.query(collectedQuery, values),
      pool.query(avgDaysQuery, providers.length > 0 && start && end ? [start, end, providers] : (start && end ? [start, end] : (providers.length > 0 ? [providers] : []))),
    ]);

    const totalBilled = Number(billedResult.rows[0]?.total_billed || 0);
    const totalCollected = Number(collectedResult.rows[0]?.total_collected || 0);
    const outstanding = totalBilled - totalCollected;
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
    const avgDaysToPayment = Number(avgDaysResult.rows[0]?.avg_days || 0);
    const claimCount = Number(billedResult.rows[0]?.claim_count || 0);
    const paymentCount = Number(collectedResult.rows[0]?.payment_count || 0);

    res.json({
      totalBilled,
      totalCollected,
      outstanding,
      collectionRate: Math.round(collectionRate * 100) / 100,
      avgDaysToPayment: Math.round(avgDaysToPayment),
      claimCount,
      paymentCount,
    });
  } catch (err) {
    console.error("Error in /api/insurance-overview/summary:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/aging
 * 
 * Returns aging analysis buckets for outstanding claims.
 * 
 * Response: {
 *   buckets: [
 *     { range: '0-30', amount: number, count: number },
 *     { range: '31-60', amount: number, count: number },
 *     { range: '61-90', amount: number, count: number },
 *     { range: '90+', amount: number, count: number }
 *   ]
 * }
 */
router.get("/aging", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = parseProviders(req);

    const where: string[] = ["c.currency = 'USD'", "c.status != 'paid'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      where.push(`c.provider_id = ANY($${values.length})`);
    }

    const query = `
      WITH aging_data AS (
        SELECT 
          c.claimed_amount,
          COALESCE(SUM(p.amount), 0) as paid_amount,
          CURRENT_DATE - c.period_start::date as days_outstanding
        FROM insurance_claims c
        LEFT JOIN insurance_payments p ON p.claim_id = c.id AND p.currency = 'USD'
        WHERE ${where.join(" AND ")}
        GROUP BY c.id, c.claimed_amount, c.period_start
      )
      SELECT 
        CASE 
          WHEN days_outstanding <= 30 THEN '0-30'
          WHEN days_outstanding <= 60 THEN '31-60'
          WHEN days_outstanding <= 90 THEN '61-90'
          ELSE '90+'
        END as range,
        SUM(claimed_amount - paid_amount) as amount,
        COUNT(*) as count
      FROM aging_data
      WHERE (claimed_amount - paid_amount) > 0
      GROUP BY range
      ORDER BY 
        CASE range
          WHEN '0-30' THEN 1
          WHEN '31-60' THEN 2
          WHEN '61-90' THEN 3
          WHEN '90+' THEN 4
        END
    `;

    const result = await pool.query(query, values);

    // Ensure all buckets are present even if empty
    const allBuckets = ['0-30', '31-60', '61-90', '90+'];
    const bucketMap = new Map(result.rows.map(row => [row.range, { amount: Number(row.amount), count: Number(row.count) }]));
    
    const buckets = allBuckets.map(range => ({
      range,
      amount: bucketMap.get(range)?.amount || 0,
      count: bucketMap.get(range)?.count || 0,
    }));

    res.json({ buckets });
  } catch (err) {
    console.error("Error in /api/insurance-overview/aging:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/provider-performance
 * 
 * Returns performance metrics for each insurance provider.
 * 
 * Response: [
 *   {
 *     providerId: string,
 *     name: string,
 *     billed: number,
 *     collected: number,
 *     outstanding: number,
 *     avgDays: number,
 *     performanceScore: number (0-100)
 *   }
 * ]
 */
router.get("/provider-performance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = parseDateRange(req);
    const providers = parseProviders(req);

    const where: string[] = ["c.currency = 'USD'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      where.push(`c.provider_id = ANY($${values.length})`);
    }

    if (start && end) {
      values.push(start, end);
      where.push(`c.period_start >= $${values.length - 1} AND c.period_end <= $${values.length}`);
    }

    const query = `
      SELECT 
        pr.id as provider_id,
        pr.name,
        COALESCE(SUM(c.claimed_amount), 0) as billed,
        COALESCE(SUM(p.amount), 0) as collected,
        COALESCE(AVG(CASE 
          WHEN p.payment_date IS NOT NULL 
          THEN p.payment_date::date - c.period_start::date 
          ELSE NULL 
        END), 0) as avg_days
      FROM insurance_providers pr
      LEFT JOIN insurance_claims c ON c.provider_id = pr.id AND ${where.join(" AND ")}
      LEFT JOIN insurance_payments p ON p.claim_id = c.id AND p.currency = 'USD'
      WHERE pr.is_active = true
      GROUP BY pr.id, pr.name
      ORDER BY billed DESC
    `;

    const result = await pool.query(query, values);

    const performance = result.rows.map(row => {
      const billed = Number(row.billed);
      const collected = Number(row.collected);
      const outstanding = billed - collected;
      const avgDays = Number(row.avg_days || 0);
      
      // Performance score: weighted by collection rate (70%) and payment speed (30%)
      const collectionRate = billed > 0 ? collected / billed : 0;
      const speedScore = avgDays > 0 ? Math.max(0, 1 - avgDays / 90) : 0; // 90 days = 0 score
      const performanceScore = Math.round((collectionRate * 70 + speedScore * 30) * 100) / 100;

      return {
        providerId: row.provider_id,
        name: row.name,
        billed,
        collected,
        outstanding,
        avgDays: Math.round(avgDays),
        performanceScore,
      };
    });

    res.json(performance);
  } catch (err) {
    console.error("Error in /api/insurance-overview/provider-performance:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/timeline-data
 * 
 * Returns time-series data for claims and payments over time.
 * Grouped by month.
 * 
 * Response: [
 *   { date: '2025-01', claims: number, payments: number }
 * ]
 */
router.get("/timeline-data", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = parseDateRange(req);
    const providers = parseProviders(req);

    const where: string[] = ["currency = 'USD'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      where.push(`provider_id = ANY($${values.length})`);
    }

    let dateFilter = '';
    if (start && end) {
      values.push(start, end);
      dateFilter = `AND period_start >= $${values.length - 1} AND period_end <= $${values.length}`;
    }

    const claimsQuery = `
      SELECT 
        TO_CHAR(period_start, 'YYYY-MM') as month,
        SUM(claimed_amount) as total
      FROM insurance_claims
      WHERE ${where.join(" AND ")} ${dateFilter}
      GROUP BY month
      ORDER BY month
    `;

    const paymentsQuery = `
      SELECT 
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount) as total
      FROM insurance_payments
      WHERE ${where.join(" AND ")} ${dateFilter.replace(/period_start/g, 'payment_date').replace(/period_end/g, 'payment_date')}
      GROUP BY month
      ORDER BY month
    `;

    const [claimsResult, paymentsResult] = await Promise.all([
      pool.query(claimsQuery, values),
      pool.query(paymentsQuery, values),
    ]);

    // Merge claims and payments by month
    const monthMap = new Map<string, { claims: number; payments: number }>();

    claimsResult.rows.forEach(row => {
      monthMap.set(row.month, { claims: Number(row.total), payments: 0 });
    });

    paymentsResult.rows.forEach(row => {
      const existing = monthMap.get(row.month);
      if (existing) {
        existing.payments = Number(row.total);
      } else {
        monthMap.set(row.month, { claims: 0, payments: Number(row.total) });
      }
    });

    const timeline = Array.from(monthMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(timeline);
  } catch (err) {
    console.error("Error in /api/insurance-overview/timeline-data:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/claims-list
 * 
 * Returns paginated list of claims with search, sort, and filters.
 * 
 * Query params: page, pageSize, search, sortBy, sortOrder, providers[], status[]
 * 
 * Response: {
 *   data: [...],
 *   total: number,
 *   page: number,
 *   pageSize: number
 * }
 */
router.get("/claims-list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 25;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'period_start';
    const sortOrder = (req.query.sortOrder as string) || 'DESC';
    const { start, end } = parseDateRange(req);
    const providers = parseProviders(req);
    const statuses = parseStatuses(req);

    const where: string[] = ["c.currency = 'USD'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      where.push(`c.provider_id = ANY($${values.length})`);
    }

    if (statuses.length > 0) {
      values.push(statuses);
      where.push(`c.status = ANY($${values.length})`);
    }

    if (start && end) {
      values.push(start, end);
      where.push(`c.period_start >= $${values.length - 1} AND c.period_end <= $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      where.push(`(c.notes ILIKE $${values.length} OR pr.name ILIKE $${values.length})`);
    }

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['period_start', 'claimed_amount', 'status', 'name'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'period_start';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM insurance_claims c
      JOIN insurance_providers pr ON pr.id = c.provider_id
      WHERE ${where.join(" AND ")}
    `;

    const dataQuery = `
      SELECT 
        c.id,
        c.provider_id,
        pr.name as provider_name,
        c.period_year,
        c.period_month,
        c.period_start,
        c.period_end,
        c.claimed_amount,
        c.status,
        c.notes,
        c.created_at,
        COALESCE(SUM(p.amount), 0) as paid_amount
      FROM insurance_claims c
      JOIN insurance_providers pr ON pr.id = c.provider_id
      LEFT JOIN insurance_payments p ON p.claim_id = c.id AND p.currency = 'USD'
      WHERE ${where.join(" AND ")}
      GROUP BY c.id, pr.name
      ORDER BY ${safeSortBy === 'name' ? 'pr.name' : 'c.' + safeSortBy} ${safeSortOrder}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, pageSize, (page - 1) * pageSize]),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');

    const data = dataResult.rows.map(row => ({
      id: row.id,
      providerId: row.provider_id,
      providerName: row.provider_name,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      claimedAmount: Number(row.claimed_amount),
      paidAmount: Number(row.paid_amount),
      balance: Number(row.claimed_amount) - Number(row.paid_amount),
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error("Error in /api/insurance-overview/claims-list:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/payments-list
 * 
 * Returns paginated list of payments with search, sort, and filters.
 * 
 * Query params: page, pageSize, search, sortBy, sortOrder, providers[]
 * 
 * Response: {
 *   data: [...],
 *   total: number,
 *   page: number,
 *   pageSize: number
 * }
 */
router.get("/payments-list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 25;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'payment_date';
    const sortOrder = (req.query.sortOrder as string) || 'DESC';
    const { start, end } = parseDateRange(req);
    const providers = parseProviders(req);

    const where: string[] = ["p.currency = 'USD'"];
    const values: any[] = [];

    if (providers.length > 0) {
      values.push(providers);
      where.push(`p.provider_id = ANY($${values.length})`);
    }

    if (start && end) {
      values.push(start, end);
      where.push(`p.payment_date >= $${values.length - 1} AND p.payment_date <= $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      where.push(`(p.notes ILIKE $${values.length} OR p.reference ILIKE $${values.length} OR pr.name ILIKE $${values.length})`);
    }

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['payment_date', 'amount', 'name'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'payment_date';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM insurance_payments p
      JOIN insurance_providers pr ON pr.id = p.provider_id
      WHERE ${where.join(" AND ")}
    `;

    const dataQuery = `
      SELECT 
        p.id,
        p.provider_id,
        pr.name as provider_name,
        p.claim_id,
        p.payment_date,
        p.amount,
        p.reference,
        p.notes,
        p.created_at
      FROM insurance_payments p
      JOIN insurance_providers pr ON pr.id = p.provider_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${safeSortBy === 'name' ? 'pr.name' : 'p.' + safeSortBy} ${safeSortOrder}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, pageSize, (page - 1) * pageSize]),
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');

    const data = dataResult.rows.map(row => ({
      id: row.id,
      providerId: row.provider_id,
      providerName: row.provider_name,
      claimId: row.claim_id,
      paymentDate: row.payment_date,
      amount: Number(row.amount),
      reference: row.reference,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error("Error in /api/insurance-overview/payments-list:", err);
    next(err);
  }
});

export default router;
