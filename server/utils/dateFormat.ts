/**
 * Safe date formatting utilities for server-side operations
 * Handles null/undefined/invalid dates gracefully
 */

/**
 * Safely format a date value as a localized date string
 * Returns an em dash (—) for null/undefined/invalid dates
 * 
 * @param value - Date value (can be string, Date, number, null, or undefined)
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string or "—" for invalid/missing dates
 */
export function formatDate(
  value: string | Date | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  // Handle null, undefined, or empty string
  if (value == null || value === "") {
    return "—";
  }

  // Try to create a Date object
  const date = value instanceof Date ? value : new Date(value);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return "—";
  }

  // Format the date with the provided options
  try {
    return date.toLocaleDateString("en-US", options);
  } catch {
    return "—";
  }
}

/**
 * Format a period (year + month) as a readable label
 * 
 * @param year - Year value
 * @param month - Month value (1-indexed, 1 = January)
 * @param monthFormat - Month format ('long' for 'January', 'short' for 'Jan')
 * @returns Formatted period label (e.g., "January 2024") or "—" for invalid values
 */
export function formatPeriod(
  year: number | null | undefined,
  month: number | null | undefined,
  monthFormat: "long" | "short" = "long"
): string {
  // Handle null or undefined values
  if (year == null || month == null) {
    return "—";
  }

  // Validate year and month ranges
  if (year < 1900 || year > 2100 || month < 1 || month > 12) {
    return "—";
  }

  try {
    const date = new Date(year, month - 1);
    return date.toLocaleString("en-US", {
      month: monthFormat,
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
