/**
 * UTC Date Utilities for Backend
 * 
 * Server-side date handling utilities that enforce UTC timezone for consistent
 * date filtering. This mirrors the client-side utilities to ensure consistency.
 * 
 * ⚠️ IMPORTANT - DATE RANGE CALCULATION:
 * The getUTCDateRange() function below is primarily used as a fallback when
 * clients don't send explicit date parameters. In most cases, the frontend
 * calculates date ranges using the canonical @/lib/dateRanges.ts and sends
 * explicit startDate/endDate parameters, which is the preferred approach.
 * 
 * Key Principles:
 * 1. All date calculations must be done in UTC
 * 2. Parse YYYY-MM-DD strings as UTC dates
 * 3. SQL queries use exclusive end dates (date < end, not date <= end)
 * 4. No timezone conversions - everything stays in UTC
 * 
 * @module utcDateUtils
 */

/**
 * Create a UTC date at midnight (00:00:00.000Z)
 * 
 * @param year - Full year (e.g., 2025)
 * @param month - 1-indexed month (1 = January, 12 = December)
 * @param day - Day of month (default: 1)
 * @returns Date object representing midnight UTC
 */
export function createUTCDate(year: number, month: number, day: number = 1): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Get the first day of a month in UTC
 * 
 * @param year - Full year
 * @param month - 1-indexed month (1 = January, 12 = December)
 * @returns Date object representing first day of month at midnight UTC
 */
export function getUTCMonthStart(year: number, month: number): Date {
  return createUTCDate(year, month, 1);
}

/**
 * Get the first day of the next month in UTC
 * Used for exclusive end dates in SQL queries (date < endDate)
 * 
 * @param year - Full year
 * @param month - 1-indexed month (1 = January, 12 = December)
 * @returns Date object representing first day of next month at midnight UTC
 */
export function getUTCNextMonthStart(year: number, month: number): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return createUTCDate(nextYear, nextMonth, 1);
}

/**
 * Parse a YYYY-MM-DD string as a UTC date at midnight
 * This prevents timezone interpretation issues
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object at midnight UTC
 */
export function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return createUTCDate(year, month, day);
}

/**
 * Format a Date as YYYY-MM-DD using UTC components
 * 
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForSQL(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current year in UTC
 */
export function getCurrentUTCYear(): number {
  const now = new Date();
  return now.getUTCFullYear();
}

/**
 * Get current month in UTC (1-indexed)
 */
export function getCurrentUTCMonth(): number {
  const now = new Date();
  return now.getUTCMonth() + 1;
}

/**
 * Get the start of the current year in UTC
 */
export function getUTCYearStart(year?: number): Date {
  const targetYear = year ?? getCurrentUTCYear();
  return createUTCDate(targetYear, 1, 1);
}

/**
 * Get the last complete month in UTC
 */
export function getLastCompleteMonthUTC(): { year: number; month: number } {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-indexed
  
  if (currentMonth === 1) {
    return { year: currentYear - 1, month: 12 };
  }
  
  return { year: currentYear, month: currentMonth - 1 };
}

/**
 * Calculate date range for common filter presets in UTC
 * 
 * IMPORTANT: These preset keys and logic MUST match the canonical frontend
 * date range helper in client/src/lib/dateRanges.ts to ensure consistency
 * across Insurance Overview, Trends, and Department Analytics pages.
 * 
 * Supported preset keys (aligned with frontend):
 * - last-month: Last complete calendar month
 * - last-quarter: Last 3 complete calendar months (rolling window)
 * - last-6-months: Last 6 complete calendar months (rolling window)
 * - last-12-months: Last 12 complete calendar months (rolling window)
 * - this-year: January 1 of current year through last complete month
 * - last-year: Full previous calendar year (Jan 1 - Dec 31)
 * 
 * Legacy preset keys (maintained for backward compatibility):
 * - current-month: Current month (may be incomplete)
 * - ytd: Year to date (may include incomplete current month)
 * 
 * @param preset - Filter preset key
 * @param referenceDate - Reference date for calculations (default: now)
 * @returns Object with startDate and endDate in UTC
 */
export function getUTCDateRange(
  preset: string,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const currentYear = referenceDate.getUTCFullYear();
  const currentMonth = referenceDate.getUTCMonth() + 1; // 1-indexed
  const lastComplete = getLastCompleteMonthUTC();
  
  switch (preset) {
    case 'last-month': {
      // Last complete calendar month
      const { year, month } = lastComplete;
      const start = getUTCMonthStart(year, month);
      const end = getUTCNextMonthStart(year, month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-quarter': {
      // Last 3 complete calendar months (rolling window)
      // This matches the frontend's "Last Quarter" preset
      const startMonth = lastComplete.month - 2;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-6-months': {
      // Last 6 complete calendar months (rolling window)
      const startMonth = lastComplete.month - 5;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-12-months': {
      // Last 12 complete calendar months (rolling window)
      // This matches the frontend's "Last 12 Months" preset
      const startMonth = lastComplete.month - 11;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'this-year': {
      // January 1 of current year through last complete month
      // CRITICAL: Always starts at Jan 1, never December of previous year
      // This fixes the December-anchoring bug
      const start = getUTCYearStart(currentYear);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-year': {
      // Full previous calendar year (Jan 1 - Dec 31)
      const start = getUTCYearStart(currentYear - 1);
      const end = getUTCYearStart(currentYear);
      return { startDate: start, endDate: end };
    }
    
    // ===== Legacy presets (maintained for backward compatibility) =====
    
    case 'current-month': {
      const start = getUTCMonthStart(currentYear, currentMonth);
      const end = getUTCNextMonthStart(currentYear, currentMonth);
      return { startDate: start, endDate: end };
    }
    
    case 'last-3-months': {
      // Legacy alias for 'last-quarter' 
      const startMonth = lastComplete.month - 2;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'ytd': {
      const start = getUTCYearStart(currentYear);
      const end = referenceDate;
      return { startDate: start, endDate: end };
    }
    
    default: {
      // Default to current month
      const start = getUTCMonthStart(currentYear, currentMonth);
      const end = getUTCNextMonthStart(currentYear, currentMonth);
      return { startDate: start, endDate: end };
    }
  }
}

/**
 * Validate that a date range is valid
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return !isNaN(startDate.getTime()) && 
         !isNaN(endDate.getTime()) && 
         startDate <= endDate;
}

/**
 * Get the first day of the month for a given date in UTC
 * Helper for aggregation logic
 */
export function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
