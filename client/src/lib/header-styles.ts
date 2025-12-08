/**
 * Shared Header Action Button Styles
 * 
 * Centralized styling for header action buttons/controls used across
 * Insurance-related pages (Overview, Match Payments, Lab Finance).
 * 
 * These tokens ensure consistent, accessible, high-contrast design
 * across all insurance headers.
 */

export const headerActionStyles = {
  /**
   * Primary action button on colored gradient backgrounds
   * Examples: Filter button, Refresh button, Add Claim, Record Payment
   */
  primaryButton: `
    inline-flex items-center gap-2
    px-3 sm:px-4 py-2.5 sm:py-2
    bg-white border border-white/80 text-gray-700
    rounded-xl hover:bg-gray-50 hover:border-white hover:shadow-lg
    shadow-md transition-all duration-200
    font-medium
    min-h-[44px]
    focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white
    disabled:opacity-50 disabled:cursor-not-allowed
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Secondary action button on colored gradient backgrounds
   * Examples: Export CSV, Help button
   */
  secondaryButton: `
    inline-flex items-center gap-2
    px-3 py-2
    bg-white border border-white/80 text-gray-700
    rounded-lg hover:bg-gray-50 hover:shadow-lg
    shadow-md transition-all
    min-h-[44px]
    focus:outline-none focus:ring-2 focus:ring-white/50
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Select/dropdown controls on gradient backgrounds
   * Examples: Month selector, Year selector
   */
  selectTrigger: `
    bg-white/95 border-white/80 text-gray-800
    hover:bg-white shadow-md
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Toggle button group on gradient backgrounds
   * Example: Monthly/Year to date toggle
   */
  toggleContainer: `
    inline-flex rounded-full bg-white/95 p-1 text-xs
    shadow-md
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Active toggle button state
   */
  toggleActive: `
    px-3 py-1.5 rounded-full font-medium
    bg-gradient-to-r text-white shadow-sm
    transition-all
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Inactive toggle button state
   */
  toggleInactive: `
    px-3 py-1.5 rounded-full font-medium
    text-gray-600 hover:text-gray-800
    transition-all
  `.replace(/\s+/g, ' ').trim(),

  /**
   * Label text for form controls on gradient backgrounds
   */
  controlLabel: `
    text-xs text-white/90 mb-1 font-medium
  `.replace(/\s+/g, ' ').trim(),
};

/**
 * Icon color classes for different header variants
 */
export const headerIconColors = {
  insuranceOverview: 'text-teal-600',
  labFinance: 'text-cyan-600',
  insuranceBalance: 'text-emerald-600',
};

/**
 * Toggle gradient backgrounds for different header variants
 */
export const headerToggleGradients = {
  insuranceOverview: 'from-teal-600 to-cyan-600',
  labFinance: 'from-cyan-600 to-blue-600',
  insuranceBalance: 'from-emerald-600 to-teal-600',
};
