import React from "react";
import { cn } from "@/lib/utils";

export type PageHeaderVariant =
  | "trends"
  | "insuranceOverview"
  | "marchPayments"
  | "labFinance"
  | "insuranceBalance"
  | "manzaliReport"
  | "patientVolume"
  | "userManagement"
  | "settings"
  | "addTransaction"
  | "monthlyReports";

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
  // 1. Trends — "Aurora Analytics Bar"
  trends: {
    container: "bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-700 border-b border-white/20",
    title: "text-white",
    subtitle: "text-slate-200",
  },
  
  // 2. Insurance Overview — "Glass Ledger"
  insuranceOverview: {
    container: "bg-white/10 backdrop-blur-md ring-1 ring-teal-300/20 border-b border-teal-200/30",
    title: "text-slate-900",
    subtitle: "text-slate-700",
  },
  
  // 3. March Payments — "Statement Stripe"
  marchPayments: {
    container: "bg-slate-900 border-b border-transparent",
    title: "text-white",
    subtitle: "text-slate-400",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-emerald-500 after:to-teal-400",
  },
  
  // 4. Lab Finance — "BioLumina Edge"
  labFinance: {
    container: "bg-[linear-gradient(90deg,#0B1020,#141a35)] border-b border-transparent",
    title: "text-slate-100",
    subtitle: "text-slate-400",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-cyan-400 after:to-blue-500",
  },
  
  // 5. Insurance Balance — "Ledger Gradient Subtle"
  insuranceBalance: {
    container: "bg-gradient-to-r from-slate-800 to-stone-800 border-b border-teal-500/40",
    title: "text-white",
    subtitle: "text-slate-300",
  },
  
  // 6. Manzali Report — "Editorial Masthead"
  manzaliReport: {
    container: "bg-neutral-50 ring-1 ring-neutral-200 border-b border-neutral-200",
    title: "font-serif text-neutral-900",
    subtitle: "text-neutral-600",
  },
  
  // 7. Patient Volume — "Pulse Line"
  patientVolume: {
    container: "bg-slate-900 border-b border-transparent",
    title: "text-white",
    subtitle: "text-slate-400",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-gradient-to-r after:from-cyan-500 after:to-rose-500",
  },
  
  // 8. User Management — "Identity Glass"
  userManagement: {
    container: "bg-white/5 backdrop-blur-sm ring-1 ring-blue-500/20 border-b border-blue-400/40",
    title: "text-slate-100",
    subtitle: "text-slate-300",
  },
  
  // 9. Settings — "System Panel"
  settings: {
    container: "bg-neutral-100 border-b border-neutral-300",
    title: "text-neutral-800",
    subtitle: "text-neutral-600",
    accent: "before:absolute before:inset-0 before:bg-[radial-gradient(circle,#e5e7eb_1px,transparent_1px)] before:bg-[size:20px_20px] before:opacity-50 before:-z-10",
  },
  
  // 10. Add Transaction — "Action Ribbon"
  addTransaction: {
    container: "bg-gradient-to-r from-emerald-700 to-teal-600 border-b border-white/20",
    title: "text-white",
    subtitle: "text-emerald-200",
  },
  
  // 11. Monthly Reports — "Archive Bar"
  monthlyReports: {
    container: "bg-gradient-to-r from-slate-900 to-slate-800 border-b border-transparent",
    title: "text-white",
    subtitle: "text-slate-400",
    accent: "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-amber-500 after:to-orange-500",
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
        // Base sticky positioning
        "sticky top-0 z-50",
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
