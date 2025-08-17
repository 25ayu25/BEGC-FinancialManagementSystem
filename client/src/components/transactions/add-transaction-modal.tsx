import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Save, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "income" | "expense";
}

export default function AddTransactionModal({ 
  open, 
  onOpenChange, 
  defaultType = "income" 
}: AddTransactionModalProps) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [departmentId, setDepartmentId] = useState("");
  const [insuranceProviderId, setInsuranceProviderId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [receiptPath, setReceiptPath] = useState("");

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

  const resetForm = () => {
    setType("income");
    setDepartmentId("");
    setInsuranceProviderId("");
    setAmount("");
    setCurrency("USD");
    setDescription("");
    setReceiptPath("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
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

    createTransactionMutation.mutate({
      type,
      departmentId: departmentId || null,
      insuranceProviderId: insuranceProviderId || null,
      amount: parseFloat(amount).toFixed(2),
      currency,
      description,
      receiptPath: receiptPath || null,
      date: new Date().toISOString(),
    });
  };

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/receipts/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: any) => {
    if (result.successful?.[0]?.uploadURL) {
      setReceiptPath(result.successful[0].uploadURL);
      toast({
        title: "Receipt Uploaded",
        description: "Receipt uploaded successfully",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto" data-testid="modal-add-transaction">
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
        </DialogHeader>
        
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
                  "flex items-center justify-center p-3",
                  type === "income" 
                    ? "bg-success text-white hover:bg-green-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => setType("income")}
                data-testid="button-type-income"
              >
                <Plus className="h-4 w-4 mr-2" />
                Income
              </Button>
              <Button
                type="button"
                variant={type === "expense" ? "destructive" : "outline"}
                className={cn(
                  "flex items-center justify-center p-3",
                  type === "expense" 
                    ? "bg-destructive text-white hover:bg-red-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => setType("expense")}
                data-testid="button-type-expense"
              >
                <Minus className="h-4 w-4 mr-2" />
                Expense
              </Button>
            </div>
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
                    <div className="flex items-center justify-between w-full">
                      <span>{dept.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({dept.code})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  <SelectItem value="none">
                    <span className="text-gray-500">No Insurance</span>
                  </SelectItem>
                  {(insuranceProviders as any)?.map((provider: any) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{provider.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({provider.code})</span>
                      </div>
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
                placeholder="0.00"
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
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="SSP">South Sudanese Pound (SSP)</SelectItem>
                </SelectContent>
              </Select>
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
              placeholder="Enter transaction description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="textarea-description"
              required
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Receipt/Voucher
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={5242880}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Camera className="h-5 w-5 mr-2" />
                {receiptPath ? "Change Receipt" : "Upload Receipt"}
              </ObjectUploader>
              {receiptPath && (
                <p className="text-sm text-green-600 mt-2">Receipt uploaded successfully</p>
              )}
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
            </div>
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
              <Save className="h-4 w-4 mr-2" />
              {createTransactionMutation.isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
