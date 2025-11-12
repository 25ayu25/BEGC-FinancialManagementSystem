import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, STAFF_TYPES } from "@/lib/constants";

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense";
  editTransaction?: any;
}

export default function AddTransactionModal({
  open,
  onOpenChange,
  defaultType = "income",
  editTransaction,
}: AddTransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [departmentId, setDepartmentId] = useState("");
  const [insuranceProviderId, setInsuranceProviderId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"SSP" | "USD">("SSP");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expenseCategory, setExpenseCategory] = useState("");
  const [staffType, setStaffType] = useState("");
  
  // ++ ADDITION: State for checking duplicates
  const [checkingDate, setCheckingDate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
    staleTime: 5 * 60 * 1000,
  });

  const resetForm = () => {
    setType(defaultType);
    setDepartmentId("");
    setInsuranceProviderId("");
    setAmount("");
    setCurrency("SSP");
    setDescription("");
    setSelectedDate(new Date());
    setExpenseCategory("");
    setStaffType("");
    setDuplicateWarning(null);
  };

  // ++ ADDITION: Function to check for duplicates
  const checkForDuplicates = async (date: Date, dept: string, provider: string, txType: string) => {
    // Only check for income transactions
    if (txType !== "income" || editTransaction) {
      setDuplicateWarning(null);
      return;
    }
    
    if (!dept && !provider) {
      setDuplicateWarning(null);
      return;
    }

    setCheckingDate(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const response = await apiRequest("GET", `/api/transactions/daily-check?date=${dateStr}`);
      
      if (response.hasTransactions) {
        // Check if there's a duplicate for this specific department or provider
        const hasDeptDuplicate = dept && response.departments.includes(dept);
        const hasProviderDuplicate = provider && provider !== "no-insurance" && response.insuranceProviders.includes(provider);
        
        if (hasDeptDuplicate) {
          setDuplicateWarning("A transaction already exists for this date and department.");
        } else if (hasProviderDuplicate) {
          setDuplicateWarning("A transaction already exists for this date and insurance provider.");
        } else {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      setDuplicateWarning(null);
    } finally {
      setCheckingDate(false);
    }
  };

  // Populate when editing
  useEffect(() => {
    if (editTransaction && open) {
      setType(editTransaction.type);
      setDepartmentId(editTransaction.departmentId || "");
      setInsuranceProviderId(editTransaction.insuranceProviderId || "");
      setAmount(String(editTransaction.amount ?? ""));
      setCurrency((editTransaction.currency as "SSP" | "USD") || "SSP");
      setDescription(editTransaction.description || "");
      setSelectedDate(editTransaction.date ? new Date(editTransaction.date) : new Date());
      setExpenseCategory(editTransaction.expenseCategory || "");
      setStaffType(editTransaction.staffType || "");
    } else if (open && !editTransaction) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction, open, defaultType]);

  // Auto-switch currency for insurance income
  useEffect(() => {
    if (insuranceProviderId && insuranceProviderId !== "no-insurance") {
      setCurrency("USD");
    } else {
      setCurrency("SSP");
    }
  }, [insuranceProviderId]);

  // ++ ADDITION: Check for duplicates when date, department, provider, or type changes
  useEffect(() => {
    if (open && selectedDate) {
      checkForDuplicates(selectedDate, departmentId, insuranceProviderId, type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, departmentId, insuranceProviderId, type, open]);

  // —— Mutations ——
  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Transaction created successfully" });
      onOpenChange(false);
      resetForm();
      submitGuard.current = false;
    },
    onError: (error: any) => {
      const isDuplicate = error?.message?.includes("409");
      toast({
        title: isDuplicate ? "Duplicate Transaction Blocked" : "Error",
        description: isDuplicate 
          ? "Transaction already exists for this date and department/provider. Delete the existing transaction first."
          : error?.message || "Failed to create transaction",
        variant: "destructive",
      });
      submitGuard.current = false;
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest("PUT", `/api/transactions/${editTransaction?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Transaction updated successfully" });
      onOpenChange(false);
      resetForm();
      submitGuard.current = false;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update transaction",
        variant: "destructive",
      });
      submitGuard.current = false;
    },
  });

  const isSaving = createTransactionMutation.isPending || updateTransactionMutation.isPending;
  const submitGuard = useRef(false);

  // —— Submit ——
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || submitGuard.current) return;
    submitGuard.current = true;

    if (!amount) {
      toast({ title: "Validation Error", description: "Please enter an amount", variant: "destructive" });
      submitGuard.current = false;
      return;
    }

    // For income, require department if no insurance provider
    const hasValidInsurance =
      insuranceProviderId && insuranceProviderId !== "" && insuranceProviderId !== "no-insurance";
    if (type === "income" && !departmentId && !hasValidInsurance) {
      toast({
        title: "Validation Error",
        description: "Please select a department for income transactions",
        variant: "destructive",
      });
      submitGuard.current = false;
      return;
    }

    // IMPORTANT: send YYYY-MM-DD to avoid timezone shifting (Sep 30/Oct 1 issue)
    const dateYMD = format(selectedDate, "yyyy-MM-dd");

    const transactionData = {
      type,
      departmentId: departmentId || null,
      insuranceProviderId: insuranceProviderId || null,
      amount: parseFloat(amount).toString(),
      currency,
      description,
      receiptPath: null,
      date: dateYMD, // <-- fixed
      expenseCategory: type === "expense" ? expenseCategory || null : null,
      staffType:
        type === "expense" && expenseCategory && expenseCategory.includes("Payments")
          ? staffType || null
          : null,
    };

    if (editTransaction) {
      updateTransactionMutation.mutate(transactionData);
    } else {
      createTransactionMutation.mutate(transactionData);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" data-testid="modal-add-transaction">
      {/* Light overlay (NOT too dark) */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={() => (!isSaving ? onOpenChange(false) : null)} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-start justify-center p-6">
        <div className="relative w-full max-w-2xl rounded-xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 max-h-[90vh] overflow-auto">
          {/* Saving overlay */}
          {isSaving && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {editTransaction ? "Edit Transaction" : "Add New Transaction"}
            </h2>
            <button
              onClick={() => (!isSaving ? onOpenChange(false) : null)}
              className="px-2 py-1 rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSaving}>
              <fieldset disabled={isSaving} className="space-y-6">
                {/* Transaction Type */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Transaction Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={type === "income" ? "default" : "outline"}
                      className={cn(
                        "flex items-center justify-center p-3 font-medium",
                        type === "income"
                          ? "bg-teal-600 text-white hover:bg-teal-700"
                          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                      )}
                      onClick={() => setType("income")}
                      data-testid="button-type-income"
                    >
                      <span className="text-lg mr-2">+</span>
                      Income
                    </Button>
                    <Button
                      type="button"
                      variant={type === "expense" ? "destructive" : "outline"}
                      className={cn(
                        "flex items-center justify-center p-3 font-medium",
                        type === "expense"
                          ? "bg-teal-600 text-white hover:bg-teal-700"
                          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                      )}
                      onClick={() => setType("expense")}
                      data-testid="button-type-expense"
                    >
                      <span className="text-lg mr-2">-</span>
                      Expense
                    </Button>
                  </div>
                </div>

                {/* Transaction Date */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Transaction Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-11" data-testid="button-select-date">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[9999] bg-white border shadow-lg" align="start">
                      <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* ++ ADDITION: Duplicate warning banner */}
                {duplicateWarning && (
                  <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-yellow-800 text-sm font-medium">
                          {duplicateWarning}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Department / Category (label only) */}
                <div>
                  <Label htmlFor="department" className="text-sm font-medium text-gray-700">
                    {type === "income" ? "Department" : "Category"}
                  </Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger data-testid="select-department" className="h-11">
                      <SelectValue placeholder={`Select ${type === "income" ? "Department" : "Category"}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(departments as any)?.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expense Category */}
                {type === "expense" && (
                  <div>
                    <Label htmlFor="expense-category" className="text-sm font-medium text-gray-700">
                      Expense Category
                    </Label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger data-testid="select-expense-category" className="h-11">
                        <SelectValue placeholder="Select Expense Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Staff Type (when needed) */}
                {type === "expense" && expenseCategory && expenseCategory.includes("Payments") && (
                  <div>
                    <Label htmlFor="staff-type" className="text-sm font-medium text-gray-700">
                      Staff Type
                    </Label>
                    <Select value={staffType} onValueChange={setStaffType}>
                      <SelectTrigger data-testid="select-staff-type" className="h-11">
                        <SelectValue placeholder="Select Staff Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Insurance Provider (income only) */}
                {type === "income" && (
                  <div>
                    <Label htmlFor="insurance" className="text-sm font-medium text-gray-700">
                      Insurance Provider (Optional)
                    </Label>
                    <Select value={insuranceProviderId} onValueChange={setInsuranceProviderId}>
                      <SelectTrigger data-testid="select-insurance" className="h-11">
                        <SelectValue placeholder="Select Insurance Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {(insuranceProviders as any)
                          ?.sort((a: any, b: any) => {
                            const priority = ["CIC", "UAP", "CIGNA"];
                            const ai = priority.indexOf(a.code);
                            const bi = priority.indexOf(b.code);
                            if (ai !== -1 && bi !== -1) return ai - bi;
                            if (ai !== -1) return -1;
                            if (bi !== -1) return 1;
                            return a.name.localeCompare(b.name);
                          })
                          .map((provider: any) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Amount & Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                      Amount
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      data-testid="input-amount"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency" className="text-sm font-medium text-gray-700">
                      Currency
                    </Label>
                    <Select value={currency} onValueChange={(v: "SSP" | "USD") => setCurrency(v)}>
                      <SelectTrigger data-testid="select-currency" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSP">
                          <span className="font-medium">SSP</span>
                          <span className="text-gray-500 ml-2">(South Sudanese Pound)</span>
                        </SelectItem>
                        <SelectItem value="USD">
                          <span className="font-medium">USD</span>
                          <span className="text-gray-500 ml-2">($)</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                    {type === "income" &&
                    Array.isArray(departments) &&
                    (departments as any).find((d: any) => d.id === departmentId)?.code === "OTHER"
                      ? "Description"
                      : "Notes (Optional)"}
                  </Label>
                  <Textarea
                    id="description"
                    rows={3}
                    placeholder={
                      type === "income" &&
                      Array.isArray(departments) &&
                      (departments as any).find((d: any) => d.id === departmentId)?.code === "OTHER"
                        ? "e.g., Minor surgery, dressing change, supplies, procedures, etc."
                        : "Enter daily consultation total or expense details (optional)..."
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="textarea-description"
                  />
                </div>
              </fieldset>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel" disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || !!duplicateWarning || checkingDate} data-testid="button-save-transaction">
                  {checkingDate ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <span className="mr-2">💾</span> Save Transaction
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
