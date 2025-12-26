// client/src/components/layout/AppContainer.tsx
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Optional max width override */
  max?: "default" | "wide";
};

/**
 * Centers content and applies responsive horizontal padding.
 * Use this to wrap page sections so spacing is consistent on mobile/desktop.
 */
export default function AppContainer({ children, className, max = "default" }: Props) {
  const maxWidth = max === "wide" ? "max-w-[1400px]" : "max-w-[1200px]";
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", maxWidth, className)}>
      {children}
    </div>
  );
}
