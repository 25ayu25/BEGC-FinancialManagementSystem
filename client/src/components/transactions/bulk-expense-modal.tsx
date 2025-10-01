"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Row = {
  expenseCategory?: string;   // required per row
  amount: string;
  description?: string;
};

function makeEmptyRow(): Row {
  return { expenseCategory: undefined, amount: "", description: "" };
}

// you can centralize these if you already have them in one place
const EXPENSE_CATEGORIES = [
  "Doctor Payments",
  "Lab Tech Payments",
  "Radiographer Payments",
  "Insurance Payments",
  "Staff Salaries",
  "Drugs Purchased",
  "Lab Reagents",
  "Equipment",
  "Landlord",
  "Transport",
  "Utilities",
  "Other",
];

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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });

  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([makeEmptyRow()]);

  const addRow = () => setRows((r) => [...r, makeEmptyRow()]);
  const removeRow = (idx: number) =>
    setRows((r) => r.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({
          ...r,
          amountNum: Number(String(r.amount).replace(/,/g, "")),
        }))
        .filter(
          (r) =>
            r.expenseCategory &&
            isFinite(r.amountNum) &&
            r.amountNum > 0
        ),
    [rows]
  );

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        currency,
        notes: notes || undefined,
        rows: validRows.map((r) => ({
          expenseCategory: r.expenseCategory!,
          amount: Number(String(r.amount).replace(/,/g, "")),
          description: r.description || notes || undefined,
        })),
      };
      if (payload.rows.length === 0) {
        throw new Error("Please add at least one expense line.");
      }
      return apiRequest("POST", "/api/transactions/bulk-expense", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Daily expenses saved." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      setRows([makeEmptyRow()]);
      setNotes("");
    },
    onError: (e: any) => {
      const detail =
        e?.response?.data?.details ||
        e?.response?.data?.error ||
        e?.message ||
        "Validation error.";
      toast({ title: "Could not save", description: String(detail), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl backdrop:bg-black/20">
        <DialogHeader>
          <DialogTitle>Bulk Expenses</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="mb-1 block">Transaction Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block">Currency</Label>
            <Select
              value={currency}
              onValueChange={(v: "SSP" | "USD") => setCurrency(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SSP">SSP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., ‘Daily expenses’"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
            <div className="col-span-6">Expense Category</div>
            <div className="col-span-5 text-right">Amount</div>
            <div className="col-span-1" />
          </div>

          <div className="divide-y">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-3">
                <div className="col-span-6">
                  <Select
                    value={row.expenseCategory ?? undefined}
                    onValueChange={(v) => patchRow(idx, { expenseCategory: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-5">
                  <Input
                    inputMode="numeric"
                    value={row.amount}
                    onChange={(e) => patchRow(idx, { amount: e.target.value })}
                    placeholder="0"
                    className="text-right"
                  />
                </div>

                <div className="col-span-1 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(idx)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3">
            <Button type="button" onClick={addRow} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add row
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutateAsync()} disabled={isPending}>
            {isPending ? "Saving…" : "Save Expenses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
