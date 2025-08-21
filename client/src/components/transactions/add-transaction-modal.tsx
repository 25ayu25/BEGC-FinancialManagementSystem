import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";
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
  editTransaction 
}: AddTransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [departmentId, setDepartmentId] = useState("");
  const [insuranceProviderId, setInsuranceProviderId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SSP");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expenseCategory, setExpenseCategory] = useState("");
  const [staffType, setStaffType] = useState("");


  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Success",
        description: "Transaction created successfully",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction",
        variant: "destructive",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/transactions/${editTransaction.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update transaction",
        variant: "destructive",
      });
    },
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
  };

  // Populate form when editing
  useEffect(() => {
    if (editTransaction && open) {
      setType(editTransaction.type);
      setDepartmentId(editTransaction.departmentId || "");
      setInsuranceProviderId(editTransaction.insuranceProviderId || "");
      setAmount(editTransaction.amount);
      setCurrency(editTransaction.currency || "SSP");
      setDescription(editTransaction.description || "");
      setSelectedDate(editTransaction.date ? new Date(editTransaction.date) : new Date());
    } else if (open && !editTransaction) {
      resetForm();
    }
  }, [editTransaction, open, defaultType]);

  // Auto-switch currency when insurance provider is selected
  useEffect(() => {
    if (insuranceProviderId && insuranceProviderId !== "no-insurance") {
      setCurrency("USD");
    } else {
      setCurrency("SSP");
    }
  }, [insuranceProviderId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      toast({
        title: "Validation Error",
        description: "Please enter an amount",
        variant: "destructive",
      });
      return;
    }

    if (type === "income" && !departmentId) {
      toast({
        title: "Validation Error",
        description: "Please select a department for income transactions",
        variant: "destructive",
      });
      return;
    }

    const transactionData = {
      type,
      departmentId: departmentId || null,
      insuranceProviderId: insuranceProviderId || null,
      amount: parseFloat(amount).toString(),
      currency,
      description,
      receiptPath: null,
      date: selectedDate.toISOString(),
      expenseCategory: type === "expense" ? (expenseCategory || null) : null,
      staffType: type === "expense" && expenseCategory && expenseCategory.includes("Payments") ? (staffType || null) : null,
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
      {/* Separate overlay with alpha background - NO opacity class */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal card positioned separately */}
      <div className="absolute inset-0 flex items-start justify-center p-6">
        <div className="w-full max-w-2xl rounded-xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 max-h-[90vh] overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {editTransaction ? "Edit Transaction" : "Add New Transaction"}
            </h2>
            <button 
              onClick={() => onOpenChange(false)} 
              className="px-2 py-1 rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Transaction Type
            </Label>
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
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Transaction Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-11"
                  data-testid="button-select-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[9999] bg-white border shadow-lg" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Department/Category */}
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
                    <span className="font-medium">{dept.name}</span>
                    <span className="text-xs text-teal-600 ml-2">({dept.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expense Category (only for expenses) */}
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

          {/* Staff Type (only for staff payment expenses) */}
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
                  {STAFF_TYPES.map((typeOption) => (
                    <SelectItem key={typeOption} value={typeOption}>
                      {typeOption.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Insurance Provider (for income only) */}
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
                  <SelectItem value="no-insurance">
                    <span className="text-gray-500 italic">No Insurance</span>
                  </SelectItem>
                  {(insuranceProviders as any)?.map((provider: any) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <span className="font-medium">{provider.name}</span>
                      <span className="text-xs text-teal-600 ml-2">({provider.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount and Currency */}
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
              <Select value={currency} onValueChange={setCurrency}>
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
              Notes (Optional)
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Enter daily consultation total or expense details (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="textarea-description"
            />
          </div>



          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createTransactionMutation.isPending}
              data-testid="button-save-transaction"
            >
              <span className="mr-2">💾</span>
              {createTransactionMutation.isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
