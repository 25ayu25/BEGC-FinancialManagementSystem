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

// ✅ Use the SAME list as the single-entry form
// Adjust the import path if your constants are elsewhere
import { EXPENSE_CATEGORIES } from "@/lib/constants";

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

type Row = { expenseCategory?: ExpenseCategory; amount: string; description?: string };

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
  const [justPrefilled, setJustPrefilled] = useState(false);

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

  // Calculate running total
  const totalSSP = useMemo(() => {
    if (currency === 'SSP') {
      return validPayloads.reduce((sum, r) => sum + r.amountNum, 0);
    }
    return 0;
  }, [validPayloads, currency]);

  const totalUSD = useMemo(() => {
    if (currency === 'USD') {
      return validPayloads.reduce((sum, r) => sum + r.amountNum, 0);
    }
    return 0;
  }, [validPayloads, currency]);

  // Optional convenience: include Fuel here if you want it to prefill as well
  const prefillCommon = () => {
    const preferred: ExpenseCategory[] = [
      "Clinic Operations",
      "Doctor Payments",
      "Lab Tech Payments",
      "Radiographer Payments",
      "Fuel", // 👈 newly added
    ].filter((c) => (EXPENSE_CATEGORIES as readonly string[]).includes(c));
    setRows(preferred.map((name) => ({ expenseCategory: name, amount: "" })));
    setJustPrefilled(true);
    setTimeout(() => setJustPrefilled(false), 600);
    
    toast({
      title: "✓ Expense categories prefilled",
      description: "Enter amounts for each category.",
    });
  };

  const clearAllRows = () => {
    setRows([{ expenseCategory: undefined, amount: "" }]);
    toast({
      title: "Expense rows cleared",
      description: "All expense entries have been removed.",
    });
  };

  const saveAll = async () => {
    if (validPayloads.length === 0) {
      toast({
        title: "Nothing to save",
        description: "Enter at least one positive amount.",
        variant: "destructive",
      });
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
        // keep this logic as-is
        staffType: r.expenseCategory?.includes("Payments") ? undefined : null,
        receiptPath: null,
      })
    );

    const results = await Promise.allSettled(reqs);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;

    if (ok) {
      const totalAmount = validPayloads.reduce((sum, r) => sum + r.amountNum, 0);
      toast({ 
        title: "✓ Expenses saved successfully", 
        description: `${ok} expense${ok > 1 ? "s" : ""} totaling ${currency} ${totalAmount.toLocaleString()} have been added.` 
      });
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
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bulk Expenses</h2>
              <p className="text-sm text-gray-600 mt-1">Record multiple expenses for the day</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Row 1: Date and Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Transaction Date</Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="h-11 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Currency</Label>
                <Select value={currency} onValueChange={(v: "SSP" | "USD") => setCurrency(v)}>
                  <SelectTrigger className="h-11 focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSP">SSP (South Sudanese Pound)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                type="button" 
                variant="outline" 
                onClick={prefillCommon}
                className="h-10 px-4 font-medium border-gray-300 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-all"
              >
                Prefill Expenses
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={clearAllRows}
                className="h-10 px-4 font-medium text-gray-700 border-gray-300 hover:border-red-400 hover:text-red-700 hover:bg-red-50 transition-all"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Expense Rows
              </Button>
            </div>

            <div className="border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
                <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wide">
                  Expense Categories
                </h3>
              </div>
              <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50 border-b">
                <div className="col-span-7">Expense Category</div>
                <div className="col-span-4 text-right">Amount</div>
                <div className="col-span-1" />
              </div>

              <div className="divide-y">
                {rows.map((row, idx) => (
                  <div key={idx} className={`grid grid-cols-12 gap-3 px-4 py-3 ${justPrefilled ? 'animate-flash-green' : ''}`}>
                    <div className="col-span-7">
                      <Select
                        value={row.expenseCategory ?? undefined}
                        onValueChange={(v: ExpenseCategory) => patch(idx, { expenseCategory: v })}
                      >
                        <SelectTrigger className="h-11 focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
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

                    <div className="col-span-4">
                      <Input
                        inputMode="numeric"
                        className="h-11 text-right font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => patch(idx, { amount: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Using querySelector for focus management between dynamically generated fields
                            // This is pragmatic given the dynamic nature of the row list
                            if (idx === rows.length - 1) {
                              // Last field, trigger save
                              if (validPayloads.length > 0 && !isSaving) {
                                saveAll();
                              }
                            } else {
                              // Focus next input
                              const nextInput = document.querySelector(`[data-expense-input="${idx + 1}"]`) as HTMLInputElement;
                              if (nextInput) nextInput.focus();
                            }
                          }
                        }}
                        data-expense-input={idx}
                      />
                    </div>

                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => rmRow(idx)}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalSSP > 0 && (
                <div className="px-4 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-t-2 border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Total SSP
                    </span>
                    <span className="text-2xl font-bold text-red-700">
                      {totalSSP.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {totalUSD > 0 && (
                <div className="px-4 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-t-2 border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Total USD
                    </span>
                    <span className="text-2xl font-bold text-red-700">
                      {totalUSD.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addRow}
                  className="h-10 px-4 font-medium border-gray-300 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-all"
                >
                  ＋ Add row
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-6 border-t">
            <span className="text-xs text-gray-500">💡 Tip: Press Enter to move to next field or save</span>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="h-11 px-6 font-medium border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveAll} 
                disabled={validPayloads.length === 0 || isSaving}
                className="h-11 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm hover:shadow-md transition-all"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Expenses'
                )}
              </Button>
            </div>
          </div>

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
