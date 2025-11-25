import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addLabPayment, updateLabPayment } from "@/lib/api-insurance-lab";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type EditPayment = {
  id?: string | number;
  payDate: string;
  amount: number;
  note?: string;
  currency?: string;
  periodYear?: number;
  periodMonth?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  year: number;
  month: number;
  /** Optional, still defaults to USD */
  defaultCurrency?: "SSP" | "USD" | string;
  /** When provided, modal works in "edit" mode */
  paymentToEdit?: EditPayment | null;
  /** Called after a successful save (create or edit) */
  onSaved?: () => void;
};

export default function AddLabPaymentModal({
  open,
  onOpenChange,
  year,
  month,
  defaultCurrency,
  paymentToEdit,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!paymentToEdit?.id;
  const currency = paymentToEdit?.currency || defaultCurrency || "USD";

  // Period to send to the API (use payment's period when editing, otherwise current filters)
  const periodYear = paymentToEdit?.periodYear ?? year;
  const periodMonth = paymentToEdit?.periodMonth ?? month;

  // When modal opens or paymentToEdit changes, pre-fill fields
  useEffect(() => {
    if (!open) return;

    if (paymentToEdit && paymentToEdit.id != null) {
      setAmount(
        paymentToEdit.amount !== undefined
          ? String(paymentToEdit.amount)
          : ""
      );
      // keep only YYYY-MM-DD part if it's ISO
      const datePart =
        paymentToEdit.payDate?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      setPayDate(datePart);
      setNote(paymentToEdit.note || "");
    } else {
      // create mode defaults
      setAmount("");
      setPayDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [open, paymentToEdit]);

  const save = async () => {
    const val = Number(amount);
    if (!val || val <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a value greater than 0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        payDate,
        periodYear,
        periodMonth,
        currency,
        amount: +val.toFixed(2),
        note,
      };

      if (isEdit && paymentToEdit?.id != null) {
        await updateLabPayment(paymentToEdit.id, payload);
        toast({ title: "Payment updated" });
      } else {
        await addLabPayment(payload);
        toast({ title: "Payment recorded" });
      }

      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Payment" : "Record Payment to Technician"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update a cash payment given to the Lab Technician."
              : "Record a cash payment given to the Lab Technician."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Row */}
          <div className="grid gap-2">
            <Label htmlFor="date">Payment Date</Label>
            <Input
              id="date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          {/* Amount Row */}
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Note Row */}
          <div className="grid gap-2">
            <Label htmlFor="note">Note (Optional)</Label>
            <Input
              id="note"
              placeholder="e.g., Advance for CIC payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEdit ? "Save Changes" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
