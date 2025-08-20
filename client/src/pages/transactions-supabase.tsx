// client/src/pages/transactions-supabase.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Receipt,
  DollarSign,
  CreditCard,
} from "lucide-react";
import Header from "@/components/layout/header";
import {
  supabaseTransactions,
  supabaseDepartments,
  supabaseInsurance,
} from "@/lib/supabaseQueries";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

// --- helpers to sanitize payloads ---
const toNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "")
    ? null
    : (v as string);

const toNumOrNull = (v: unknown) => {
  if (
    v === undefined ||
    v === null ||
    (typeof v === "string" && v.trim() === "")
  )
    return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  // strings from <input type="number"> need sanitizing, we'll convert to numbers before insert
  amount_ssp: z.string().min(1, "Amount is required"),
  amount_usd: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  department_id: z.string().optional(),
  insurance_provider_id: z.string().optional(),
  patient_name: z.string().optional(),
  receipt_number: z.string().optional(),
  payment_method: z.enum([
    "cash",
    "card",
    "check",
    "insurance",
    "bank_transfer",
  ]),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function TransactionsSupabase() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useSupabaseAuth();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "income",
      amount_ssp: "",
      amount_usd: "",
      description: "",
      department_id: "",
      insurance_provider_id: "",
      patient_name: "",
      receipt_number: "",
      payment_method: "cash",
    },
  });

  // Queries
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["supabase-transactions"],
    queryFn: () => supabaseTransactions.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ["supabase-departments"],
    queryFn: () => supabaseDepartments.getAll(),
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["supabase-insurance"],
    queryFn: () => supabaseInsurance.getAll(),
  });

  // Sanitize the form data for Postgres (no empty strings in numeric/nullable fields)
  const buildPayload = (data: TransactionFormData) => ({
    type: data.type,
    amount_ssp: toNumOrNull(data.amount_ssp), // numeric or null
    amount_usd: toNumOrNull(data.amount_usd), // numeric or null
    description: data.description,
    department_id: toNull(data.department_id), // uuid or null
    insurance_provider_id: toNull(data.insurance_provider_id),
    patient_name: toNull(data.patient_name),
    receipt_number: toNull(data.receipt_number),
    payment_method: data.payment_method,
    created_by: user?.id ?? null,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      supabaseTransactions.create(buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-dashboard"] });
      toast({
        title: "Success",
        description: "Transaction added successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add transaction.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionFormData }) =>
      supabaseTransactions.update(id, buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-dashboard"] });
      toast({
        title: "Success",
        description: "Transaction updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingTransaction(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update transaction.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseTransactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["supabase-dashboard"] });
      toast({
        title: "Success",
        description: "Transaction deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete transaction.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    form.reset({
      type: transaction.type,
      amount_ssp: transaction.amount_ssp ?? "",
      amount_usd: transaction.amount_usd ?? "",
      description: transaction.description ?? "",
      department_id: transaction.department_id ?? "",
      insurance_provider_id: transaction.insurance_provider_id ?? "",
      patient_name: transaction.patient_name ?? "",
      receipt_number: transaction.receipt_number ?? "",
      payment_method: transaction.payment_method ?? "cash",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (
    amount: string | number | null,
    currency: "SSP" | "USD",
  ) => {
    if (amount === null || amount === undefined || amount === "")
      return `${currency} 0.00`;
    const num = typeof amount === "number" ? amount : parseFloat(amount);
    return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Transaction Management"
        description="Add and manage income and expense transactions"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Add Transaction Button */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
              <p className="text-gray-600">
                Manage your clinic's financial transactions
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingTransaction(null);
                    form.reset();
                  }}
                  data-testid="button-add-transaction"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction
                      ? "Edit Transaction"
                      : "Add New Transaction"}
                  </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    {/* Transaction Type */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-transaction-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="income">Income</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Amount Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount_ssp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (SSP)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-amount-ssp"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount_usd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-amount-usd"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Transaction description"
                              data-testid="input-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Department */}
                    <FormField
                      control={form.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-department">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments?.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Additional Fields Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="patient_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patient Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Patient name (optional)"
                                data-testid="input-patient-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="receipt_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Receipt number (optional)"
                                data-testid="input-receipt-number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Payment Method */}
                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-payment-method">
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="check">Check</SelectItem>
                              <SelectItem value="insurance">
                                Insurance
                              </SelectItem>
                              <SelectItem value="bank_transfer">
                                Bank Transfer
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          createMutation.isPending || updateMutation.isPending
                        }
                        data-testid="button-save-transaction"
                      >
                        {createMutation.isPending || updateMutation.isPending
                          ? "Saving..."
                          : "Save Transaction"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions?.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`p-2 rounded-lg ${transaction.type === "income" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}
                        >
                          {transaction.type === "income" ? (
                            <DollarSign className="w-4 h-4" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {transaction.description}
                          </p>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>
                              {new Date(
                                transaction.created_at,
                              ).toLocaleDateString()}
                            </span>
                            {transaction.departments && (
                              <Badge variant="secondary">
                                {transaction.departments.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p
                            className={`font-semibold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(transaction.amount_ssp, "SSP")}
                          </p>
                          {transaction.amount_usd && (
                            <p className="text-sm text-gray-500">
                              {formatCurrency(transaction.amount_usd, "USD")}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                            data-testid={`button-edit-${transaction.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(transaction.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-${transaction.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!transactions?.length && (
                    <div className="text-center py-8 text-gray-500">
                      <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found</p>
                      <p className="text-sm">
                        Add your first transaction to get started
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
