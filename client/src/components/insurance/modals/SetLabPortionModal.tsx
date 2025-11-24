// client/src/components/insurance/modals/SetLabPortionModal.tsx
import * as React from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const FormSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  providerId: z.string().optional().nullable(),          // null = all providers
  submittedUSD: z.coerce.number().nonnegative(),         // total lab claims submitted (USD) for that year
  sharePercent: z.coerce.number().min(0).max(100).default(35),
  paidToLabSSP: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultYear?: number;
  defaultProviderId?: string | null; // pass null for “All providers”
};

export default function SetLabPortionModal({
  open,
  onOpenChange,
  defaultYear = new Date().getUTCFullYear(),
  defaultProviderId = null,
}: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);

  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    const raw = Object.fromEntries(fd.entries());
    // normalize
    const payload = {
      periodYear: raw.periodYear,
      providerId: (raw.providerId as string) || null,
      submittedUSD: raw.submittedUSD,
      sharePercent: raw.sharePercent || 35,
      paidToLabSSP: raw.paidToLabSSP || 0,
      notes: raw.notes,
    };

    const parse = FormSchema.safeParse(payload);
    if (!parse.success) {
      toast({ title: "Please check the form", description: "Invalid values.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      // Adjust path if you named it slightly differently server-side
      const res = await fetch("/api/lab-insurance-share/baselines", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parse.data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to save");
      }
      toast({ title: "Saved", description: "Lab insurance baseline updated." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: String(err.message || err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Lab Insurance Baseline</DialogTitle>
          <DialogDescription>
            Record the yearly <b>Laboratory</b> claims submitted (USD), the agreed share (%), and how much you’ve already paid the lab (SSP).
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodYear">Year</Label>
              <Input id="periodYear" name="periodYear" type="number" defaultValue={defaultYear} required />
            </div>
            <div>
              <Label htmlFor="providerId">Provider (optional)</Label>
              {/* If you have a provider select component, swap this Input out */}
              <Input id="providerId" name="providerId" placeholder="All providers" defaultValue={defaultProviderId ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="submittedUSD">Lab claims submitted (USD)</Label>
              <Input id="submittedUSD" name="submittedUSD" inputMode="decimal" placeholder="e.g., 5214.50" required />
            </div>
            <div>
              <Label htmlFor="sharePercent">Lab share (%)</Label>
              <Input id="sharePercent" name="sharePercent" type="number" min={0} max={100} defaultValue={35} required />
            </div>
          </div>

          <div>
            <Label htmlFor="paidToLabSSP">Already paid to lab (SSP)</Label>
            <Input id="paidToLabSSP" name="paidToLabSSP" inputMode="decimal" placeholder="e.g., 350000" defaultValue={0} />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" placeholder="Any context" />
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
