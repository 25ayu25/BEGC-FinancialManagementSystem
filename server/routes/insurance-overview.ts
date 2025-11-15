/**
 * Insurance Overview Page - Analytics API
 * 
 * This module provides a single analytics endpoint for the insurance-overview page.
 * Fetches data from transactions table where type='income' and currency='USD'.
 * 
 * All endpoints:
 * - Require authentication via requireAuth middleware (applied at router level)
 * - Read-only analytics (no CRUD operations)
 * - Return aggregated data for visualization
 * 
 * @module InsuranceOverviewRoutes
 */

import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { storage } from "../storage";

const router = Router();

/* ------------------------------------------------------------------ */
/* Authentication                                                       */
/* ------------------------------------------------------------------ */
// Authentication is handled at the router level in server/routes.ts
// All routes in this module are protected by the requireAuth middleware

/* ------------------------------------------------------------------ */
/* Helper Functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Calculate date range based on preset filter
 */
function calculateDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  switch (preset) {
    case 'current-month': {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { start, end };
    }
    case 'last-month': {
      const start = new Date(currentYear, currentMonth - 1, 1);
      const end = new Date(currentYear, currentMonth, 0);
      return { start, end };
    }
    case 'last-3-months': {
      const start = new Date(currentYear, currentMonth - 2, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { start, end };
    }
    case 'ytd': {
      const start = new Date(currentYear, 0, 1);
      const end = now;
      return { start, end };
    }
    case 'last-year': {
      const start = new Date(currentYear - 1, 0, 1);
      const end = new Date(currentYear - 1, 11, 31);
      return { start, end };
    }
    default: {
      // Default to current month
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0);
      return { start, end };
    }
  }
}

/* ------------------------------------------------------------------ */
/* API Endpoints                                                       */
/* ------------------------------------------------------------------ */

/**
 * GET /api/insurance-overview/analytics
 * 
 * Returns comprehensive analytics data for the insurance overview page.
 * Fetches data from transactions table where type='income' and currency='USD'.
 * 
 * Query params:
 *   - preset: 'current-month', 'last-month', 'last-3-months', 'ytd', 'last-year', 'custom'
 *   - startDate: ISO date string (required when preset='custom')
 *   - endDate: ISO date string (required when preset='custom')
 * 
 * Response: {
 *   overview: {
 *     totalRevenue: number,
 *     activeProviders: number,
 *     vsLastMonth: number (percentage change)
 *   },
 *   providerShares: [
 *     { name: string, value: number, color: string }
 *   ],
 *   topProviders: [
 *     { rank: number, name: string, revenue: number, share: number, vsLastMonth: number }
 *   ]
 * }
 */
router.get("/analytics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preset = (req.query.preset as string) || 'current-month';
    
    let start: Date;
    let end: Date;
    
    // Handle custom date range
    if (preset === 'custom') {
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string;
      
      if (!startDateParam || !endDateParam) {
        return res.status(400).json({ 
          error: 'startDate and endDate are required for custom preset' 
        });
      }
      
      start = new Date(startDateParam);
      end = new Date(endDateParam);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          error: 'Invalid date format. Use ISO date strings.' 
        });
      }
      
      if (start > end) {
        return res.status(400).json({ 
          error: 'startDate must be before or equal to endDate' 
        });
      }
    } else {
      const dateRange = calculateDateRange(preset);
      start = dateRange.start;
      end = dateRange.end;
    }
    
    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodLength);
    const prevEnd = new Date(start);

    // Optimized Query: Get revenue by provider for both current and previous periods in one query
    const combinedQuery = `
      WITH current_revenue AS (
        SELECT 
          ip.id as provider_id,
          ip.name as provider_name,
          COALESCE(SUM(t.amount), 0) as revenue
        FROM insurance_providers ip
        LEFT JOIN transactions t ON t.insurance_provider_id = ip.id
          AND t.type = 'income'
          AND t.currency = 'USD'
          AND t.date >= $1
          AND t.date <= $2
        WHERE ip.is_active = true
        GROUP BY ip.id, ip.name
        HAVING COALESCE(SUM(t.amount), 0) > 0
      ),
      previous_revenue AS (
        SELECT 
          ip.id as provider_id,
          COALESCE(SUM(t.amount), 0) as revenue
        FROM insurance_providers ip
        LEFT JOIN transactions t ON t.insurance_provider_id = ip.id
          AND t.type = 'income'
          AND t.currency = 'USD'
          AND t.date >= $3
          AND t.date < $1
        WHERE ip.is_active = true
        GROUP BY ip.id
      ),
      active_providers AS (
        SELECT COUNT(DISTINCT insurance_provider_id) as active_count
        FROM transactions
        WHERE type = 'income'
          AND currency = 'USD'
          AND insurance_provider_id IS NOT NULL
          AND date >= $1
          AND date <= $2
      )
      SELECT 
        cr.provider_id,
        cr.provider_name,
        cr.revenue as current_revenue,
        COALESCE(pr.revenue, 0) as previous_revenue,
        ap.active_count
      FROM current_revenue cr
      LEFT JOIN previous_revenue pr ON cr.provider_id = pr.provider_id
      CROSS JOIN active_providers ap
      ORDER BY cr.revenue DESC
    `;

    const result = await pool.query(combinedQuery, [start, end, prevStart]);

    // Calculate total revenue for current period
    const totalRevenue = result.rows.reduce((sum, row) => sum + Number(row.current_revenue), 0);
    
    // Calculate total revenue for previous period
    const previousTotalRevenue = result.rows.reduce((sum, row) => sum + Number(row.previous_revenue), 0);
    
    // Calculate percentage change vs last period
    const vsLastMonth = previousTotalRevenue > 0
      ? ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
      : 0;

    const activeProviders = Number(result.rows[0]?.active_count || 0);

    // Provider shares for donut chart
    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
      "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
    ];
    
    const providerShares = result.rows.map((row, index) => ({
      name: row.provider_name,
      value: Number(row.current_revenue),
      color: colors[index % colors.length],
    }));

    // Top providers with performance cards (limit to top 3)
    const topProviders = result.rows.slice(0, 3).map((row, index) => {
      const currentRevenue = Number(row.current_revenue);
      const previousRevenue = Number(row.previous_revenue);
      const changePercent = previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;
      
      const share = totalRevenue > 0 ? (currentRevenue / totalRevenue) * 100 : 0;

      return {
        rank: index + 1,
        name: row.provider_name,
        revenue: currentRevenue,
        share,
        vsLastMonth: changePercent,
      };
    });

    res.json({
      overview: {
        totalRevenue,
        activeProviders,
        vsLastMonth,
      },
      providerShares,
      topProviders,
    });
  } catch (err) {
    console.error("Error in /api/insurance-overview/analytics:", err);
    next(err);
  }
});

export default router;
