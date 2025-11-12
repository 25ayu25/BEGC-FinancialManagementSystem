/**
 * Formatting utilities for insurance overview
 * USD-only formatters to ensure consistency across the application
 */

/**
 * Format amount as USD currency
 * @param amount - The numeric amount to format
 * @returns Formatted string like "$1,234.56"
 */
export function formatUSD(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Format amount as USD without decimals
 * @param amount - The numeric amount to format
 * @returns Formatted string like "$1,234"
 */
export function formatUSDCompact(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '$0';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

/**
 * Format date as YYYY-MM-DD
 * @param date - Date object or string
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display (e.g., "Jan 15, 2025")
 * @param date - Date object or string
 * @returns Formatted date string
 */
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Format percentage value
 * @param value - Numeric percentage (e.g., 85.5)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "85.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Parse USD string to number
 * @param usdString - String like "$1,234.56" or "1234.56"
 * @returns Numeric value
 */
export function parseUSD(usdString: string): number {
  if (!usdString) return 0;
  
  // Remove currency symbols, commas, and whitespace
  const cleaned = String(usdString).replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
}
