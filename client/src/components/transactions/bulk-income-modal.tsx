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

// ----- constants
const KNOWN_DEPTS = ["Consultation", "Laboratory", "Ultrasound", "X-Ray", "Pharmacy"];
const KNOWN_PROVIDERS = ["CIC", "UAP", "CIGNA", "Nile International", "New Sudan"];

// ----- helpers
const sanitizeAmount = (v: string) => {
  if (typeof v !== "string") return Number(v);
  const n = v.replace(/[^0-9.\-]/g, ""); // keep digits, dot, minus
  return Number(n);
};

type DeptRow = { departmentId?: string; amount: string };
type ProviderRow = { insuranceProviderId?: string; amount: string };

function emptyDeptRow(): DeptRow { return { departmentId: undefined, amount: "" }; }
function emptyProviderRow(): ProviderRow { return { insuranceProviderId: undefined, amount: "" }; }

export default function BulkIncomeModal({
  open,
  onOpenChange,
  date: initialDate,
  departments = [],
  insuranceProviders = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date?: string;                         // YYYY-MM-DD
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

  // Cash by department
  const [deptRows, setDeptRows] = useState<DeptRow[]>(
    Array.from({ length: 5 }, () => emptyDeptRow())
  );

  // Insurance totals (by provider)
  const [providerRows, setProviderRows] = useState<ProviderRow[]>(
    Array.from({ length: 5 }, () => emptyProviderRow())
  );

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  const byName = <T extends { id: string; name: string }>(list: T[], name: string) =>
    list.find((x) => x.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0);

  const prefillFiveDepartments = () => {
    const next: DeptRow[] = [];
    for (const label of KNOWN_DEPTS) {
      const d = byName(departments, label);
      if (d?.id) next.push({ departmentId: d.id, amount: "" });
    }
    if (next.length) setDeptRows(next);
  };

  const prefillProviders = () => {
    const ids = KNOWN_PROVIDERS
      .map((n) => byName(insuranceProviders, n))
      .filter(Boolean)
      .map((p) => p!.id);
    const next: ProviderRow[] = ids.map((id) => ({ insuranceProviderId: id, amount: "" }));
    if (next.length) setProviderRows(next);
  };

  // ---- table operations
  const patchDept = (i: number, patch: Partial<DeptRow>) =>
    setDeptRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addDept = () => setDeptRows((r) => [...r, emptyDeptRow()]);
  const removeDept = (i: number) => setDeptRows((r) => r.filter((_, idx) => idx !== i));

  const patchProv = (i: number, patch: Partial<ProviderRow>) =>
    setProviderRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addProv = () => setProviderRows((r) => [...r, emptyProviderRow()]);
  const removeProv = (i: number) => setProviderRows((r) => r.filter((_, idx) => idx !== i));

  // ---- validation views
  const validDeptRows = useMemo(
    () =>
      deptRows
        .map((r) => ({ ...r, amountNum: sanitizeAmount(r.amount) }))
        .filter((r) => r.departmentId && isFinite(r.amountNum) && r.amountNum > 0),
    [deptRows]
  );

  const validProviderRows = useMemo(
    () =>
      providerRows
        .map((r) => ({ ...r, amountNum: sanitizeAmount(r.amount) }))
        .filter((r) => r.insuranceProviderId && isFinite(r.amountNum) && r.amountNum > 0),
    [providerRows]
  );

  // ---- save
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      // Combine both sections into single payload for /bulk-income
      const rows = [
        // cash by department → mark as cash (no-insurance)
        ...validDeptRows.map((r) => ({
          departmentId: r.departmentId!,
          insuranceProviderId: "no-insurance" as const,
          amount: sanitizeAmount(r.amount),
        })),
        // insurance totals → provider only, no department
        ...validProviderRows.map((r) => ({
          departmentId: null,
          insuranceProviderId: r.insuranceProviderId!,
          amount: sanitizeAmount(r.amount),
        })),
      ];

      if (rows.length === 0) {
        throw new Error("Please enter at least one positive amount (department or insurance).");
      }

      const payload = {
        date,
        currency,
        notes: notes || undefined,
        rows,
      };

      return apiRequest("POST", "/api/transactions/bulk-income", payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Daily income saved." });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      setDeptRows(Array.from({ length: 5 }, () => emptyDeptRow()));
      setProviderRows(Array.from({ length: 5 }, () => emptyProviderRow()));
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
        {/* Overlay behind the content (no dim over modal) */}
        <DialogOverlay className="fixed inset-0 z-[80] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogContent className="fixed left-1/2 top-1/2 z-[90] grid w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-white p-5 shadow-xl">
          <DialogHeader>
            <DialogTitle>Daily Bulk Income</DialogTitle>
          </DialogHeader>

          {/* Top controls */}
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

          {/* Quick buttons */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={prefillFiveDepartments}>Prefill 5 departments</Button>
            <Button type="button" variant="outline" onClick={prefillProviders}>Prefill providers</Button>
          </div>

          {/* Cash by Department */}
          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-slate-100 text-sm font-semibold text-slate-700 rounded-t-lg">
              Cash by Department
            </div>
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
              <div className="col-span-7">Department</div>
              <div className="col-span-4 text-right">Amount</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y">
              {deptRows.map((row, idx) => (
                <div key={`d-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-7">
                    <Select
                      value={row.departmentId ?? undefined}
                      onValueChange={(v) => patchDept(idx, { departmentId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      value={row.amount}
                      onChange={(e) => patchDept(idx, { amount: e.target.value })}
                      placeholder="0"
                      className="text-right"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDept(idx)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3">
              <Button type="button" onClick={addDept} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add row
              </Button>
            </div>
          </div>

          {/* Insurance Totals */}
          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-slate-100 text-sm font-semibold text-slate-700 rounded-t-lg">
              Insurance Totals (no department)
            </div>
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
              <div className="col-span-7">Insurance Provider</div>
              <div className="col-span-4 text-right">Amount</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y">
              {providerRows.map((row, idx) => (
                <div key={`p-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-7">
                    <Select
                      value={row.insuranceProviderId ?? undefined}
                      onValueChange={(v) => patchProv(idx, { insuranceProviderId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select insurance provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {insuranceProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProv(idx)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3">
              <Button type="button" onClick={addProv} variant="outline">
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
              {isPending ? "Saving…" : "Save Daily Income"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
