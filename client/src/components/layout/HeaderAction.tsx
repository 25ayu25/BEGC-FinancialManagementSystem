import React from "react";
import { cn } from "@/lib/utils";

export type HeaderActionVariant = "light" | "dark";

export interface HeaderActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Variant determines the styling based on header background
   * - light: white background with dark text (for bright gradients)
   * - dark: dark background with light text (for dark headers)
   */
  variant?: HeaderActionVariant;
  /**
   * Optional icon to display before the label
   */
  icon?: React.ReactNode;
  /**
   * Button label/content
   */
  children: React.ReactNode;
  /**
   * Optional additional classes
   */
  className?: string;
}

/**
 * HeaderAction Component - Standardized pill-style action button for page headers
 * 
 * Features:
 * - Consistent rounded-full pill design
 * - Two variants: light (for bright headers) and dark (for dark headers)
 * - Medium font-weight for readability
 * - Subtle shadow for elevation
 * - Visible hover/focus states for accessibility
 * - Supports icons and custom content
 * - Maintains consistent padding across all uses
 */
export default function HeaderAction({
  variant = "light",
  icon,
  children,
  className,
  ...props
}: HeaderActionProps) {
  return (
    <button
      className={cn(
        // Base pill styling
        "inline-flex items-center justify-center gap-2",
        "rounded-full",
        "px-4 py-2",
        "text-sm font-medium",
        "shadow-sm",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        
        // Variant-specific styles
        variant === "light" && [
          // Light variant: white background with dark text (for bright gradients)
          "bg-white text-slate-900",
          "hover:bg-slate-50",
          "focus:ring-slate-300",
          "shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
        ],
        variant === "dark" && [
          // Dark variant: dark background with light text (for dark headers)
          "bg-white/10 text-white border border-white/40",
          "hover:bg-white/20",
          "focus:ring-white/50",
          "backdrop-blur-sm",
        ],
        
        // Custom additional classes
        className
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/**
 * HeaderActionGroup - Container for grouping multiple header actions
 * Provides consistent spacing between action buttons
 */
export function HeaderActionGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {children}
    </div>
  );
}
