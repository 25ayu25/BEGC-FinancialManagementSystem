"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Dept = { id: string; name: string };
type Provider = { id: string; name: string };

type CashRow = {
  departmentId?: string;
  amount: string;
};

type ProviderRow = {
  insuranceProviderId?: string;
  amount: string;
};

function emptyCashRow(): CashRow {
  return { departmentId: undefined, amount: "" };
}
function emptyProviderRow(): ProviderRow {
  return { insuranceProviderId: undefined, amount: "" };
}

export default function BulkIncomeModal({
  open,
  onOpenChange,
  departments = [],
  insuranceProviders = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Dept[];
  insuranceProviders: Provider[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });

  // Cash section (by department) — usually SSP
  const [cashCurrency, setCashCurrency] = useState<"SSP" | "USD">("SSP");
  const [cashRows, setCashRows] = useState<CashRow[]>([emptyCashRow(), emptyCashRow(), emptyCashRow(), emptyCashRow(), emptyCashRow()]);

  // Insurance totals (by provider) — always USD in your workflow
  const [providerCurrency, setProviderCurrency] = useState<"USD" | "SSP">("USD");
  const [providerRows, setProviderRows] = useState<ProviderRow[]>([emptyProviderRow()]);

  const [notes, setNotes] = useState("");

  // Prefill helpers
  const prefillDepts = () => {
    const desired = ["Consultation", "Laboratory", "Ultrasound", "X-Ray", "Pharmacy"];
    const mapped = desired
      .map((name) => departments.find((d) => d.name.toLowerCase() === name.toLowerCase()))
      .filter(Boolean) as Dept[];
    setCashRows(mapped.map((d) => ({ departmentId: d.id, amount: "" })));
  };
  const prefillProviders = () => {
    const priority = ["CIC", "UAP", "CIGNA", "Nile International", "New Sudan", "ALIMA", "Amanah"];
    const mapped = insuranceProviders
      .slice()
      .sort((a, b) => {
        const ai = priority.findIndex((p) => a.name.toLowerCase().includes(p.toLowerCase()));
        const bi = priority.findIndex((p) => b.name.toLowerCase().includes(p.toLowerCase()));
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map((p) => ({ insuranceProviderId: p.id, amount: "" }));
    setProviderRows(mapped.length ? mapped : [emptyProviderRow()]);
  };

  // Disable closing while saving
  const guardOpenChange = (v: boolean) => {
    if (isPending) return; // block close during submit
    onOpenChange(v);
  };

  // Normalize & validate rows
  const validCashRows = useMemo(
    () =>
      cashRows
        .map((r) => ({ ...r, amountNum: Number(String(r.amount).replace(/,/g, "")) }))
        .filter((r) => r.departmentId && isFinite(r.amountNum) && r.amountNum > 0),
    [cashRows]
  );

  const validProviderRows = useMemo(
    () =>
      providerRows
        .map((r) => ({ ...r, amountNum: Number(String(r.amount).replace(/,/g, "")) }))
        .filter((r) => r.insuranceProviderId && isFinite(r.amountNum) && r.amountNum > 0),
    [providerRows]
  );

  const { mutateAsync, isPending } = useMutation({
    // We send *two* requests if needed: cash first, then providers.
    mutationFn: async () => {
      const created: any[] = [];

      // Cash by department (no insurance)
      if (validCashRows.length > 0) {
        const payload1 = {
          date,
          currency: cashCurrency,
          defaultInsuranceProviderId: "no-insurance" as const,
          notes: notes || undefined,
          rows: validCashRows.map((r) => ({
            departmentId: r.departmentId!,
            amount: Number(String(r.amount).replace(/,/g, "")),
            description: notes || "Daily income",
            insuranceProviderId: "no-insurance",
          })),
        };
        const res1 = await apiRequest("POST", "/api/transactions/bulk-income", payload1);
        created.push(res1);
      }

      // Insurance totals by provider (USD)
      if (validProviderRows.length > 0) {
        const payload2 = {
          date,
          currency: providerCurrency,
          defaultInsuranceProviderId: null as any,
          notes: notes || undefined,
          rows: validProviderRows.map((r) => ({
            amount: Number(String(r.amount).replace(/,/g, "")),
            insuranceProviderId: r.insuranceProviderId!,
            description: notes || "Insurance daily total",
          })),
        };
        const res2 = await apiRequest("POST", "/api/transactions/bulk-income", payload2);
        created.push(res2);
      }

      if (created.length === 0) {
        throw new Error("Please fill at least one positive amount.");
      }
      return created;
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Daily income saved." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });

      // reset & close
      setCashRows([emptyCashRow(), emptyCashRow(), emptyCashRow(), emptyCashRow(), emptyCashRow()]);
      setProviderRows([emptyProviderRow()]);
      setNotes("");
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({
        title: "Could not save",
        description: e?.message || "Something went wrong while saving bulk income.",
        variant: "destructive",
      });
    },
  });

  // UI helpers to edit rows
  const patchCash = (i: number, patch: Partial<CashRow>) =>
    setCashRows((rows) => rows.map((r, idx) => (i === idx ? { ...r, ...patch } : r)));
  const addCash = () => setCashRows((rows) => [...rows, emptyCashRow()]);
  const removeCash = (i: number) => setCashRows((rows) => rows.filter((_, idx) => idx !== i));

  const patchProv = (i: number, patch: Partial<ProviderRow>) =>
    setProviderRows((rows) => rows.map((r, idx) => (i === idx ? { ...r, ...patch } : r)));
  const addProv = () => setProviderRows((rows) => [...rows, emptyProviderRow()]);
  const removeProv = (i: number) => setProviderRows((rows) => rows.filter((_, idx) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={guardOpenChange}>
      <DialogContent className="relative">
        {/* Saving banner */}
        {isPending && (
          <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-md bg-teal-50 px-3 py-1 text-sm text-teal-700 ring-1 ring-teal-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </div>
        )}

        <DialogHeader>
          <DialogTitle>Daily Bulk Income</DialogTitle>
        </DialogHeader>

        {/* Disable everything while saving; slight dim for visual feedback */}
        <fieldset disabled={isPending} className={isPending ? "opacity-60 pointer-events-none" : ""}>
          {/* top controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Transaction Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Currency (cash by department)</Label>
              <Select value={cashCurrency} onValueChange={(v: "SSP" | "USD") => setCashCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSP">SSP (South Sudanese Pound)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input placeholder="e.g., ‘Daily totals’" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Button type="button" variant="outline" onClick={prefillDepts}>Prefill 5 Departments</Button>
            <Button type="button" variant="outline" onClick={prefillProviders}>Prefill Insurances</Button>
            <div className="ml-auto w-40">
              <Label className="mb-1 block">Provider currency</Label>
              <Select value={providerCurrency} onValueChange={(v: "USD" | "SSP") => setProviderCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="SSP">SSP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cash by department */}
          <div className="mt-3 border rounded-lg">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">
              <div className="col-span-7">Cash by Department</div>
              <div className="col-span-4 text-right">Amount</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y">
              {cashRows.map((row, idx) => (
                <div key={`c-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-7">
                    <Select value={row.departmentId ?? ""} onValueChange={(v) => patchCash(idx, { departmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem value={d.id} key={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(e) => patchCash(idx, { amount: e.target.value })}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button type="button" variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" onClick={() => removeCash(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3">
              <Button type="button" onClick={addCash} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add row
              </Button>
            </div>
          </div>

          {/* Providers section */}
          <div className="mt-4 border rounded-lg">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">
              <div className="col-span-7">Insurance Totals (by provider)</div>
              <div className="col-span-4 text-right">Amount</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y">
              {providerRows.map((row, idx) => (
                <div key={`p-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-7">
                    <Select
                      value={row.insuranceProviderId ?? ""}
                      onValueChange={(v) => patchProv(idx, { insuranceProviderId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        {insuranceProviders.map((p) => (
                          <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(e) => patchProv(idx, { amount: e.target.value })}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button type="button" variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" onClick={() => removeProv(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3">
              <Button type="button" onClick={addProv} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add row
              </Button>
            </div>
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => guardOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => !isPending && mutateAsync()} disabled={isPending}>
            {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>) : "Save Daily Income"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
