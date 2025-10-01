"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog"; // ← use primitives to control overlay
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Dept = { id: string; name: string };
type Provider = { id: string; name: string };

type Row = {
  departmentId?: string;                        // undefined until chosen
  amount: string;                               // keep as text for UX; backend coerces
  insuranceProviderId?: string | "no-insurance";
  description?: string;
};

function makeEmptyRow(): Row {
  return {
    departmentId: undefined,
    amount: "",
    insuranceProviderId: "no-insurance",        // real value, never empty string
    description: "",
  };
}

export default function BulkIncomeModal({
  open,
  onOpenChange,
  date: initialDate,
  departments = [],
  insuranceProviders = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date?: string;                                // YYYY-MM-DD
  departments: Dept[];
  insuranceProviders: Provider[];
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
  const [rows, setRows] = useState<Row[]>([
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
  ]);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const addRow = () => setRows((r) => [...r, makeEmptyRow()]);
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, amountNum: Number(r.amount) }))
        .filter((r) => r.departmentId && isFinite(r.amountNum) && r.amountNum > 0),
    [rows]
  );

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        currency,
        defaultInsuranceProviderId: "no-insurance" as const,
        notes: notes || undefined,
        rows: validRows.map((r) => ({
          departmentId: r.departmentId!,
          amount: Number(r.amount),
          description: r.description || undefined,
          insuranceProviderId: r.insuranceProviderId ?? "no-insurance",
        })),
      };
      if (payload.rows.length === 0) {
        throw new Error("Please fill at least one department with a positive amount.");
      }
      return apiRequest("POST", "/api/transactions/bulk-income", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Daily income saved for all departments." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      // reset for next entry
      setRows([makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
      setNotes("");
    },
    onError: (e: any) => {
      toast({
        title: "Could not save",
        description: e?.message || "Something went wrong while saving bulk income.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Lighter overlay + slight blur; sits below content */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        {/* Content (above overlay) */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[95vw] sm:max-w-4xl -translate-x-1/2 -translate-y-1/2
                     rounded-lg border border-slate-200 bg-white shadow-xl outline-none"
        >
          <div className="p-6">
            <DialogHeader className="p-0 mb-4">
              <DialogTitle>Daily Bulk Income</DialogTitle>
            </DialogHeader>

            {/* Top form controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block">Transaction Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div>
                <Label className="mb-1 block">Currency</Label>
                <Select value={currency} onValueChange={(v: "SSP" | "USD") => setCurrency(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSP">SSP (South Sudanese Pound)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-1">
                <Label className="mb-1 block">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., ‘Daily totals’"
                />
              </div>
            </div>

            {/* Row grid */}
            <div className="mt-4 border rounded-lg">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
                <div className="col-span-5">Department</div>
                <div className="col-span-3 text-right">Amount</div>
                <div className="col-span-3">Insurance Provider</div>
                <div className="col-span-1" />
              </div>

              <div className="divide-y">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-3">
                    {/* Department */}
                    <div className="col-span-5">
                      <Select
                        value={row.departmentId ?? undefined}
                        onValueChange={(v) => patchRow(idx, { departmentId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments
                            .filter((d) => !!d?.id)
                            .map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount */}
                    <div className="col-span-3">
                      <Input
                        inputMode="numeric"
                        value={row.amount}
                        onChange={(e) => patchRow(idx, { amount: e.target.value })}
                        placeholder="0"
                        className="text-right"
                      />
                    </div>

                    {/* Provider */}
                    <div className="col-span-3">
                      <Select
                        value={row.insuranceProviderId ?? "no-insurance"}
                        onValueChange={(v) => patchRow(idx, { insuranceProviderId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Insurance provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-insurance">No insurance / Cash</SelectItem>
                          {insuranceProviders
                            .filter((p) => !!p?.id)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(idx)}
                        className="hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove row"
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

            <DialogFooter className="mt-4 p-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={() => mutateAsync()} disabled={isPending}>
                {isPending ? "Saving…" : "Save Daily Income"}
              </Button>
            </DialogFooter>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
