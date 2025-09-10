import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Mobile-first page container:
 * - Comfortable side padding on phones
 * - Wider padding on tablet/desktop
 * - Max width to avoid super-wide lines on desktop
 */
export default function AppContainer({ className, children }: Props) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8", className)}>
      {children}
    </div>
  );
}
