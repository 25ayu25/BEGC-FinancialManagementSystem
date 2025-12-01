/**
 * Currency formatting utilities for consistent display across the application.
 * All amounts are displayed as whole dollars (no cents).
 */

/**
 * Formats a number as USD currency with no fraction digits.
 * Uses Math.round to handle floating point amounts.
 * 
 * @param amount - The numeric amount to format
 * @returns Formatted currency string (e.g., "$1,234")
 */
export function formatCurrency(amount: number): string {
  const roundedAmount = Math.round(amount || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(roundedAmount);
}

/**
 * Formats a number as a plain whole number with thousand separators.
 * 
 * @param amount - The numeric amount to format
 * @returns Formatted number string (e.g., "1,234")
 */
export function formatWholeNumber(amount: number): string {
  const roundedAmount = Math.round(amount || 0);
  return roundedAmount.toLocaleString('en-US');
}
