/**
 * UTC Date Utilities
 * 
 * Centralized date handling utilities that enforce UTC timezone for consistent
 * date filtering across frontend and backend. This prevents timezone-related
 * off-by-one errors in date range queries.
 * 
 * Key Principles:
 * 1. All date calculations for API queries must be done in UTC
 * 2. Date strings sent to backend must be timezone-agnostic (YYYY-MM-DD)
 * 3. Date boundaries are treated as UTC midnight (00:00:00.000Z)
 * 4. End dates are exclusive in SQL queries (date < end, not date <= end)
 * 
 * @module utcDateUtils
 */

import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

/**
 * Create a UTC date at midnight (00:00:00.000Z)
 * This ensures consistent date boundaries regardless of local timezone
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
 * Get the last day of a month in UTC
 * 
 * @param year - Full year
 * @param month - 1-indexed month (1 = January, 12 = December)
 * @returns Date object representing last day of month at 23:59:59.999 UTC
 */
export function getUTCMonthEnd(year: number, month: number): Date {
  // Get first day of next month, then subtract 1 millisecond
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstOfNextMonth = createUTCDate(nextYear, nextMonth, 1);
  return new Date(firstOfNextMonth.getTime() - 1);
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
 * Format a Date as YYYY-MM-DD for API communication
 * This format is timezone-agnostic and unambiguous
 * 
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format (UTC date components)
 */
export function formatDateForAPI(date: Date): string {
  // Use UTC components to avoid timezone shifts
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string as a UTC date at midnight
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object at midnight UTC
 */
export function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return createUTCDate(year, month, day);
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
 * Get the end of a year in UTC (last millisecond of Dec 31)
 */
export function getUTCYearEnd(year?: number): Date {
  const targetYear = year ?? getCurrentUTCYear();
  return new Date(createUTCDate(targetYear + 1, 1, 1).getTime() - 1);
}

/**
 * Get the last complete month in UTC
 * If current month is January, returns December of previous year
 * Otherwise returns previous month of current year
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
  
  switch (preset) {
    case 'current-month': {
      const start = getUTCMonthStart(currentYear, currentMonth);
      // For end, use next month start for exclusive comparison (date < end)
      const end = getUTCNextMonthStart(currentYear, currentMonth);
      return { startDate: start, endDate: end };
    }
    
    case 'last-month': {
      const { year, month } = getLastCompleteMonthUTC();
      const start = getUTCMonthStart(year, month);
      const end = getUTCNextMonthStart(year, month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-3-months': {
      // Last 3 complete months
      const lastComplete = getLastCompleteMonthUTC();
      const startMonth = lastComplete.month - 2;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-6-months': {
      // Last 6 complete months
      const lastComplete = getLastCompleteMonthUTC();
      const startMonth = lastComplete.month - 5;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'this-quarter': {
      // Current quarter (incomplete)
      const quarterStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const start = getUTCMonthStart(currentYear, quarterStartMonth);
      const end = referenceDate; // Up to now
      return { startDate: start, endDate: end };
    }
    
    case 'last-quarter': {
      // Previous complete quarter
      const currentQuarterStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const lastQuarterStartMonth = currentQuarterStartMonth - 3;
      
      let quarterYear = currentYear;
      let adjustedQuarterStartMonth = lastQuarterStartMonth;
      
      if (lastQuarterStartMonth < 1) {
        quarterYear = currentYear - 1;
        adjustedQuarterStartMonth = lastQuarterStartMonth + 12;
      }
      
      const start = getUTCMonthStart(quarterYear, adjustedQuarterStartMonth);
      // End of quarter is 3 months later
      const endMonth = adjustedQuarterStartMonth + 3;
      const endYear = endMonth > 12 ? quarterYear + 1 : quarterYear;
      const adjustedEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
      const end = getUTCMonthStart(endYear, adjustedEndMonth);
      
      return { startDate: start, endDate: end };
    }
    
    case 'this-year': {
      // January 1 of current year to end of last complete month
      const start = getUTCYearStart(currentYear);
      const lastComplete = getLastCompleteMonthUTC();
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'ytd': {
      // Year to date (including current incomplete month)
      const start = getUTCYearStart(currentYear);
      const end = referenceDate; // Up to now
      return { startDate: start, endDate: end };
    }
    
    case 'last-year': {
      // Full previous calendar year
      const start = getUTCYearStart(currentYear - 1);
      const end = getUTCYearStart(currentYear); // Exclusive end (first day of current year)
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
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns true if valid, false otherwise
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return !isNaN(startDate.getTime()) && 
         !isNaN(endDate.getTime()) && 
         startDate <= endDate;
}
