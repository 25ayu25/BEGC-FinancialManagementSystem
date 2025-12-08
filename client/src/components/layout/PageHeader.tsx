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
    baseGradient: string;
    overlayPattern: string;
    patternClass: string;
    accentBorder: string;
    boxShadow: string;
    title: string;
    subtitle: string;
    animation?: string;
    actionVariant: "light" | "dark"; // Determines which HeaderAction variant to use
  }
> = {
  // 1. Trends — "Aurora Analytics Bar" (UNCHANGED - keeping simple)
  trends: {
    baseGradient: "bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-700",
    overlayPattern: "",
    patternClass: "",
    accentBorder: "border-b border-white/20",
    boxShadow: "",
    title: "text-white",
    subtitle: "text-slate-200",
    actionVariant: "light",
  },
  
  // 2. Insurance Overview — "Modern Teal Professional" (PREMIUM, WORLD-CLASS)
  insuranceOverview: {
    baseGradient: "bg-gradient-to-br from-[#0D9488] via-[#14B8A6] to-[#0E7490]",
    overlayPattern: "",
    patternClass: "",
    accentBorder: "h-[2px] bg-gradient-to-r from-[#5EEAD4] to-[#22D3EE]",
    boxShadow: "shadow-md",
    title: "text-white",
    subtitle: "text-teal-50",
    actionVariant: "light",
  },
  
  // 3. Lab Finance — "Electric Cyan Science" (PREMIUM)
  labFinance: {
    baseGradient: "bg-gradient-to-br from-blue-700 via-cyan-600 to-sky-600",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-tech-grid",
    accentBorder: "h-[3px] bg-gradient-to-r from-cyan-400 to-blue-400",
    boxShadow: "shadow-[0_4px_28px_rgba(6,182,212,0.3)]",
    title: "text-white",
    subtitle: "text-cyan-50",
    animation: "breathing-glow",
    actionVariant: "light",
  },
  
  // 4. Insurance Balance — "Emerald Fortune" (PREMIUM)
  insuranceBalance: {
    baseGradient: "bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500",
    overlayPattern: "bg-radial-gradient-top-left",
    patternClass: "",
    accentBorder: "h-[3px] bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400",
    boxShadow: "shadow-[0_4px_24px_rgba(16,185,129,0.3)]",
    title: "text-white",
    subtitle: "text-emerald-50",
    actionVariant: "light",
  },
  
  // 5. Manzali Report — "Editorial Masthead" (UNCHANGED - keeping simple)
  manzaliReport: {
    baseGradient: "bg-neutral-50",
    overlayPattern: "",
    patternClass: "",
    accentBorder: "border-b border-neutral-200",
    boxShadow: "ring-1 ring-neutral-200",
    title: "font-serif text-neutral-900",
    subtitle: "text-neutral-600",
    actionVariant: "light",
  },
  
  // 6. Patient Volume — "Medical Coral Life" (PREMIUM)
  patientVolume: {
    baseGradient: "bg-gradient-to-br from-rose-600 via-pink-500 to-red-500",
    overlayPattern: "bg-radial-gradient-center",
    patternClass: "pattern-pulse-wave",
    accentBorder: "h-[3px] bg-gradient-to-r from-rose-400 via-pink-400 to-red-400",
    boxShadow: "shadow-[0_4px_24px_rgba(244,63,94,0.3)]",
    title: "text-white",
    subtitle: "text-rose-50",
    animation: "glow-pulse",
    actionVariant: "light",
  },
  
  // 7. User Management — "Indigo Royal Command" (PREMIUM)
  userManagement: {
    baseGradient: "bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-600",
    overlayPattern: "bg-radial-gradient-center",
    patternClass: "",
    accentBorder: "h-[3px] bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400",
    boxShadow: "shadow-[0_4px_24px_rgba(99,102,241,0.35)]",
    title: "text-white",
    subtitle: "text-indigo-100",
    actionVariant: "light",
  },
  
  // 8. Settings — "Platinum Steel System" (PREMIUM)
  settings: {
    baseGradient: "bg-gradient-to-br from-slate-600 via-gray-500 to-zinc-500",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-diagonal",
    accentBorder: "h-[3px] bg-gradient-to-r from-slate-400 via-gray-300 to-zinc-400",
    boxShadow: "shadow-[0_4px_20px_rgba(71,85,105,0.3)]",
    title: "text-white",
    subtitle: "text-slate-100",
    actionVariant: "light",
  },
  
  // 9. Add Transaction — "Action Ribbon" (UNCHANGED - keeping simple)
  addTransaction: {
    baseGradient: "bg-gradient-to-r from-emerald-700 to-teal-600",
    overlayPattern: "",
    patternClass: "",
    accentBorder: "border-b border-white/20",
    boxShadow: "",
    title: "text-white",
    subtitle: "text-emerald-200",
    actionVariant: "light",
  },
  
  // 10. Monthly Reports — "Amber Gold Archive" (PREMIUM)
  monthlyReports: {
    baseGradient: "bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-500",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-diagonal",
    accentBorder: "h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400",
    boxShadow: "shadow-[0_4px_24px_rgba(245,158,11,0.35)]",
    title: "text-white",
    subtitle: "text-amber-50",
    actionVariant: "light",
  },
  
  // 11. Claim Reconciliation — "Obsidian Stripe" (FUTURE-PROOF, TIMELESS)
  claimReconciliation: {
    baseGradient: "bg-gradient-to-br from-[#0B1220] to-[#111827]",
    overlayPattern: "",
    patternClass: "",
    accentBorder: "h-[2px] bg-gradient-to-r from-[#10B981] to-[#2DD4BF]",
    boxShadow: "shadow-md",
    title: "text-white",
    subtitle: "text-slate-400",
    actionVariant: "dark",
  },
};

/**
 * Get the recommended HeaderAction variant for a given PageHeader variant.
 * This ensures visual consistency between the header background and action buttons.
 */
export function getHeaderActionVariant(variant: PageHeaderVariant): "light" | "dark" {
  return variantStyles[variant].actionVariant;
}

/**
 * PageHeader Component - Premium world-class sticky header with multi-layer depth
 * 
 * Features:
 * - Sticky positioning at top of viewport (z-index: 60 for mobile compatibility)
 * - 11 distinct variants with unique aesthetics
 * - Multi-layer depth: base gradient + overlay + pattern + accent border
 * - Sophisticated animations and glow effects
 * - Support for optional subtitle and right-side controls
 * - Responsive layout
 * - High contrast text (white on vibrant backgrounds for readability)
 * - Respects prefers-reduced-motion for accessibility
 * - Standardized action button styling via actionVariant property
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
        // Base sticky positioning - z-40 allows dropdowns (z-[70]) to appear above
        "sticky top-0 z-40 shadow-lg",
        // Position relative for layering - removed overflow-hidden to allow dropdowns to display
        "relative",
        // Box shadow for elevation
        styles.boxShadow,
        // Custom additional classes
        className
      )}
    >
      {/* Background container with overflow-hidden to clip decorative layers */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Layer 1: Base gradient background */}
        <div className={cn("absolute inset-0", styles.baseGradient)} />
        
        {/* Layer 2: Overlay effects (radial gradient for luminosity) */}
        {styles.overlayPattern && (
          <div className={cn("absolute inset-0 opacity-40", styles.overlayPattern)} />
        )}
        
        {/* Layer 3: Pattern/texture overlay */}
        {styles.patternClass && (
          <div className={cn("absolute inset-0 opacity-10", styles.patternClass)} />
        )}
        
        {/* Layer 4: Optional animation layer */}
        {styles.animation && (
          <div className={cn("absolute inset-0", styles.animation)} />
        )}
      </div>

      {/* Content Layer - relative positioning to appear above backgrounds */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
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

      {/* Layer 5: Gradient accent border at bottom (height varies by variant) */}
      {styles.accentBorder && (
        <div className={cn("absolute bottom-0 left-0 right-0", styles.accentBorder)} />
      )}
    </div>
  );
}
