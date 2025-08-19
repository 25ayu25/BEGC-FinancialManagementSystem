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
          {/* Type */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Type
            </Label>
            <Select value={type} onValueChange={(value: "income" | "expense") => setType(value)}>
              <SelectTrigger className="w-full h-12" data-testid="select-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>





          {/* Amount Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount-ssp" className="text-sm font-medium text-gray-700">
                Amount (SSP)
              </Label>
              <Input
                id="amount-ssp"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={currency === "SSP" ? amount : ""}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCurrency("SSP");
                }}
                data-testid="input-amount-ssp"
              />
            </div>
            <div>
              <Label htmlFor="amount-usd" className="text-sm font-medium text-gray-700">
                Amount (USD)
              </Label>
              <Input
                id="amount-usd"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={currency === "USD" ? amount : ""}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setCurrency("USD");
                }}
                data-testid="input-amount-usd"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Transaction description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="textarea-description"
            />
          </div>

          {/* Department */}
          <div>
            <Label htmlFor="department" className="text-sm font-medium text-gray-700">
              Department
            </Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger data-testid="select-department" className="h-12">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {(departments as any)?.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Patient Name and Receipt Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="patient-name" className="text-sm font-medium text-gray-700">
                Patient Name
              </Label>
              <Input
                id="patient-name"
                type="text"
                placeholder="Patient name (optional)"
                data-testid="input-patient-name"
              />
            </div>
            <div>
              <Label htmlFor="receipt-number" className="text-sm font-medium text-gray-700">
                Receipt Number
              </Label>
              <Input
                id="receipt-number"
                type="text"
                placeholder="Receipt number (optional)"
                data-testid="input-receipt-number"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="payment-method" className="text-sm font-medium text-gray-700">
              Payment Method
            </Label>
            <Select defaultValue="cash">
              <SelectTrigger data-testid="select-payment-method" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile-money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
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
