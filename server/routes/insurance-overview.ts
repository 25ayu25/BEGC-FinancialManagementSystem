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
import { 
  parseUTCDate, 
  getUTCDateRange, 
  isValidDateRange,
  getMonthStart 
} from "../lib/utcDateUtils";

const router = Router();

/* ------------------------------------------------------------------ */
/* Authentication                                                       */
/* ------------------------------------------------------------------ */
// Authentication is handled at the router level in server/routes.ts
// All routes in this module are protected by the requireAuth middleware

/* ------------------------------------------------------------------ */
/* Helper Functions                                                    */
/* ------------------------------------------------------------------ */

// No legacy helper functions needed - all date handling now uses utcDateUtils

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
    const preset = (req.query.preset as string) || 'last-month';
    
    let start: Date;
    let end: Date;
    
    // Check if explicit dates are provided (from frontend UTC date range calculation)
    // Frontend sends YYYY-MM-DD format which is timezone-agnostic
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    
    if (startDateParam && endDateParam) {
      // Parse YYYY-MM-DD strings as UTC dates at midnight
      // This prevents timezone interpretation issues
      start = parseUTCDate(startDateParam);
      end = parseUTCDate(endDateParam);
      
      // Validate dates
      if (!isValidDateRange(start, end)) {
        return res.status(400).json({ 
          error: 'Invalid date range. startDate must be before or equal to endDate' 
        });
      }
    } else {
      // Fall back to backend UTC calculation if no explicit dates provided
      const dateRange = getUTCDateRange(preset);
      start = dateRange.startDate;
      end = dateRange.endDate;
    }
    
    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodLength);
    const prevEnd = new Date(start);

    // Optimized Query: Get revenue by provider for both current and previous periods in one query
    // Uses exclusive end date comparison (date < end) for consistency
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
          AND t.date < $2
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
          AND date < $2
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

    // Get YTD total revenue using UTC date range
    const ytdRange = getUTCDateRange('ytd');
    const ytdQuery = `
      SELECT COALESCE(SUM(amount), 0) as ytd_revenue
      FROM transactions
      WHERE type = 'income'
        AND currency = 'USD'
        AND insurance_provider_id IS NOT NULL
        AND date >= $1
        AND date < $2
    `;
    const ytdResult = await pool.query(ytdQuery, [ytdRange.startDate, ytdRange.endDate]);
    const ytdRevenue = Number(ytdResult.rows[0]?.ytd_revenue || 0);

    // Get last 12 months trend data for sparkline
    const trendQuery = `
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(amount) as revenue
      FROM transactions
      WHERE type = 'income'
        AND currency = 'USD'
        AND insurance_provider_id IS NOT NULL
        AND date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        AND date < CURRENT_DATE
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month ASC
    `;
    const trendResult = await pool.query(trendQuery);
    const trendData = trendResult.rows.map(row => Number(row.revenue));

    // Get best performing month (highest revenue month in last 12 months)
    const bestMonthQuery = `
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(amount) as revenue
      FROM transactions
      WHERE type = 'income'
        AND currency = 'USD'
        AND insurance_provider_id IS NOT NULL
        AND date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY revenue DESC
      LIMIT 1
    `;
    const bestMonthResult = await pool.query(bestMonthQuery);
    const bestMonth = bestMonthResult.rows[0] ? {
      month: bestMonthResult.rows[0].month,
      revenue: Number(bestMonthResult.rows[0].revenue)
    } : null;

    // Provider shares for donut chart
    // Colors are assigned dynamically for consistent visualization across components
    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
      "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
    ];
    
    const providerShares = result.rows.map((row, index) => ({
      name: row.provider_name,
      value: Number(row.current_revenue),
      color: colors[index % colors.length], // Assign color by provider rank
    }));

    // Top providers with performance cards (show all)
    // Colors match the donut chart for visual consistency
    const topProviders = result.rows.map((row, index) => {
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
        color: colors[index % colors.length], // Matches providerShares color
      };
    });

    // Calculate additional metrics
    const avgRevenuePerProvider = activeProviders > 0 ? totalRevenue / activeProviders : 0;
    
    // Projected monthly total (simple linear projection based on current month progress)
    const now = new Date();
    const isCurrentMonth = preset === 'current-month' || 
      (start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear());
    
    let projectedMonthlyTotal = totalRevenue;
    if (isCurrentMonth) {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const daysRemaining = daysInMonth - dayOfMonth;
      const avgDailyRevenue = totalRevenue / dayOfMonth;
      projectedMonthlyTotal = totalRevenue + (avgDailyRevenue * daysRemaining);
    }

    res.json({
      overview: {
        totalRevenue,
        activeProviders,
        vsLastMonth,
        avgRevenuePerProvider,
        projectedMonthlyTotal: isCurrentMonth ? projectedMonthlyTotal : null,
        ytdRevenue,
        bestMonth,
        trendData,
      },
      providerShares,
      topProviders,
    });
  } catch (err) {
    console.error("Error in /api/insurance-overview/analytics:", err);
    next(err);
  }
});

/**
 * GET /api/insurance-overview/trends
 * 
 * Returns historical trend data for revenue over time, with optional provider breakdown.
 * 
 * Query params:
 *   - preset: Same as analytics endpoint
 *   - startDate, endDate: Custom dates
 *   - providerId: Optional - if provided, returns trend for specific provider
 *   - byProvider: 'true' to get breakdown by provider
 * 
 * Response: {
 *   trends: [
 *     { month: Date, revenue: number, [providerName]: number }
 *   ]
 * }
 */
router.get("/trends", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preset = (req.query.preset as string) || 'last-6-months';
    const byProvider = req.query.byProvider === 'true';
    const providerId = req.query.providerId as string | undefined;
    
    let start: Date;
    let end: Date;
    
    // Check if explicit dates are provided (from frontend UTC date range calculation)
    // Frontend sends YYYY-MM-DD format which is timezone-agnostic
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;
    
    if (startDateParam && endDateParam) {
      // Parse YYYY-MM-DD strings as UTC dates at midnight
      start = parseUTCDate(startDateParam);
      end = parseUTCDate(endDateParam);
      
      // Validate dates
      if (!isValidDateRange(start, end)) {
        return res.status(400).json({ 
          error: 'Invalid date range. startDate must be before or equal to endDate' 
        });
      }
    } else {
      // Fall back to backend UTC calculation if no explicit dates provided
      const dateRange = getUTCDateRange(preset);
      start = dateRange.startDate;
      end = dateRange.endDate;
    }

    if (byProvider && !providerId) {
      // Get trends broken down by provider - using application-level aggregation
      // Uses exclusive end date (date < end) for consistency
      const query = `
        SELECT 
          t.date,
          ip.name as provider_name,
          ip.id as provider_id,
          t.amount
        FROM transactions t
        INNER JOIN insurance_providers ip ON t.insurance_provider_id = ip.id
        WHERE t.type = 'income'
          AND t.currency = 'USD'
          AND t.date >= $1
          AND t.date < $2
          AND ip.is_active = true
      `;
      
      const txData = await pool.query(query, [start, end]);
      
      // Initialize ONLY the months in the requested range
      const monthMap = new Map<string, any>();
      
      // Get month boundaries
      const startMonth = getMonthStart(start);
      const endMonth = getMonthStart(end);
      
      // Pre-populate ONLY valid months
      const cursor = new Date(startMonth);
      while (cursor <= endMonth) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, {
          month: new Date(cursor),
          total: 0
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      
      // Aggregate transactions by provider into pre-initialized months
      for (const row of txData.rows) {
        const txDate = new Date(row.date);
        const key = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Skip transaction outside date range - this prevents data leakage from edge months
        if (!monthMap.has(key)) continue;
        
        const monthData = monthMap.get(key);
        monthData[row.provider_name] = (monthData[row.provider_name] || 0) + Number(row.amount);
        monthData.total += Number(row.amount);
      }
      
      // Convert to array and sort
      const trends = Array.from(monthMap.values())
        .sort((a, b) => a.month.getTime() - b.month.getTime());
      
      // Get provider list (unique providers that have transactions in this period)
      const providerSet = new Map<string, { id: string; name: string }>();
      for (const row of txData.rows) {
        if (!providerSet.has(row.provider_id)) {
          providerSet.set(row.provider_id, {
            id: row.provider_id,
            name: row.provider_name
          });
        }
      }
      const providers = Array.from(providerSet.values()).sort((a, b) => a.name.localeCompare(b.name));
      
      res.json({ trends, providers });
    } else if (providerId) {
      // Get trend for specific provider - using application-level aggregation
      // Uses exclusive end date (date < end) for consistency
      const query = `
        SELECT date, amount
        FROM transactions
        WHERE type = 'income'
          AND currency = 'USD'
          AND insurance_provider_id = $1
          AND date >= $2
          AND date < $3
      `;
      
      const txData = await pool.query(query, [providerId, start, end]);
      
      // Initialize ONLY the months in the requested range
      const monthMap = new Map<string, { month: Date; revenue: number }>();
      
      // Get month boundaries
      const startMonth = getMonthStart(start);
      const endMonth = getMonthStart(end);
      
      // Pre-populate ONLY valid months
      const cursor = new Date(startMonth);
      while (cursor <= endMonth) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, {
          month: new Date(cursor),
          revenue: 0
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      
      // Aggregate transactions into pre-initialized months
      for (const row of txData.rows) {
        const txDate = new Date(row.date);
        const key = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Skip transaction outside date range - this prevents data leakage from edge months
        const monthData = monthMap.get(key);
        if (!monthData) continue;
        
        monthData.revenue += Number(row.amount);
      }
      
      // Convert to array and sort
      const trends = Array.from(monthMap.values())
        .sort((a, b) => a.month.getTime() - b.month.getTime());
      
      res.json({ trends });
    } else {
      // Get overall trend - using application-level aggregation (like Trends page)
      // Uses exclusive end date (date < end) for consistency
      const query = `
        SELECT date, amount
        FROM transactions
        WHERE type = 'income'
          AND currency = 'USD'
          AND insurance_provider_id IS NOT NULL
          AND date >= $1
          AND date < $2
      `;
      
      const txData = await pool.query(query, [start, end]);
      
      // Initialize ONLY the months in the requested range
      const monthMap = new Map<string, { month: Date; revenue: number }>();
      
      // Get month boundaries
      const startMonth = getMonthStart(start);
      const endMonth = getMonthStart(end);
      
      // Pre-populate ONLY valid months
      const cursor = new Date(startMonth);
      while (cursor <= endMonth) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, {
          month: new Date(cursor),
          revenue: 0
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      
      // Aggregate transactions into pre-initialized months
      for (const row of txData.rows) {
        const txDate = new Date(row.date);
        const key = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`;
        
        // Skip transaction outside date range - this prevents data leakage from edge months
        const monthData = monthMap.get(key);
        if (!monthData) continue;
        
        monthData.revenue += Number(row.amount);
      }
      
      // Convert to array and sort
      const trends = Array.from(monthMap.values())
        .sort((a, b) => a.month.getTime() - b.month.getTime());
      
      res.json({ trends });
    }
  } catch (err) {
    console.error("Error in /api/insurance-overview/trends:", err);
    next(err);
  }
});

export default router;
