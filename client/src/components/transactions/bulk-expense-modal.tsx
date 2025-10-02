"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, X } from "lucide-react";

// Same list your single-entry form exposes
const EXPENSES = [
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
  "Other",
];

type Row = { expenseCategory?: string; amount: string; description?: string };

export default function BulkExpenseModal({
  open,
  onOpenChange,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [date, setDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [rows, setRows] = useState<Row[]>([{ expenseCategory: undefined, amount: "" }]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const addRow = () => setRows((r) => [...r, { expenseCategory: undefined, amount: "" }]);
  const rmRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const patch = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const toNumber = (v: string) => {
    const n = Number((v || "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  const validPayloads = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, amountNum: toNumber(r.amount) }))
        .filter((r) => r.expenseCategory && r.amountNum > 0),
    [rows]
  );

  const prefillCommon = () => {
    setRows(
      ["Clinic Operations", "Doctor Payments", "Lab Tech Payments", "Radiographer Payments"].map(
        (name) => ({ expenseCategory: name, amount: "" })
      )
    );
  };

  const saveAll = async () => {
    if (validPayloads.length === 0) {
      toast({ title: "Nothing to save", description: "Enter at least one positive amount.", variant: "destructive" });
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    const when = new Date(date).toISOString();
    const reqs = validPayloads.map((r) =>
      apiRequest("POST", "/api/transactions", {
        type: "expense",
        date: when,
        amount: String(r.amountNum),
        currency,
        description: r.description || "Expense",
        departmentId: null,
        insuranceProviderId: null,
        expenseCategory: r.expenseCategory,
        staffType: r.expenseCategory?.includes("Payments") ? undefined : null,
        receiptPath: null,
      })
    );

    const results = await Promise.allSettled(reqs);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;

    if (ok) {
      toast({ title: "Saved", description: `${ok} expense${ok > 1 ? "s" : ""} created.` });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
    }
    if (fail) {
      toast({ title: "Some rows failed", description: `${fail} didn’t save.`, variant: "destructive" });
    }

    setIsSaving(false);

    if (ok && !fail) {
      setRows([{ expenseCategory: undefined, amount: "" }]);
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-0 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl rounded-xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 max-h-[90vh] overflow-auto relative">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Bulk Expenses</h2>
            <button onClick={() => onOpenChange(false)} className="px-2 py-1 rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block">Transaction Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Currency</Label>
                <Select value={currency} onValueChange={(v: "SSP" | "USD") => setCurrency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSP">SSP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={prefillCommon}>Prefill Expenses</Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">
                <div className="col-span-7">Expense Category</div>
                <div className="col-span-4 text-right">Amount</div>
                <div className="col-span-1" />
              </div>
              <div className="divide-y">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-3">
                    <div className="col-span-7">
                      <Select value={row.expenseCategory ?? undefined} onValueChange={(v) => patch(idx, { expenseCategory: v })}>
                        <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                        <SelectContent>
                          {EXPENSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <Input inputMode="numeric" className="text-right" placeholder="0"
                        value={row.amount} onChange={(e) => patch(idx, { amount: e.target.value })} />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => rmRow(idx)} className="hover:bg-red-50 hover:text-red-600">🗑️</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3">
                <Button type="button" variant="outline" onClick={addRow}>＋ Add row</Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={saveAll} disabled={validPayloads.length === 0 || isSaving}>Save Expenses</Button>
          </div>

          {/* saving overlay + spinner */}
          {isSaving && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
