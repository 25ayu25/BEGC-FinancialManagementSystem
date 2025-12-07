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
  },
  
  // 2. Insurance Overview — "Luminous Teal" (PREMIUM)
  insuranceOverview: {
    baseGradient: "bg-gradient-to-br from-teal-600 via-cyan-500 to-emerald-500",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-dots",
    accentBorder: "bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400",
    boxShadow: "shadow-[0_4px_20px_rgba(20,184,166,0.25)]",
    title: "text-white",
    subtitle: "text-cyan-50",
  },
  
  // 3. Lab Finance — "Electric Cyan Science" (PREMIUM)
  labFinance: {
    baseGradient: "bg-gradient-to-br from-blue-700 via-cyan-600 to-sky-600",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-tech-grid",
    accentBorder: "bg-gradient-to-r from-cyan-400 to-blue-400",
    boxShadow: "shadow-[0_4px_28px_rgba(6,182,212,0.3)]",
    title: "text-white",
    subtitle: "text-cyan-50",
    animation: "breathing-glow",
  },
  
  // 4. Insurance Balance — "Emerald Fortune" (PREMIUM)
  insuranceBalance: {
    baseGradient: "bg-gradient-to-br from-emerald-600 via-green-500 to-teal-500",
    overlayPattern: "bg-radial-gradient-top-left",
    patternClass: "",
    accentBorder: "bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400",
    boxShadow: "shadow-[0_4px_24px_rgba(16,185,129,0.3)]",
    title: "text-white",
    subtitle: "text-emerald-50",
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
  },
  
  // 6. Patient Volume — "Medical Coral Life" (PREMIUM)
  patientVolume: {
    baseGradient: "bg-gradient-to-br from-rose-600 via-pink-500 to-red-500",
    overlayPattern: "bg-radial-gradient-center",
    patternClass: "pattern-pulse-wave",
    accentBorder: "bg-gradient-to-r from-rose-400 via-pink-400 to-red-400",
    boxShadow: "shadow-[0_4px_24px_rgba(244,63,94,0.3)]",
    title: "text-white",
    subtitle: "text-rose-50",
    animation: "glow-pulse",
  },
  
  // 7. User Management — "Indigo Royal Command" (PREMIUM)
  userManagement: {
    baseGradient: "bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-600",
    overlayPattern: "bg-radial-gradient-center",
    patternClass: "",
    accentBorder: "bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-400",
    boxShadow: "shadow-[0_4px_24px_rgba(99,102,241,0.35)]",
    title: "text-white",
    subtitle: "text-indigo-100",
  },
  
  // 8. Settings — "Platinum Steel System" (PREMIUM)
  settings: {
    baseGradient: "bg-gradient-to-br from-slate-600 via-gray-500 to-zinc-500",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-diagonal",
    accentBorder: "bg-gradient-to-r from-slate-400 via-gray-300 to-zinc-400",
    boxShadow: "shadow-[0_4px_20px_rgba(71,85,105,0.3)]",
    title: "text-white",
    subtitle: "text-slate-100",
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
  },
  
  // 10. Monthly Reports — "Amber Gold Archive" (PREMIUM)
  monthlyReports: {
    baseGradient: "bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-500",
    overlayPattern: "bg-radial-gradient",
    patternClass: "pattern-diagonal",
    accentBorder: "bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400",
    boxShadow: "shadow-[0_4px_24px_rgba(245,158,11,0.35)]",
    title: "text-white",
    subtitle: "text-amber-50",
  },
  
  // 11. Claim Reconciliation — "Royal Purple Excellence" (PREMIUM)
  claimReconciliation: {
    baseGradient: "bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-600",
    overlayPattern: "bg-radial-gradient-center",
    patternClass: "",
    accentBorder: "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-violet-400",
    boxShadow: "shadow-[0_4px_24px_rgba(139,92,246,0.35)]",
    title: "text-white",
    subtitle: "text-purple-100",
    animation: "glow-pulse",
  },
};

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
        // Base sticky positioning - z-[60] to be above sidebar overlay on mobile
        "sticky top-0 z-[60] shadow-lg",
        // Position relative for layering
        "relative overflow-hidden",
        // Box shadow for elevation
        styles.boxShadow,
        // Custom additional classes
        className
      )}
    >
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

      {/* Layer 5: 3px gradient accent border at bottom */}
      {styles.accentBorder && (
        <div className={cn("absolute bottom-0 left-0 right-0 h-[3px]", styles.accentBorder)} />
      )}
    </div>
  );
}
