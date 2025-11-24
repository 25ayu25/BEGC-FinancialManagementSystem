import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addLabPayment } from "@/lib/api-insurance-lab";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean; onOpenChange: (v: boolean) => void;
  year: number; month: number;
  defaultCurrency?: "SSP" | "USD";
};

export default function AddLabPaymentModal({ open, onOpenChange, year, month, defaultCurrency="SSP" }: Props) {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<"SSP" | "USD">(defaultCurrency);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [note, setNote] = useState("");

  const save = async () => {
    const val = Number(amount);
    if (!val || val < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    await addLabPayment({ payDate, periodYear: year, periodMonth: month, currency, amount: +val.toFixed(2), note });
    toast({ title: "Payment recorded" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment to Lab Tech</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label>Date</Label>
              <Input type="date" value={payDate} onChange={(e)=>setPayDate(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v:any)=>setCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">SSP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Label>Amount</Label>
              <Input placeholder="0.00" inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input placeholder="e.g., advance for CIC payment" value={note} onChange={(e)=>setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
