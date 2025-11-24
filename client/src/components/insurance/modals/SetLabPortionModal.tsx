import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast"; // ✅ CORRECT PATH

interface SetLabPortionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: any; // Using any to be flexible with the claim object structure
}

const SetLabPortionModal: React.FC<SetLabPortionModalProps> = ({
  open,
  onOpenChange,
  claim,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form State
  const [amount, setAmount] = React.useState<string>("");
  const [currency, setCurrency] = React.useState<string>("SSP");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setAmount("");
      setCurrency("SSP");
    }
  }, [open, claim?.id]);

  if (!claim) return null;

  // Calculate display values
  const billed = Number.parseFloat(claim.billedAmount || "0") || 0;
  const paid = Number.parseFloat(claim.amountPaid || "0") || 0;

  // Derive period from claim date
  const serviceDate = claim.serviceDate ? new Date(claim.serviceDate) : new Date();
  const periodYear = serviceDate.getFullYear();
  const periodMonth = serviceDate.getMonth() + 1;

  // API Mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/insurance/lab-portion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to set portion");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lab portion updated successfully",
      });
      // Refresh the summary data
      queryClient.invalidateQueries({ queryKey: ["lab-summary"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    setIsSubmitting(true);
    try {
      await mutation.mutateAsync({
        periodYear,
        periodMonth,
        departmentCode: "LAB",
        currency,
        amount: parseFloat(amount.replace(/,/g, "")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Laboratory Portion</DialogTitle>
          <DialogDescription>
            Specify how much of this insurance claim is allocated to the Laboratory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Claim Summary Card */}
          <div className="rounded-lg border bg-slate-50 px-3 py-2.5 text-xs sm:text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">
                {claim.patientName || "Unknown patient"}{" "}
                <span className="text-slate-500">· {claim.memberNumber}</span>
              </div>
              <div className="text-slate-500">
                Service date: {serviceDate.toLocaleDateString()}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] sm:text-xs text-slate-600">
              <span>
                Billed:{" "}
                <span className="font-semibold text-slate-800">
                  {claim.currency || "SSP"} {billed.toLocaleString()}
                </span>
              </span>
              <span>
                Insurance paid:{" "}
                <span className="font-semibold text-emerald-700">
                  {claim.currency || "SSP"} {paid.toLocaleString()}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Currency Select */}
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">SSP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <Label htmlFor="labPortion">Allocated Amount</Label>
              <Input
                id="labPortion"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            * This sets the total allocated pot for the Lab department for this month. 
            To record payments made to staff, use the "Add Lab Payment" option.
          </p>

          <DialogFooter className="pt-1 flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="font-semibold" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Portion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SetLabPortionModal;
