/**
 * UTC Date Utilities for Backend
 * 
 * Server-side date handling utilities that enforce UTC timezone for consistent
 * date filtering. This mirrors the client-side utilities to ensure consistency.
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
      const lastComplete = getLastCompleteMonthUTC();
      const startMonth = lastComplete.month - 2;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'last-6-months': {
      const lastComplete = getLastCompleteMonthUTC();
      const startMonth = lastComplete.month - 5;
      const startYear = startMonth < 1 ? lastComplete.year - 1 : lastComplete.year;
      const adjustedStartMonth = startMonth < 1 ? startMonth + 12 : startMonth;
      
      const start = getUTCMonthStart(startYear, adjustedStartMonth);
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'this-quarter': {
      const quarterStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const start = getUTCMonthStart(currentYear, quarterStartMonth);
      const end = referenceDate;
      return { startDate: start, endDate: end };
    }
    
    case 'last-quarter': {
      const currentQuarterStartMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const lastQuarterStartMonth = currentQuarterStartMonth - 3;
      
      let quarterYear = currentYear;
      let adjustedQuarterStartMonth = lastQuarterStartMonth;
      
      if (lastQuarterStartMonth < 1) {
        quarterYear = currentYear - 1;
        adjustedQuarterStartMonth = lastQuarterStartMonth + 12;
      }
      
      const start = getUTCMonthStart(quarterYear, adjustedQuarterStartMonth);
      const endMonth = adjustedQuarterStartMonth + 3;
      const endYear = endMonth > 12 ? quarterYear + 1 : quarterYear;
      const adjustedEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
      const end = getUTCMonthStart(endYear, adjustedEndMonth);
      
      return { startDate: start, endDate: end };
    }
    
    case 'this-year': {
      const start = getUTCYearStart(currentYear);
      const lastComplete = getLastCompleteMonthUTC();
      const end = getUTCNextMonthStart(lastComplete.year, lastComplete.month);
      return { startDate: start, endDate: end };
    }
    
    case 'ytd': {
      const start = getUTCYearStart(currentYear);
      const end = referenceDate;
      return { startDate: start, endDate: end };
    }
    
    case 'last-year': {
      const start = getUTCYearStart(currentYear - 1);
      const end = getUTCYearStart(currentYear);
      return { startDate: start, endDate: end };
    }
    
    default: {
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
