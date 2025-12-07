import React from "react";
import { cn } from "@/lib/utils";

export type PageHeaderVariant =
  | "trends"
  | "insuranceOverview"
  | "labFinance"
  | "insuranceBalance"
  | "manzaliReport"
  | "patientVolume"
  | "userManagement"
  | "settings"
  | "addTransaction"
  | "monthlyReports"
  | "claimReconciliation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  variant: PageHeaderVariant;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<
  PageHeaderVariant,
  {
    container: string;
    title: string;
    subtitle: string;
    accent?: string;
  }
> = {
  // 1. Trends — "Aurora Analytics Bar" (UNCHANGED)
  trends: {
    container: "bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-700 border-b border-white/20",
    title: "text-white",
    subtitle: "text-slate-200",
  },
  
  // 2. Insurance Overview — "Teal Horizon" (UPDATED)
  insuranceOverview: {
    container: "bg-gradient-to-r from-teal-600 via-cyan-500 to-sky-500 border-b-2 border-cyan-300/40",
    title: "text-white",
    subtitle: "text-cyan-50",
  },
  
  // 3. Lab Finance — "Electric Science" (UPDATED)
  labFinance: {
    container: "bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-600 border-b border-transparent",
    title: "text-white",
    subtitle: "text-cyan-100",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-cyan-400 after:via-cyan-300 after:to-cyan-400 after:shadow-[0_0_8px_rgba(34,211,238,0.5)]",
  },
  
  // 4. Insurance Balance — "Emerald Ledger" (UPDATED)
  insuranceBalance: {
    container: "bg-gradient-to-r from-emerald-600 via-green-500 to-teal-500 border-b-2 border-emerald-300/40",
    title: "text-white",
    subtitle: "text-emerald-50",
  },
  
  // 5. Manzali Report — "Editorial Masthead"
  manzaliReport: {
    container: "bg-neutral-50 ring-1 ring-neutral-200 border-b border-neutral-200",
    title: "font-serif text-neutral-900",
    subtitle: "text-neutral-600",
  },
  
  // 6. Patient Volume — "Medical Coral" (UPDATED)
  patientVolume: {
    container: "bg-gradient-to-r from-rose-600 via-pink-500 to-rose-500 border-b border-transparent",
    title: "text-white",
    subtitle: "text-rose-50",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-pink-400 after:via-rose-300 after:to-pink-400 after:shadow-[0_0_8px_rgba(244,114,182,0.5)]",
  },
  
  // 7. User Management — "Royal Command" (UPDATED)
  userManagement: {
    container: "bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-600 border-b-2 border-indigo-300/40",
    title: "text-white",
    subtitle: "text-indigo-100",
  },
  
  // 8. Settings — "Platinum Panel" (UPDATED)
  settings: {
    container: "bg-gradient-to-r from-slate-600 via-gray-500 to-slate-500 border-b-2 border-slate-300/40",
    title: "text-white",
    subtitle: "text-slate-100",
  },
  
  // 9. Add Transaction — "Action Ribbon" (UNCHANGED)
  addTransaction: {
    container: "bg-gradient-to-r from-emerald-700 to-teal-600 border-b border-white/20",
    title: "text-white",
    subtitle: "text-emerald-200",
  },
  
  // 10. Monthly Reports — "Golden Archive" (UPDATED)
  monthlyReports: {
    container: "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 border-b-2 border-amber-300/40",
    title: "text-white",
    subtitle: "text-amber-50",
  },
  
  // 11. Claim Reconciliation — "Purple Prestige" (UPDATED)
  claimReconciliation: {
    container: "bg-gradient-to-r from-purple-700 via-violet-600 to-purple-600 border-b-2 border-purple-300/40",
    title: "text-white",
    subtitle: "text-purple-100",
  },
};

/**
 * PageHeader Component - Reusable sticky header with premium variants
 * 
 * Features:
 * - Sticky positioning at top of viewport (z-index: 50)
 * - 11 distinct variants with unique aesthetics
 * - Support for optional subtitle and right-side controls
 * - Responsive layout
 * - Accessible text contrast (WCAG compliant)
 */
export default function PageHeader({
  title,
  subtitle,
  variant,
  children,
  className,
}: PageHeaderProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        // Base sticky positioning with shadow - z-[60] to be above sidebar overlay on mobile
        "sticky top-0 z-[60] shadow-md",
        // Variant-specific container styles
        styles.container,
        // Position relative for pseudo-elements
        "relative",
        // Accent pseudo-element positioning
        styles.accent,
        // Custom additional classes
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Left: Title and Subtitle */}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "text-2xl sm:text-3xl font-bold tracking-tight",
                styles.title
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className={cn("mt-1 text-sm sm:text-base", styles.subtitle)}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: Optional Controls */}
          {children && (
            <div className="flex-shrink-0 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
