"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Row = { expenseCategory?: string; amount: string; description?: string };

const PREFILL_EXPENSES = [
  "Clinic Operations",
  "Doctor Payments",
  "Lab Tech Payments",
  "Radiographer Payments",
  "Insurance Payments",
  "Staff Salaries",
  "Drugs Purchased",
  "Lab Reagents",
  "Equipment",
  "Landlord",
  "Fuel", // new
];

function emptyRow(): Row {
  return { expenseCategory: undefined, amount: "", description: "" };
}

export default function BulkExpenseModal({
  open,
  onOpenChange,
  date: initialDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [date, setDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const toNumber = (v: string) => {
    const n = Number((v ?? "").toString().replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, amountNum: toNumber(r.amount) }))
        .filter((r) => r.expenseCategory && r.amountNum > 0),
    [rows]
  );

  const guardRef = useRef(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      if (!validRows.length) throw new Error("Please enter at least one positive expense.");
      const payload = {
        date,
        currency,
        notes: notes || undefined,
        rows: validRows.map((r) => ({
          expenseCategory: r.expenseCategory!,
          amount: r.amountNum,
          description: r.description || undefined,
        })),
      };
      return apiRequest("POST", "/api/transactions/bulk-expense", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Bulk expenses saved." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      setRows([emptyRow()]);
      setNotes("");
      guardRef.current = false;
    },
    onError: (e: any) => {
      toast({
        title: "Could not save",
        description: e?.message || "Something went wrong while saving expenses.",
        variant: "destructive",
      });
      guardRef.current = false;
    },
  });

  const onSubmit = async () => {
    if (isPending || guardRef.current) return;
    guardRef.current = true;
    await mutateAsync();
  };

  const prefill = () => setRows(PREFILL_EXPENSES.map((name) => ({ expenseCategory: name, amount: "" })));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) guardRef.current = false; onOpenChange(v); }}>
      <DialogContent className="max-w-2xl relative">
        {/* saving overlay */}
        <div className={`absolute inset-0 z-10 ${isPending ? "flex" : "hidden"} items-center justify-center bg-white/60 backdrop-blur-[1px]`}>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </div>
        </div>

        <DialogHeader>
          <DialogTitle>Bulk Expenses</DialogTitle>
        </DialogHeader>

        <fieldset disabled={isPending} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block">Transaction Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Currency</Label>
              <Select value={currency} onValueChange={(v: "SSP" | "USD") => setCurrency(v)}>
                <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">SSP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., ‘Daily expenses’" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={prefill}>Prefill common</Button>
          </div>

          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">Expenses</div>

            <div className="grid grid-cols-12 gap-2 px-3 pt-2 text-xs text-slate-500">
              <div className="col-span-7">Expense Category</div>
              <div className="col-span-4 text-right">Amount</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-7">
                    <Select
                      value={row.expenseCategory ?? undefined}
                      onValueChange={(v) => setRow(idx, { expenseCategory: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                      <SelectContent>
                        {PREFILL_EXPENSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      className="text-right"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => setRow(idx, { amount: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setRows((r) => r.filter((_, i) => i !== idx))}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3">
              <Button type="button" variant="outline" onClick={() => setRows((r) => [...r, emptyRow()])}>
                <Plus className="h-4 w-4 mr-2" /> Add row
              </Button>
            </div>
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Expenses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
