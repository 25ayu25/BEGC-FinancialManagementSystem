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
import { useToast } from "@/hooks/use-toast";
import { setLabPortion } from "@/lib/api-insurance-lab";
import { Loader2 } from "lucide-react";

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
  currentCurrency = "SSP",
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("SSP");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Pre-fill data when modal opens
  React.useEffect(() => {
    if (open) {
      setAmount(currentAmount ? currentAmount.toString() : "");
      setCurrency(currentCurrency || "SSP");
    }
  }, [open, currentAmount, currentCurrency]);

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
        title: "Success",
        description: "Lab monthly total updated.",
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
        periodYear: year,
        periodMonth: month,
        currency,
        amount: parseFloat(amount.replace(/,/g, "")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodLabel = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Added bg-white to fix transparency issues */}
      <DialogContent className="sm:max-w-[425px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>Set Lab Insurance Revenue</DialogTitle>
          <DialogDescription>
            Enter the total amount submitted to insurance for the Laboratory for{" "}
            <strong>{periodLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="bg-slate-50">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="SSP">SSP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Total Lab Revenue</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50000"
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Total
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SetLabPortionModal;
