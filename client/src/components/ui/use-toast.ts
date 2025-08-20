// client/src/components/ui/use-toast.ts
// Minimal no-frills fallback so pages can call `useToast()` safely.
// It logs to the console; later we can swap in a fancy UI toaster.

type ToastVariant = "default" | "destructive";

type ToastInput = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
};

export function useToast() {
  function toast({ title, description, variant = "default" }: ToastInput = {}) {
    const msg = [title, description].filter(Boolean).join(" — ");
    if (variant === "destructive") {
      console.error(msg || "An error occurred.");
    } else {
      console.log(msg || "Notice");
    }
  }
  return { toast };
}
