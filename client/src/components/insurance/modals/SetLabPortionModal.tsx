// client/src/components/insurance/modals/SetLabPortionModal.tsx

import * as React from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast"; // ✅ CORRECT PATH

type ClaimLike = {
  id: number;
  memberNumber: string;
  billedAmount: string;
  amountPaid: string;
  serviceDate: string;
  patientName?: string | null;
};

interface SetLabPortionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: ClaimLike | null;
}

/**
 * Modal to record how much of an insurance payment belongs to the laboratory,
 * and how much was actually paid to the lab technician.
 *
 * For now this just shows a world-class UI and fires a toast.
 * You can later wire the submit handler to a real API endpoint.
 */
const SetLabPortionModal: React.FC<SetLabPortionModalProps> = ({ open, onOpenChange, claim }) => {...}
export default SetLabPortionModal;

  const [labPortion, setLabPortion] = React.useState<string>("");
  const [labTechPaid, setLabTechPaid] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      // reset form each time we open
      setLabPortion("");
      setLabTechPaid("");
      setNotes("");
    }
  }, [open, claim?.id]);

  if (!claim) {
    // If for some reason open=true but no claim is provided, just render nothing.
    return null;
  }

  const billed = Number.parseFloat(claim.billedAmount || "0") || 0;
  const paid = Number.parseFloat(claim.amountPaid || "0") || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const labPortionNum = Number(labPortion.replace(/,/g, ""));
    const labTechPaidNum = Number(labTechPaid.replace(/,/g, ""));

    if (!Number.isFinite(labPortionNum) || labPortionNum <= 0) {
      toast({
        title: "Invalid lab total",
        description: "Please enter a valid positive amount for the laboratory total.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(labTechPaidNum) || labTechPaidNum < 0) {
      toast({
        title: "Invalid amount paid to lab tech",
        description: "Please enter a valid amount paid to the lab technician.",
        variant: "destructive",
      });
      return;
    }

    // 🔒 For now we only show a confirmation toast.
    // Later you can post this to an endpoint like `/api/insurance-overview/lab-portion`.
    toast({
      title: "Lab portion saved (local only)",
      description:
        "The lab portion and amount paid to the lab tech have been captured in the UI. You can now decide how to persist this in the backend.",
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record laboratory portion</DialogTitle>
          <DialogDescription>
            There is no lab column in the insurance files, so the clinic needs to enter the
            lab total and the amount paid to the lab tech manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Claim summary */}
          <div className="rounded-lg border bg-slate-50 px-3 py-2.5 text-xs sm:text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">
                {claim.patientName || "Unknown patient"}{" "}
                <span className="text-slate-500">· {claim.memberNumber}</span>
              </div>
              <div className="text-slate-500">
                Service date:{" "}
                {new Date(claim.serviceDate).toLocaleDateString()}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] sm:text-xs text-slate-600">
              <span>
                Billed:{" "}
                <span className="font-semibold text-slate-800">
                  SSP {billed.toLocaleString()}
                </span>
              </span>
              <span>
                Insurance paid:{" "}
                <span className="font-semibold text-emerald-700">
                  SSP {paid.toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          {/* Lab portion fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="labPortion">Total paid to Laboratory (SSP)</Label>
              <Input
                id="labPortion"
                type="number"
                min={0}
                step="0.01"
                value={labPortion}
                onChange={(e) => setLabPortion(e.target.value)}
                placeholder="e.g. 15,000"
              />
              <p className="text-[11px] text-slate-500">
                From the total insurance payment, how much belongs to the lab?
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="labTechPaid">Amount paid to lab tech (SSP)</Label>
              <Input
                id="labTechPaid"
                type="number"
                min={0}
                step="0.01"
                value={labTechPaid}
                onChange={(e) => setLabTechPaid(e.target.value)}
                placeholder="e.g. 10,000"
              />
              <p className="text-[11px] text-slate-500">
                Actual cash you gave to the laboratory technician.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal notes (optional)</Label>
            <Input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Remaining kept for reagents / rent..."
            />
          </div>

          <DialogFooter className="pt-1 flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="font-semibold">
              Save lab portion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
