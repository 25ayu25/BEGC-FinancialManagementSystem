"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Dept = { id: string; name: string };
type Provider = { id: string; name: string };

type DeptRow = {
  departmentId?: string;
  amount: string; // keep as text for UX (commas etc.)
  description?: string;
};

type ProviderRow = {
  insuranceProviderId?: string;
  amount: string;
  description?: string;
};

const PREFILL_DEPT_NAMES = [
  "Consultation",
  "Laboratory",
  "Ultrasound",
  "X-Ray",
  "Pharmacy",
];

const PREFILL_PROVIDER_NAMES = ["CIC", "UAP", "CIGNA", "Nile International", "New Sudan"];

function emptyDeptRow(): DeptRow {
  return { departmentId: undefined, amount: "", description: "" };
}

function emptyProviderRow(): ProviderRow {
  return { insuranceProviderId: undefined, amount: "", description: "" };
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
  date?: string; // YYYY-MM-DD
  departments: Dept[];
  insuranceProviders: Provider[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ------- top-level controls -------
  const [date, setDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
  const [cashCurrency, setCashCurrency] = useState<"SSP" | "USD">("SSP");
  const [providerCurrency, setProviderCurrency] = useState<"SSP" | "USD">("USD");
  const [notes, setNotes] = useState("");

  // ------- rows -------
  const [deptRows, setDeptRows] = useState<DeptRow[]>([
    emptyDeptRow(),
    emptyDeptRow(),
    emptyDeptRow(),
    emptyDeptRow(),
    emptyDeptRow(),
  ]);
  const [providerRows, setProviderRows] = useState<ProviderRow[]>([emptyProviderRow()]);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // ------- helpers -------
  const setDept = (i: number, patch: Partial<DeptRow>) =>
    setDeptRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setProv = (i: number, patch: Partial<ProviderRow>) =>
    setProviderRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const toNumberLoose = (v: string) => {
    const n = Number((v ?? "").toString().replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  // Pre-fill 5 depts by name lookup
  const prefFillDepartments = () => {
    const map = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const filled = PREFILL_DEPT_NAMES.map((name) => ({
      departmentId: map.get(name.toLowerCase()),
      amount: "",
      description: "",
    }));
    setDeptRows(filled);
  };

  // Pre-fill top providers
  const prefFillProviders = () => {
    const map = new Map(insuranceProviders.map((p) => [p.name.toLowerCase(), p.id]));
    const filled = PREFILL_PROVIDER_NAMES.map((name) => ({
      insuranceProviderId: map.get(name.toLowerCase()),
      amount: "",
      description: "",
    }));
    setProviderRows(filled.length ? filled : [emptyProviderRow()]);
  };

  // Valid/converted rows (for preview or debug)
  const validDeptRows = useMemo(
    () =>
      deptRows
        .map((r) => ({ ...r, amountNum: toNumberLoose(r.amount) }))
        .filter((r) => r.departmentId && r.amountNum > 0),
    [deptRows]
  );

  const validProviderRows = useMemo(
    () =>
      providerRows
        .map((r) => ({ ...r, amountNum: toNumberLoose(r.amount) }))
        .filter((r) => r.insuranceProviderId && r.amountNum > 0),
    [providerRows]
  );

  // ------- submit (with double-click guard) -------
  const guardRef = useRef(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const created = { dept: 0, provider: 0 };

      // Post 1: cash by department (currency = cashCurrency)
      if (validDeptRows.length) {
        const payload = {
          date,
          currency: cashCurrency,
          defaultInsuranceProviderId: "no-insurance" as const,
          notes: notes || undefined,
          rows: validDeptRows.map((r) => ({
            departmentId: r.departmentId!,
            amount: r.amountNum,
            description: r.description || undefined,
            insuranceProviderId: "no-insurance" as const, // explicit
          })),
        };
        const res = await apiRequest("POST", "/api/transactions/bulk-income", payload);
        created.dept = res?.count || res?.created || 0;
      }

      // Post 2: insurance totals by provider (currency = providerCurrency)
      if (validProviderRows.length) {
        const payload = {
          date,
          currency: providerCurrency,
          defaultInsuranceProviderId: null as const,
          notes: notes || undefined,
          rows: validProviderRows.map((r) => ({
            insuranceProviderId: r.insuranceProviderId!,
            amount: r.amountNum,
            description: r.description || "Insurance daily total",
          })),
        };
        const res = await apiRequest("POST", "/api/transactions/bulk-income", payload);
        created.provider = res?.count || res?.created || 0;
      }

      if (!validDeptRows.length && !validProviderRows.length) {
        throw new Error("Please enter at least one positive amount.");
      }

      return created;
    },
    onSuccess: (res) => {
      toast({
        title: "Saved",
        description: `Added ${res.dept} cash row(s) and ${res.provider} insurance row(s).`,
      });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      // reset for next use
      setDeptRows([emptyDeptRow(), emptyDeptRow(), emptyDeptRow(), emptyDeptRow(), emptyDeptRow()]);
      setProviderRows([emptyProviderRow()]);
      setNotes("");
      guardRef.current = false;
    },
    onError: (e: any) => {
      toast({
        title: "Could not save",
        description: e?.message || "Something went wrong while saving.",
        variant: "destructive",
      });
      guardRef.current = false;
    },
  });

  const onSubmit = async () => {
    if (isPending || guardRef.current) return; // hard guard against rapid clicks
    guardRef.current = true;
    await mutateAsync();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) guardRef.current = false;
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-3xl relative">
        {/* Saving overlay */}
        <div
          className={`absolute inset-0 z-10 ${isPending ? "flex" : "hidden"} items-center justify-center bg-white/60 backdrop-blur-[1px]`}
          aria-hidden={!isPending}
        >
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </div>
        </div>

        <DialogHeader>
          <DialogTitle>Daily Bulk Income</DialogTitle>
        </DialogHeader>

        <fieldset disabled={isPending} aria-busy={isPending} className="space-y-4">
          {/* Top controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block">Transaction Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div>
              <Label className="mb-1 block">Currency (cash by department)</Label>
              <Select value={cashCurrency} onValueChange={(v: "SSP" | "USD") => setCashCurrency(v)}>
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
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., ‘Daily totals’"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={prefFillDepartments}>
              Prefill 5 Departments
            </Button>
            <Button type="button" variant="outline" onClick={prefFillProviders}>
              Prefill Insurances
            </Button>

            <div className="ml-auto w-44">
              <Label className="mb-1 block">Provider currency</Label>
              <Select
                value={providerCurrency}
                onValueChange={(v: "SSP" | "USD") => setProviderCurrency(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="USD" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="SSP">SSP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cash by department */}
          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">
              Cash by Department
            </div>

            <div className="grid grid-cols-12 gap-2 px-3 pt-2 text-xs text-slate-500">
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
                      onValueChange={(v) => setDept(idx, { departmentId: v })}
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

                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      className="text-right"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => setDept(idx, { amount: e.target.value })}
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeptRows((rows) => rows.filter((_, i) => i !== idx))
                      }
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeptRows((r) => [...r, emptyDeptRow()])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add row
              </Button>
            </div>
          </div>

          {/* Insurance totals by provider */}
          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 rounded-t-lg">
              Insurance Totals (by provider)
            </div>

            <div className="grid grid-cols-12 gap-2 px-3 pt-2 text-xs text-slate-500">
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
                      onValueChange={(v) => setProv(idx, { insuranceProviderId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
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

                  <div className="col-span-4">
                    <Input
                      inputMode="numeric"
                      className="text-right"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => setProv(idx, { amount: e.target.value })}
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setProviderRows((rows) => rows.filter((_, i) => i !== idx))
                      }
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setProviderRows((r) => [...r, emptyProviderRow()])}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add row
              </Button>
            </div>
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Daily Income"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
