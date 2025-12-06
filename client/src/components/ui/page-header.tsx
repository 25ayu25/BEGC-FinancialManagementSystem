import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Main title displayed in the header */
  title: string;
  /** Subtitle/description displayed below the title */
  subtitle?: string;
  /** Optional children for controls (dropdowns, buttons, etc.) */
  children?: ReactNode;
  /** Additional className for the header container */
  className?: string;
}

/**
 * PageHeader - World-class premium header component
 * 
 * Features the signature design from the Executive Dashboard:
 * - Midnight gradient background (seamless L-frame with sidebar)
 * - Header glow effect overlay
 * - Neon horizon line at the bottom (teal→cyan→blue gradient with glow shadow)
 * - White title with subtle slate subtitle
 * - Sticky positioning for proper scroll behavior
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-40", className)}>
      <div className="relative bg-[linear-gradient(120deg,#020617_0%,#020617_20%,#0b1120_60%,#020617_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.9)]">
        {/* Header glow effect */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.38),_transparent_70%)] opacity-90" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-300">
                {subtitle}
              </p>
            )}
          </div>

          {/* Controls area for dropdowns, buttons, etc. */}
          {children && (
            <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2 w-full md:w-auto justify-end">
              {children}
            </div>
          )}
        </div>

        {/* Neon horizon line - THE SECRET SAUCE */}
        <div className="relative z-10 h-[3px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 shadow-[0_0_26px_rgba(34,211,238,0.95),0_0_42px_rgba(59,130,246,0.8)]" />
      </div>
    </header>
  );
}

/**
 * Styles for dark header controls (dropdowns, buttons)
 * Use with cn() to apply to Select, Button components in the header
 */
export const headerControlStyles = 
  "h-9 border-slate-700/60 bg-slate-800/80 text-slate-100 hover:bg-slate-700/80 focus:ring-slate-500";

export default PageHeader;
