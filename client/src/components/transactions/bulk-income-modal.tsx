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
import { Plus, Trash2, ListRestart } from "lucide-react";

type Dept = { id: string; name: string };
type Provider = { id: string; name: string };

type Row = {
  departmentId?: string;                        // optional (provider-only rows OK)
  amount: string;                               // text for UX; we coerce to number
  insuranceProviderId?: string;                 // provider id or "no-insurance"
  description?: string;
};

function makeEmptyRow(): Row {
  return {
    departmentId: undefined,
    amount: "",
    insuranceProviderId: "no-insurance",
    description: "",
  };
}

const CORE_DEPT_MATCHES = ["Consultation", "Laborator", "Ultrasound", "X-Ray", "Pharm"];
const CORE_PROVIDERS_MATCHES = ["CIC", "CIGNA", "UAP", "Nile", "New Sudan"];

function pickCore<T extends { name: string }>(all: T[], needles: string[]) {
  const lower = needles.map((n) => n.toLowerCase());
  // keep order of needles if found, then fill remaining
  const picked: T[] = [];
  lower.forEach((n) => {
    const hit = all.find((x) => x.name.toLowerCase().includes(n));
    if (hit && !picked.includes(hit)) picked.push(hit);
  });
  return picked;
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
  date?: string;                         // YYYY-MM-DD
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

  // IMPORTANT: keep values exactly "SSP" or "USD" (schema is strict)
  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
  ]);

  // when modal opens the first time, prefill the 5 core departments
  useEffect(() => {
    if (!open) return;
    // if all rows are empty, pre-seed
    const allEmpty = rows.every((r) => !r.departmentId && !r.amount);
    if (allEmpty && departments.length) {
      const core = pickCore(departments, CORE_DEPT_MATCHES).slice(0, 5);
      if (core.length) {
        setCurrency("SSP");
        setRows(
          core.map((d) => ({
            departmentId: d.id,
            amount: "",
            insuranceProviderId: "no-insurance",
            description: "",
          }))
        );
      }
    }
  }, [open, departments]); // eslint-disable-line react-hooks/exhaustive-deps

  // helpers
  const addRow = () => setRows((r) => [...r, makeEmptyRow()]);
  const removeRow = (idx: number) =>
    setRows((r) => r.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  // Quick actions
  const prefillDepartments = () => {
    const core = pickCore(departments, CORE_DEPT_MATCHES).slice(0, 5);
    setCurrency("SSP");
    setRows(
      (core.length ? core : departments.slice(0, 5)).map((d) => ({
        departmentId: d.id,
        amount: "",
        insuranceProviderId: "no-insurance",
        description: "",
      }))
    );
  };
  const prefillProviders = () => {
    const core = pickCore(insuranceProviders, CORE_PROVIDERS_MATCHES).slice(0, 5);
    setCurrency("USD");
    setRows(
      (core.length ? core : insuranceProviders.slice(0, 5)).map((p) => ({
        departmentId: undefined,                 // provider-only income row
        amount: "",
        insuranceProviderId: p.id,
        description: "",
      }))
    );
  };
  const applyProviderToAll = (providerId: string) => {
    setRows((r) =>
      r.map((row) => ({ ...row, insuranceProviderId: providerId }))
    );
  };

  const validRows = useMemo(
    () =>
      rows
        .map((r) => ({
          ...r,
          amountNum: Number(String(r.amount).replace(/,/g, "")),
        }))
        .filter((r) => isFinite(r.amountNum) && r.amountNum > 0),
    [rows]
  );

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        currency,
        notes: notes || undefined,
        rows: validRows.map((r) => ({
          departmentId: r.departmentId || undefined,
          amount: Number(String(r.amount).replace(/,/g, "")),
          description: r.description || notes || undefined,
          insuranceProviderId:
            r.insuranceProviderId && r.insuranceProviderId !== ""
              ? r.insuranceProviderId
              : "no-insurance",
        })),
      };

      if (payload.rows.length === 0) {
        throw new Error(
          "Please fill at least one line with a positive amount."
        );
      }
      return apiRequest("POST", "/api/transactions/bulk-income", payload);
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "Daily income saved for the selected rows.",
      });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
      // reset for next entry (keep the date)
      setRows([makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
      setNotes("");
    },
    onError: (e: any) => {
      // show server validation details if provided
      const detail =
        e?.response?.data?.details ||
        e?.response?.data?.error ||
        e?.message ||
        "Validation error.";
      toast({
        title: "Could not save",
        description: String(detail),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* keep overlay light so content behind is visible */}
      <DialogContent className="max-w-4xl sm:max-w-5xl backdrop:bg-black/20">
        <DialogHeader>
          <DialogTitle>Daily Bulk Income</DialogTitle>
        </DialogHeader>

        {/* Top controls */}
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

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 -mt-1 mb-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prefillDepartments}
            title="Prefill the 5 core departments (SSP)"
          >
            <ListRestart className="h-4 w-4 mr-1" />
            Prefill 5 departments
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={prefillProviders}
            title="Prefill the 5 common insurance providers (USD)"
          >
            <ListRestart className="h-4 w-4 mr-1" />
            Prefill providers (USD)
          </Button>

          <Select
            onValueChange={(v) => applyProviderToAll(v)}
          >
            <SelectTrigger className="h-8 w-[210px]">
              <SelectValue placeholder="Set provider for ALL rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-insurance">No insurance / Cash</SelectItem>
              {insuranceProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grid header */}
        <div className="border rounded-lg">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600">
            <div className="col-span-5">Department</div>
            <div className="col-span-3 text-right">Amount</div>
            <div className="col-span-3">Insurance Provider</div>
            <div className="col-span-1" />
          </div>

          {/* Rows */}
          <div className="divide-y">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-3">
                {/* Department (optional for provider-only rows) */}
                <div className="col-span-5">
                  <Select
                    value={row.departmentId ?? undefined}
                    onValueChange={(v) => patchRow(idx, { departmentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department (or leave blank for provider-only)" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
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
                    onValueChange={(v) =>
                      patchRow(idx, { insuranceProviderId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Insurance provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-insurance">
                        No insurance / Cash
                      </SelectItem>
                      {insuranceProviders.map((p) => (
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutateAsync()} disabled={isPending}>
            {isPending ? "Saving…" : "Save Daily Income"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
