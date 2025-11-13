/**
 * Formatter utilities for consistent data display
 * All formatters are USD-only for the insurance overview dashboard
 */

/**
 * Format currency amount in USD
 * @param amount - Amount to format
 * @param options - Optional formatting options
 */
export function formatCurrency(
  amount: number | string,
  options?: {
    decimals?: number;
    showSymbol?: boolean;
  }
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return "USD 0";
  }

  const decimals = options?.decimals ?? 0;
  const showSymbol = options?.showSymbol ?? true;
  
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `USD ${formatted}` : formatted;
}

/**
 * Format percentage value
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) {
    return "0.0%";
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date to readable string
 * @param date - Date string or Date object
 * @param format - Format type
 */
export function formatDate(
  date: string | Date | null | undefined,
  format: "short" | "long" | "iso" = "short"
): string {
  if (!date) return "—";

  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return "—";
  }

  switch (format) {
    case "short":
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    case "long":
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    case "iso":
      return d.toISOString().split("T")[0];
    default:
      return d.toLocaleDateString("en-US");
  }
}

/**
 * Format large numbers with K, M, B suffixes
 * @param value - Number to format
 */
export function formatCompactNumber(value: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return "0";
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}${absValue.toFixed(0)}`;
}

/**
 * Format number with thousand separators
 * @param value - Number to format
 * @param decimals - Number of decimal places
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (isNaN(value) || !isFinite(value)) {
    return "0";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format duration in days to human-readable string
 * @param days - Number of days
 */
export function formatDays(days: number): string {
  if (isNaN(days) || !isFinite(days)) {
    return "0 days";
  }

  const absDays = Math.abs(days);

  if (absDays === 0) return "0 days";
  if (absDays === 1) return "1 day";
  if (absDays < 7) return `${Math.round(absDays)} days`;
  if (absDays < 30) {
    const weeks = Math.round(absDays / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  if (absDays < 365) {
    const months = Math.round(absDays / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.round(absDays / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

/**
 * Format status to title case with color
 * @param status - Status string
 */
export function formatStatus(status: string): {
  label: string;
  color: "green" | "yellow" | "red" | "blue" | "gray";
} {
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case "paid":
      return { label: "Paid", color: "green" };
    case "partially_paid":
    case "partially paid":
      return { label: "Partially Paid", color: "yellow" };
    case "submitted":
      return { label: "Submitted", color: "blue" };
    case "pending":
      return { label: "Pending", color: "yellow" };
    case "rejected":
      return { label: "Rejected", color: "red" };
    case "cancelled":
      return { label: "Cancelled", color: "gray" };
    default:
      return {
        label: status
          .split("_")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        color: "gray",
      };
  }
}

/**
 * Format period (year-month) to readable string
 * @param year - Year number
 * @param month - Month number (1-12)
 */
export function formatPeriod(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

/**
 * Truncate text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format provider code/name for display
 * @param code - Provider code
 * @param name - Provider name
 */
export function formatProviderName(code?: string, name?: string): string {
  if (name && code) {
    return `${code} - ${name}`;
  }
  return name || code || "Unknown Provider";
}

/**
 * Safe number parsing
 * @param value - Value to parse
 * @param fallback - Fallback value if parsing fails
 */
export function parseNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") {
    return isNaN(value) || !isFinite(value) ? fallback : value;
  }
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/,/g, ""));
    return isNaN(num) || !isFinite(num) ? fallback : num;
  }
  return fallback;
}
