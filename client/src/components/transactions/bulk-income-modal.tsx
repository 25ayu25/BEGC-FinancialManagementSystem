"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
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
  departmentId?: string;                 // must be a real id or undefined
  amount: string;                        // keep as text for UX
  insuranceProviderId?: string | "no-insurance";
};

const KNOWN_DEPTS = ["Consultation", "Laboratory", "Ultrasound", "X-Ray", "Pharmacy"];
const KNOWN_PROVIDERS = ["CIC", "UAP", "CIGNA", "Nile International", "New Sudan"];

function makeEmptyRow(): Row {
  return { amount: "", departmentId: undefined, insuranceProviderId: "no-insurance" };
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
  date?: string;
  departments: Dept[];
  insuranceProviders: Provider[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return initialDate ?? `${y}-${m}-${dd}`;
  });
  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // ---------- helpers ----------
  const addRow = () => setRows((r) => [...r, makeEmptyRow()]);
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const byName = (list: { id: string; name: string }[], name: string) =>
    list.find((x) => x.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0);

  const prefillFiveDepartments = () => {
    const next: Row[] = [];
    for (const label of KNOWN_DEPTS) {
      const d = byName(departments, label);
      if (d?.id) next.push({ departmentId: d.id, amount: "", insuranceProviderId: "no-insurance" });
    }
    if (next.length) setRows(next);
  };

  const setProviderForAll = (providerId: string | "no-insurance") => {
    setRows((r) => r.map((row) => ({ ...row, insuranceProviderId: providerId })));
  };

  const quickUSDProviders = () => {
    // Ensures currency USD and opens 5 rows with the common providers pre-selected for convenience.
    setCurrency("USD");
    const baseDepts = rows.length ? rows : KNOWN_DEPTS
      .map((n) => byName(departments, n))
      .filter(Boolean)
      .map((d) => ({ departmentId: d!.id, amount: "", insuranceProviderId: "no-insurance" as const }));

    const providerIds = KNOWN_PROVIDERS
      .map((n) => byName(insuranceProviders, n))
      .filter(Boolean)
      .map((p) => p!.id);

    // Just set the first N rows to have those providers; users can add more rows if they want one row per provider.
    const next = baseDepts.map((r, i) => ({
      ...r,
      insuranceProviderId: providerIds[i % providerIds.length] ?? "no-insurance",
    }));
    setRows(next);
  };

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, amountNum: Number(r.amount) }))
        .filter((r) => r.departmentId && isFinite(r.amountNum) && r.amountNum > 0),
    [rows]
  );

  // ---------- save ----------
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
          insuranceProviderId: r.insuranceProviderId ?? "no-insurance",
        })),
      };
      if (payload.rows.length === 0) throw new Error("Please enter at least one positive amount.");
      return apiRequest("POST", "/api/transactions/bulk-income", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Daily income saved for all departments." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      setRows([makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
      setNotes("");
    },
    onError: (e: any) => {
      toast({
        title: "Could not save",
        description: e?.message || "Validation error.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Overlay kept behind the content */}
        <DialogOverlay className="fixed inset-0 z-[80] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogContent className="fixed left-1/2 top-1/2 z-[90] grid w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-white p-5 shadow-xl">
          <DialogHeader>
            <DialogTitle>Daily Bulk Income</DialogTitle>
          </DialogHeader>

          {/* top-line controls + quick buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-3">
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

            <div>
              <Label className="mb-1 block">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., ‘Daily totals’" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={prefillFiveDepartments}>Prefill 5 departments</Button>
            <Button type="button" variant="outline" onClick={quickUSDProviders}>Prefill providers (USD)</Button>

            {/* set same provider for all rows */}
            <Select onValueChange={(v) => setProviderForAll(v as any)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Set provider for ALL…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-insurance">No insurance / Cash</SelectItem>
                {insuranceProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* table-like rows */}
          <div className="border rounded-lg">
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
                        {departments.filter((d) => !!d?.id).map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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
                        {insuranceProviders.filter((p) => !!p?.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex items-center justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)} className="hover:bg-red-50 hover:text-red-600">
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={() => mutateAsync()} disabled={isPending}>
              {isPending ? "Saving…" : "Save Daily Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
