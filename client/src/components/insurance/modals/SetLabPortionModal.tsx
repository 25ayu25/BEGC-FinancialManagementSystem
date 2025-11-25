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
import { useToast } from "@/hooks/use-toast";
import { setLabPortion } from "@/lib/api-insurance-lab";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SetLabPortionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  currentAmount?: number;
  currentCurrency?: string;
}

const SetLabPortionModal: React.FC<SetLabPortionModalProps> = ({
  open,
  onOpenChange,
  year,
  month,
  currentAmount = 0,
  currentCurrency,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [periodYear, setPeriodYear] = React.useState(year);
  const [periodMonth, setPeriodMonth] = React.useState(month);

  const currency = currentCurrency || "USD";

  // Pre-fill data & period when modal opens
  React.useEffect(() => {
    if (open) {
      setPeriodYear(year);
      setPeriodMonth(month);
      setAmount(currentAmount ? currentAmount.toString() : "");
    }
  }, [open, year, month, currentAmount]);

  const mutation = useMutation({
    mutationFn: async (data: {
      periodYear: number;
      periodMonth: number;
      currency: string;
      amount: number;
    }) => {
      return await setLabPortion(data);
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "Lab monthly total has been updated.",
      });
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
    if (amount === "") return;

    setIsSubmitting(true);
    try {
      await mutation.mutateAsync({
        periodYear,
        periodMonth,
        currency,
        amount: parseFloat(amount.replace(/,/g, "")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodLabel = new Date(periodYear, periodMonth - 1).toLocaleString(
    "default",
    {
      month: "long",
      year: "numeric",
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Enter Lab Insurance Revenue</DialogTitle>
          <DialogDescription>
            Enter the total amount submitted to insurance for the Laboratory for{" "}
            <strong>{periodLabel}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Month & Year selection inside modal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Month</Label>
              <Select
                value={periodMonth.toString()}
                onValueChange={(v) => setPeriodMonth(parseInt(v))}
              >
                <SelectTrigger className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(2000, m - 1).toLocaleString("default", {
                        month: "long",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Year</Label>
              <Select
                value={periodYear.toString()}
                onValueChange={(v) => setPeriodYear(parseInt(v))}
              >
                <SelectTrigger className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="amount">
                Total Lab Revenue ({currency})
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="bg-slate-50 text-lg font-medium"
              />
              <p className="text-xs text-slate-500">
                The technician will receive 35% of this amount.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Monthly Total
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SetLabPortionModal;
