/**
 * Centralized Date Range Helper - CANONICAL SOURCE OF TRUTH
 * 
 * This module provides the OFFICIAL date range definitions that MUST be used
 * consistently across ALL analytics pages in the application:
 * - Trends & Comparisons page (dashboard.tsx)
 * - Department Analytics page (department-analytics.tsx)
 * - Insurance Overview page (insurance-overview.tsx)
 * 
 * DO NOT create alternative date calculation logic elsewhere. All pages should
 * import and use getDateRange() from this module to ensure consistent behavior.
 * 
 * Historical Context:
 * Prior implementations used various bespoke date calculation approaches
 * (e.g., utcDateUtils.ts) which caused inconsistencies and bugs such as:
 * - December-anchored "This Year" ranges instead of January-anchored
 * - Off-by-one month errors in rolling windows
 * - Inconsistent behavior between different analytics pages
 * 
 * This canonical implementation fixes those issues by:
 * - Using "complete months" as the atomic unit (never partial months)
 * - "This Year" always starts January 1 and goes to last complete month
 * - "Last Year" is always the full previous calendar year (Jan-Dec)
 * - Rolling windows (6/12 months) count backwards from last complete month
 */

import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export type RangeKey = 
  | "last-month" 
  | "last-quarter" 
  | "last-6-months" 
  | "last-12-months" 
  | "this-year" 
  | "last-year";

export interface MonthBucket {
  year: number;
  month: number; // 1-indexed (1 = January, 12 = December)
}

export interface DateRangeResult {
  /** Start date of the range (first day of first month, at local midnight) */
  startDate: Date;
  /** End date of the range (last day of last month, at local midnight) */
  endDate: Date;
  /** Human-readable label for subtitles */
  label: string;
  /** Ordered list of monthly buckets in the range */
  months: MonthBucket[];
  /** Number of months in the range */
  monthsCount: number;
  /** Is this a single month range? */
  isSingleMonth: boolean;
}

/**
 * Get the last complete calendar month relative to the given date.
 * For example, if `now` is December 4, 2025, the last complete month is November 2025.
 * If `now` is January 15, 2025, the last complete month is December 2024.
 */
export function getLastCompleteMonth(now: Date): Date {
  // The last complete month is always the month before the current month
  return subMonths(startOfMonth(now), 1);
}

/**
 * Get the canonical date range for a given filter key.
 * 
 * Canonical rules:
 * - Last Month: The last complete calendar month
 * - Last Quarter: The last 3 complete calendar months
 * - Last 6 Months: The last 6 complete calendar months
 * - Last 12 Months: The last 12 complete calendar months
 * - This Year: January 1 of current year through the last complete month
 * - Last Year: Full previous calendar year (Jan–Dec)
 * 
 * @param rangeKey The filter key
 * @param now The reference date (typically new Date())
 * @returns DateRangeResult with all computed values
 */
export function getDateRange(rangeKey: RangeKey, now: Date = new Date()): DateRangeResult {
  const currentYear = now.getFullYear();
  const lastCompleteMonth = getLastCompleteMonth(now);
  const lastCompleteYear = lastCompleteMonth.getFullYear();
  const lastCompleteMonthNum = lastCompleteMonth.getMonth() + 1; // 1-indexed

  let startDate: Date;
  let endDate: Date;
  let months: MonthBucket[];
  let labelSuffix: string;

  switch (rangeKey) {
    case "last-month": {
      // Single complete month
      startDate = startOfMonth(lastCompleteMonth);
      endDate = endOfMonth(lastCompleteMonth);
      months = [{ year: lastCompleteYear, month: lastCompleteMonthNum }];
      labelSuffix = "(Last complete month)";
      break;
    }
    
    case "last-quarter": {
      // Last 3 complete months
      startDate = startOfMonth(subMonths(lastCompleteMonth, 2));
      endDate = endOfMonth(lastCompleteMonth);
      months = generateMonthBuckets(startDate, 3);
      labelSuffix = "(Last 3 complete months)";
      break;
    }
    
    case "last-6-months": {
      // Last 6 complete months
      startDate = startOfMonth(subMonths(lastCompleteMonth, 5));
      endDate = endOfMonth(lastCompleteMonth);
      months = generateMonthBuckets(startDate, 6);
      labelSuffix = "(Last 6 complete months)";
      break;
    }
    
    case "last-12-months": {
      // Last 12 complete months
      startDate = startOfMonth(subMonths(lastCompleteMonth, 11));
      endDate = endOfMonth(lastCompleteMonth);
      months = generateMonthBuckets(startDate, 12);
      labelSuffix = "(Last 12 complete months)";
      break;
    }
    
    case "this-year": {
      // January 1 of current year through last complete month
      startDate = new Date(currentYear, 0, 1); // January 1
      endDate = endOfMonth(lastCompleteMonth);
      
      // Calculate number of months from Jan to last complete month
      const monthCount = (lastCompleteYear - currentYear) * 12 + lastCompleteMonthNum;
      months = generateMonthBuckets(startDate, monthCount);
      labelSuffix = "(Year to date – last complete month)";
      break;
    }
    
    case "last-year": {
      // Full previous calendar year (Jan–Dec)
      const prevYear = currentYear - 1;
      startDate = new Date(prevYear, 0, 1); // January 1 of last year
      endDate = new Date(prevYear, 11, 31); // December 31 of last year
      months = generateMonthBuckets(startDate, 12);
      labelSuffix = `(Full year ${prevYear})`;
      break;
    }
    
    default:
      // Fallback to last 12 months
      startDate = startOfMonth(subMonths(lastCompleteMonth, 11));
      endDate = endOfMonth(lastCompleteMonth);
      months = generateMonthBuckets(startDate, 12);
      labelSuffix = "(Last 12 complete months)";
  }

  // Build the label
  const label = buildRangeLabel(months, labelSuffix);
  
  return {
    startDate,
    endDate,
    label,
    months,
    monthsCount: months.length,
    isSingleMonth: months.length === 1,
  };
}

/**
 * Generate an array of month buckets starting from a given date.
 */
function generateMonthBuckets(startDate: Date, count: number): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let current = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    buckets.push({
      year: current.getFullYear(),
      month: current.getMonth() + 1, // 1-indexed
    });
    // Move to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return buckets;
}

/**
 * Build a human-readable label for a date range.
 */
function buildRangeLabel(months: MonthBucket[], suffix: string): string {
  if (months.length === 0) {
    return "No data available";
  }
  
  const first = months[0];
  const last = months[months.length - 1];
  
  const firstLabel = format(new Date(first.year, first.month - 1, 1), "MMMM yyyy");
  
  if (months.length === 1) {
    return `${firstLabel} ${suffix}`;
  }
  
  const lastLabel = format(new Date(last.year, last.month - 1, 1), "MMMM yyyy");
  return `${firstLabel} – ${lastLabel} ${suffix}`;
}

/**
 * Format a Date as YYYY-MM-DD for API calls.
 */
export function formatDateForAPI(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get a short month label (e.g., "Nov 2025" or just "Nov" if year is obvious).
 */
export function getShortMonthLabel(bucket: MonthBucket, includeYear: boolean = true): string {
  const date = new Date(bucket.year, bucket.month - 1, 1);
  return includeYear 
    ? format(date, "MMM yyyy")
    : format(date, "MMM");
}

/**
 * Get a full month label (e.g., "November 2025").
 */
export function getFullMonthLabel(bucket: MonthBucket): string {
  const date = new Date(bucket.year, bucket.month - 1, 1);
  return format(date, "MMMM yyyy");
}

/**
 * Get filter display options with their values and labels.
 */
export const filterOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "last-month", label: "Last Month" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "last-6-months", label: "Last 6 Months" },
  { value: "last-12-months", label: "Last 12 Months" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
];
