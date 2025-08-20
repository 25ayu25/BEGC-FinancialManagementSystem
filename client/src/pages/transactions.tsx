// client/src/pages/transactions-supabase.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import {
  supabaseDepartments,
  supabaseInsurance,
  supabaseTransactions,
  NewTransaction,
} from "@/lib/supabaseQueries";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().min(0.01, "Amount is required"),
  currency: z.enum(["SSP", "USD"]).default("SSP"),
  description: z.string().min(1, "Description is required"),
  department_id: z.string().optional().nullable(),
  insurance_provider_id: z.string().optional().nullable(),
  patient_name: z.string().optional().nullable(),
  receipt_number: z.string().optional().nullable(),
  payment_method: z
    .enum(["cash", "card", "check", "insurance", "bank_transfer"])
    .default("cash"),
});

type FormData = z.infer<typeof schema>;

export default function TransactionsSupabase() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const qc = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "income",
      amount: 0,
      currency: "SSP",
      description: "",
      department_id: undefined,
      insurance_provider_id: undefined,
      patient_name: "",
      receipt_number: "",
      payment_method: "cash",
    },
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["supabase-transactions"],
    queryFn: () => supabaseTransactions.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ["supabase-departments"],
    queryFn: () => supabaseDepartments.getAll(),
  });

  const { data: insurance } = useQuery({
    queryKey: ["supabase-insurance"],
    queryFn: () => supabaseInsurance.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload: NewTransaction = {
        ...values,
        created_by: user?.id ?? null,
      };
      return supabaseTransactions.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supabase-transactions"] });
      toast({
        title: "Success",
        description: "Transaction added successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message || "Failed to add transaction.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormData }) =>
      supabaseTransactions.update(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supabase-transactions"] });
      toast({
        title: "Success",
        description: "Transaction updated successfully.",
      });
      setIsDialogOpen(false);
      setEditing(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message || "Failed to update transaction.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supabaseTransactions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supabase-transactions"] });
      toast({ title: "Deleted", description: "Transaction deleted." });
    },
    onError: (e: any) => {
      toast({
        title: "Error",
        description: e.message || "Failed to delete.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormData) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const openEdit = (tx: any) => {
    setEditing(tx);
    form.reset({
      type: tx.type,
      amount: Number(tx.amount) || 0,
      currency: (tx.currency as "SSP" | "USD") ?? "SSP",
      description: tx.description ?? "",
      department_id: tx.department_id ?? undefined,
      insurance_provider_id: tx.insurance_provider_id ?? undefined,
      patient_name: tx.patient_name ?? "",
      receipt_number: tx.receipt_number ?? "",
      payment_method: (tx.payment_method as any) ?? "cash",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Transaction Management"
        description="Add and manage financial transactions"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditing(null);
                    form.reset();
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Edit Transaction" : "Add New Transaction"}
                  </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      name="type"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        name="amount"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        name="currency"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="SSP">SSP</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      name="description"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Transaction description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        name="department_id"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value ?? undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(departments ?? []).map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        name="insurance_provider_id"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Insurance Provider</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value ?? undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="(Optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(insurance ?? []).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        name="patient_name"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patient Name (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="receipt_number"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt # (optional)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        disabled={
                          createMutation.isPending || updateMutation.isPending
                        }
                      >
                        {editing ? "Save Changes" : "Save Transaction"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditing(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-gray-500">Loading…</div>
              ) : !(transactions as any)?.length ? (
                <div className="py-8 text-center text-gray-500">
                  No transactions yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Description
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                          Department
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(transactions as any).map((t: any) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{t.description}</td>
                          <td className="px-4 py-3">
                            {t.departments?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={
                                t.type === "income"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {t.type === "income" ? "+" : "-"} {t.currency}{" "}
                              {Number(t.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mr-2"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(t.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
