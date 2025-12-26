// client/src/components/layout/AppContainer.tsx
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Optional max width override */
  max?: "default" | "wide" | "full";
};

/**
 * Centers content and applies responsive horizontal padding.
 * Use this to wrap page sections so spacing is consistent on mobile/desktop.
 */
export default function AppContainer({ children, className, max = "full" }: Props) {
  const maxWidth =
    max === "wide" ? "max-w-[1400px]" :
    max === "default" ? "max-w-[1200px]" :
    "max-w-full"; // "full" allows it to stretch to the edges

  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", maxWidth, className)}>
      {children}
    </div>
  );
}
