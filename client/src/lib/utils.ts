import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely format a number for display, handling null/undefined/NaN cases.
 * Returns "0" for null/undefined/NaN, or the formatted number using toLocaleString().
 * 
 * @param value - The number to format (can be null, undefined, or NaN)
 * @param defaultValue - The value to return if input is null/undefined/NaN (default: "0")
 * @returns Formatted number string or default value
 */
export function formatNumber(
  value: number | null | undefined,
  defaultValue: string = "0"
): string {
  if (value == null || !Number.isFinite(value)) {
    return defaultValue;
  }
  return value.toLocaleString();
}
