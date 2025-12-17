"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
// Import Loader2 and AlertCircle for the saving spinner and warning banner
import { Loader2, X, AlertCircle } from "lucide-react";

/**
 * Bulk Income (client-side bulk save)
 * - Cash by department (SSP/USD selectable at top; default SSP)
 * - Insurance totals by provider (defaults to USD; can change)
 * - Prefill 6 departments and common providers
 * - Saves by calling POST /api/transactions per row (same as AddTransaction)
 */

type Dept = { id: string; name: string; code?: string };
type Provider = { id: string; name: string; code?: string };

type DeptRow = { departmentId?: string; amount: string };
type ProviderRow = { insuranceProviderId?: string; amount: string };

export default function BulkIncomeModal({
  open,
  onOpenChange,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string; // YYYY-MM-DD
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ++ ADDITION: State to track saving process
  const [isSaving, setIsSaving] = useState(false);
  
  // ++ ADDITION: State for checking date and blocking duplicates
  const [checkingDate, setCheckingDate] = useState(false);
  const [dateHasData, setDateHasData] = useState(false);
  const [existingDataInfo, setExistingDataInfo] = useState<any>(null);

  // Fetch choices once (same as AddTransaction)
  const { data: departments = [] as Dept[] } = useQuery({ queryKey: ["/api/departments"] });
  const { data: insuranceProviders = [] as Provider[] } = useQuery({ queryKey: ["/api/insurance-providers"] });

  const [date, setDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [cashCurrency, setCashCurrency] = useState<"SSP" | "USD">("SSP");
  const [providerCurrency, setProviderCurrency] = useState<"SSP" | "USD">("USD");
  const [notes, setNotes] = useState("");

  const [deptRows, setDeptRows] = useState<DeptRow[]>([
    { departmentId: undefined, amount: "" },
  ]);
  const [provRows, setProvRows] = useState<ProviderRow[]>([
    { insuranceProviderId: undefined, amount: "" },
  ]);
  const [justPrefilledDepts, setJustPrefilledDepts] = useState(false);
  const [justPrefilledProvs, setJustPrefilledProvs] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // ++ ADDITION: Function to check if date has existing data
  const checkDateForExistingData = async (dateStr: string) => {
    setCheckingDate(true);
    try {
      const response = await apiRequest("GET", `/api/transactions/daily-check?date=${dateStr}`);
      setDateHasData(response.hasTransactions);
      setExistingDataInfo(response);
    } catch (error) {
      console.error("Error checking date:", error);
    } finally {
      setCheckingDate(false);
    }
  };

  // ++ ADDITION: Check date whenever it changes
  useEffect(() => {
    if (date) {
      checkDateForExistingData(date);
    }
  }, [date]);

  const addDeptRow = () => setDeptRows((r) => [...r, { departmentId: undefined, amount: "" }]);
  const addProvRow = () => setProvRows((r) => [...r, { insuranceProviderId: undefined, amount: "" }]);

  const rmDeptRow = (i: number) => setDeptRows((r) => r.filter((_, idx) => idx !== i));
  const rmProvRow = (i: number) => setProvRows((r) => r.filter((_, idx) => idx !== i));

  const patchDept = (i: number, patch: Partial<DeptRow>) =>
    setDeptRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const patchProv = (i: number, patch: Partial<ProviderRow>) =>
    setProvRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  // Helpers to find IDs by common names/codes
  const findDeptId = (needle: string) =>
    departments.find((d) =>
      [d.name, d.code].filter(Boolean).some((s) => String(s).toLowerCase().includes(needle.toLowerCase()))
    )?.id;

  const findProvId = (needle: string) =>
    insuranceProviders.find((p) =>
      [p.name, p.code].filter(Boolean).some((s) => String(s).toLowerCase().includes(needle.toLowerCase()))
    )?.id;

  const prefillDepartments = () => {
    const list = [
      findDeptId("consultation"),
      findDeptId("laboratory"),
      findDeptId("ultrasound"),
      findDeptId("x-ray"),
      findDeptId("pharmacy"),
      findDeptId("station road"),  // Will match "Pharmacy - Station Road"
    ].filter(Boolean) as string[];
    if (!list.length) {
      toast({ title: "No departments found to prefill", variant: "destructive" });
      return;
    }
    setDeptRows(list.map((id) => ({ departmentId: id, amount: "" })));
    setJustPrefilledDepts(true);
    setTimeout(() => setJustPrefilledDepts(false), 600);
    
    toast({
      title: "✓ 6 departments prefilled",
      description: "Enter amounts for each department.",
    });
  };

  const prefillProviders = () => {
    const wanted = ["CIC", "UAP", "CIGNA", "Nile", "New Sudan"];
    const list = wanted
      .map(findProvId)
      .filter(Boolean) as string[];
    if (!list.length) {
      toast({ title: "No providers found to prefill", variant: "destructive" });
      return;
    }
    setProvRows(list.map((id) => ({ insuranceProviderId: id, amount: "" })));
    setProviderCurrency("USD");
    setJustPrefilledProvs(true);
    setTimeout(() => setJustPrefilledProvs(false), 600);
    
    toast({
      title: "✓ Insurance providers prefilled",
      description: "Enter amounts for each provider.",
    });
  };

  const clearAllDeptRows = () => {
    setDeptRows([{ departmentId: undefined, amount: "" }]);
    toast({
      title: "Department rows cleared",
      description: "All department entries have been removed.",
    });
  };

  const clearAllProvRows = () => {
    setProvRows([{ insuranceProviderId: undefined, amount: "" }]);
    toast({
      title: "Insurance rows cleared",
      description: "All insurance entries have been removed.",
    });
  };

  // Parse amounts like "80,000"
  const toNumber = (v: string) => {
    const n = Number((v || "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };

  const validDeptPayloads = useMemo(() => {
    return deptRows
      .map((r) => ({
        departmentId: r.departmentId,
        amount: toNumber(r.amount),
      }))
      .filter((r) => r.departmentId && r.amount > 0);
  }, [deptRows]);

  const validProvPayloads = useMemo(() => {
    return provRows
      .map((r) => ({
        insuranceProviderId: r.insuranceProviderId,
        amount: toNumber(r.amount),
      }))
      .filter((r) => r.insuranceProviderId && r.amount > 0);
  }, [provRows]);

  // Calculate running totals
  const totalSSP = useMemo(() => {
    return validDeptPayloads.reduce((sum, r) => sum + r.amount, 0);
  }, [validDeptPayloads]);

  const totalUSD = useMemo(() => {
    if (providerCurrency === 'USD') {
      return validProvPayloads.reduce((sum, r) => sum + r.amount, 0);
    }
    return 0;
  }, [validProvPayloads, providerCurrency]);

  const totalProvSSP = useMemo(() => {
    if (providerCurrency === 'SSP') {
      return validProvPayloads.reduce((sum, r) => sum + r.amount, 0);
    }
    return 0;
  }, [validProvPayloads, providerCurrency]);

  const savingDisabled = validDeptPayloads.length === 0 && validProvPayloads.length === 0;

  const saveAll = async () => {
    // ++ MODIFICATION: Block if date has existing data
    if (dateHasData) {
      toast({ 
        title: "Cannot Save", 
        description: "Transactions already exist for this date. Delete them first.", 
        variant: "destructive" 
      });
      return;
    }
    
    // ++ MODIFICATION: Add guards for both disabled state and saving state
    if (savingDisabled || isSaving) {
      if (!savingDisabled) toast({ title: "Already saving...", variant: "destructive" });
      else toast({ title: "Nothing to save", description: "Enter at least one positive amount.", variant: "destructive" });
      return;
    }

    // ++ MODIFICATION: Use try/finally to ensure isSaving is reset
    try {
      setIsSaving(true); // Lock the UI

      const when = new Date(date).toISOString();
      const reqs: Promise<any>[] = [];

      // Cash by department → income rows (no provider)
      for (const r of validDeptPayloads) {
        reqs.push(
          apiRequest("POST", "/api/transactions", {
            type: "income",
            date: when,
            departmentId: r.departmentId,
            insuranceProviderId: null, // cash
            amount: String(r.amount),
            currency: cashCurrency,
            description: notes || "Daily income",
            receiptPath: null,
            expenseCategory: null,
            staffType: null,
          })
        );
      }

      // Insurance totals → income rows with provider (no department)
      for (const r of validProvPayloads) {
        reqs.push(
          apiRequest("POST", "/api/transactions", {
            type: "income",
            date: when,
            departmentId: null,
            insuranceProviderId: r.insuranceProviderId,
            amount: String(r.amount),
            currency: providerCurrency, // usually USD
            description: notes || "Insurance daily total",
            receiptPath: null,
            expenseCategory: null,
            staffType: null,
          })
        );
      }

      const results = await Promise.allSettled(reqs);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      
      // ++ ADDITION: Check for 409 conflict errors
      const conflictError = results.find((r) => 
        r.status === "rejected" && r.reason?.message?.includes("409")
      );
      
      if (conflictError) {
        toast({
          title: "Duplicate Transaction Blocked",
          description: "Transactions already exist for this date. Delete them first.",
          variant: "destructive"
        });
        return;
      }

      if (ok) {
        const totalTransactions = validDeptPayloads.length + validProvPayloads.length;
        const totalSSPAmount = validDeptPayloads.reduce((sum, r) => sum + r.amount, 0) + 
                               (providerCurrency === 'SSP' ? validProvPayloads.reduce((sum, r) => sum + r.amount, 0) : 0);
        const totalUSDAmount = providerCurrency === 'USD' ? validProvPayloads.reduce((sum, r) => sum + r.amount, 0) : 0;
        
        let description = `${totalTransactions} transaction${totalTransactions > 1 ? 's' : ''} added`;
        if (totalSSPAmount > 0 && totalUSDAmount > 0) {
          description += `: SSP ${totalSSPAmount.toLocaleString()} and USD ${totalUSDAmount.toLocaleString()}`;
        } else if (totalSSPAmount > 0) {
          description += `: SSP ${totalSSPAmount.toLocaleString()}`;
        } else if (totalUSDAmount > 0) {
          description += `: USD ${totalUSDAmount.toLocaleString()}`;
        }
        
        toast({ 
          title: "✓ Transactions saved successfully", 
          description 
        });
        qc.invalidateQueries({ queryKey: ["/api/transactions"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard"] });
      }
      if (fail) {
        toast({
          title: "Some rows failed",
          description: `${fail} didn’t save. Please review amounts/choices and try again.`,
          variant: "destructive",
        });
      }

      if (ok && !fail) {
        // reset & close for next entry
        setDeptRows([{ departmentId: undefined, amount: "" }]);
        setProvRows([{ insuranceProviderId: undefined, amount: "" }]);
        setNotes("");
        onOpenChange(false);
      }
    } catch (error) {
        console.error("An unexpected error occurred during saveAll:", error);
        toast({ title: "An error occurred", description: "Could not save transactions.", variant: "destructive" });
    } finally {
      setIsSaving(false); // Unlock the UI
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      {/* overlay (no extra opacity classes applied to the card) */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-0 flex items-start justify-center p-6">
        {/* ++ MODIFICATION: Add `relative` positioning for the overlay */}
        <div className="relative w-full max-w-3xl rounded-xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 max-h-[90vh] overflow-auto">
          {/* ++ ADDITION: Saving overlay */}
          {isSaving && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 text-slate-700">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Saving Transactions...</span>
              </div>
            </div>
          )}

          {/* header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Daily Bulk Income</h2>
            <button onClick={() => onOpenChange(false)} className="px-2 py-1 rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ++ MODIFICATION: Wrap form body and footer in a fieldset to disable all controls during save */}
          <fieldset disabled={isSaving}>
            {/* body */}
            <div className="p-4 space-y-6">
              {/* top controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1 block">Transaction Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1 block">Currency (cash by department)</Label>
                  <Select value={cashCurrency} onValueChange={(v: "SSP" | "USD") => setCashCurrency(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

              {/* ++ ADDITION: Blocking warning banner */}
              {dateHasData && existingDataInfo && (
                <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 text-base mb-1">
                        ⛔ Cannot Enter Transactions for This Date
                      </h3>
                      <p className="text-red-800 text-sm mb-2">
                        {existingDataInfo.count} transaction{existingDataInfo.count !== 1 ? 's' : ''} already exist for {format(new Date(date), "MMMM d, yyyy")}.
                      </p>
                      <p className="text-red-700 text-sm font-medium">
                        You must delete the existing transactions before entering new data for this date.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" onClick={prefillDepartments}>Prefill 6 Departments</Button>
                <Button type="button" variant="outline" onClick={clearAllDeptRows}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Dept Rows
                </Button>
                <Button type="button" variant="outline" onClick={prefillProviders}>Prefill Insurances</Button>
                <Button type="button" variant="outline" onClick={clearAllProvRows}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Ins Rows
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-xs text-slate-600">Provider currency</Label>
                  <Select value={providerCurrency} onValueChange={(v: "SSP" | "USD") => setProviderCurrency(v)}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="SSP">SSP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CASH BY DEPARTMENT */}
              <div className="border rounded-lg">
                <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-t-lg">Cash by Department</div>
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-slate-600 border-b">
                  <div className="col-span-7">Department</div>
                  <div className="col-span-4 text-right">Amount</div>
                  <div className="col-span-1" />
                </div>
                <div className="divide-y">
                  {deptRows.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-12 gap-2 px-3 py-3 ${justPrefilledDepts ? 'animate-flash-green' : ''}`}>
                      <div className="col-span-7">
                        <Select value={row.departmentId ?? undefined} onValueChange={(v) => patchDept(idx, { departmentId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Input 
                          inputMode="numeric" 
                          className="text-right" 
                          placeholder="0"
                          value={row.amount} 
                          onChange={(e) => patchDept(idx, { amount: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (idx === deptRows.length - 1) {
                                // Last field in dept section, focus first provider input
                                const firstProvInput = document.querySelector('[data-provider-input="0"]') as HTMLInputElement;
                                if (firstProvInput) firstProvInput.focus();
                              } else {
                                // Focus next dept input
                                const nextInput = document.querySelector(`[data-dept-input="${idx + 1}"]`) as HTMLInputElement;
                                if (nextInput) nextInput.focus();
                              }
                            }
                          }}
                          data-dept-input={idx}
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => rmDeptRow(idx)} className="hover:bg-red-50 hover:text-red-600">🗑️</Button>
                      </div>
                    </div>
                  ))}
                </div>
                {cashCurrency === 'SSP' && totalSSP > 0 && (
                  <div className="px-3 py-2 bg-green-50 border-t font-semibold text-green-900">
                    Total SSP: {totalSSP.toLocaleString()}
                  </div>
                )}
                {cashCurrency === 'USD' && validDeptPayloads.length > 0 && (
                  <div className="px-3 py-2 bg-green-50 border-t font-semibold text-green-900">
                    Total USD: {validDeptPayloads.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                  </div>
                )}
                <div className="p-3">
                  <Button type="button" variant="outline" onClick={addDeptRow}>＋ Add row</Button>
                </div>
              </div>

              {/* INSURANCE TOTALS */}
              <div className="border rounded-lg">
                <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-t-lg">Insurance Totals (by provider)</div>
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-slate-600 border-b">
                  <div className="col-span-7">Insurance Provider</div>
                  <div className="col-span-4 text-right">Amount</div>
                  <div className="col-span-1" />
                </div>
                <div className="divide-y">
                  {provRows.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-12 gap-2 px-3 py-3 ${justPrefilledProvs ? 'animate-flash-green' : ''}`}>
                      <div className="col-span-7">
                        <Select value={row.insuranceProviderId ?? undefined} onValueChange={(v) => patchProv(idx, { insuranceProviderId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            {insuranceProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Input 
                          inputMode="numeric" 
                          className="text-right" 
                          placeholder="0"
                          value={row.amount} 
                          onChange={(e) => patchProv(idx, { amount: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (idx === provRows.length - 1) {
                                // Last field, trigger save
                                if (!savingDisabled && !isSaving && !dateHasData) {
                                  saveAll();
                                }
                              } else {
                                // Focus next provider input
                                const nextInput = document.querySelector(`[data-provider-input="${idx + 1}"]`) as HTMLInputElement;
                                if (nextInput) nextInput.focus();
                              }
                            }
                          }}
                          data-provider-input={idx}
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => rmProvRow(idx)} className="hover:bg-red-50 hover:text-red-600">🗑️</Button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalUSD > 0 && (
                  <div className="px-3 py-2 bg-green-50 border-t font-semibold text-green-900">
                    Total USD: {totalUSD.toLocaleString()}
                  </div>
                )}
                {totalProvSSP > 0 && (
                  <div className="px-3 py-2 bg-green-50 border-t font-semibold text-green-900">
                    Total SSP: {totalProvSSP.toLocaleString()}
                  </div>
                )}
                <div className="p-3">
                  <Button type="button" variant="outline" onClick={addProvRow}>＋ Add row</Button>
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t">
              <span className="text-xs text-gray-500">💡 Tip: Press Enter to move to next field or save</span>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                {/* ++ MODIFICATION: Update save button to show loading state and disable if date has data */}
                <Button onClick={saveAll} disabled={savingDisabled || isSaving || dateHasData || checkingDate}>
                  {checkingDate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {checkingDate ? "Checking date..." : isSaving ? "Saving..." : "Save Daily Income"}
                </Button>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
