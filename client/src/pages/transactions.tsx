import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import AddTransactionModal from "@/components/transactions/add-transaction-modal";
import TransactionFilters from "@/components/transactions/transaction-filters";
import BulkIncomeModal from "@/components/transactions/bulk-income-modal";
import BulkExpenseModal from "@/components/transactions/bulk-expense-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, api } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Transactions() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkIncome, setShowBulkIncome] = useState(false);
  const [showBulkExpense, setShowBulkExpense] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [appliedFilters, setAppliedFilters] = useState<any>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      return await apiRequest("DELETE", `/api/transactions/${transactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Transaction deleted successfully" });
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transaction",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = () => {
    if (transactionToDelete) deleteTransactionMutation.mutate(transactionToDelete);
  };
  const handleEditClick = (transaction: any) => {
    setTransactionToEdit(transaction);
    setShowEditModal(true);
  };

  const queryParams = new URLSearchParams({
    page: String(currentPage),
    limit: String(pageSize),
    ...Object.fromEntries(Object.entries(appliedFilters).filter(([, v]) => v !== undefined && v !== "")),
  });

  const { data: transactionData, isLoading } = useQuery({
    queryKey: ["/api/transactions", queryParams.toString()],
    queryFn: async () => (await api.get(`/api/transactions?${queryParams}`)).data,
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });
  const { data: insuranceProviders } = useQuery({ queryKey: ["/api/insurance-providers"] });

  const getDepartmentName = (departmentId: string) =>
    (departments as any)?.find((d: any) => d.id === departmentId)?.name || "Unknown";

  const groupTransactionsByMonth = (transactions: any[]) => {
    const groups: Record<string, any[]> = {};
    transactions.forEach((t) => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      groups[key] ||= [];
      groups[key].push({ ...t, monthLabel: label });
    });
    return Object.entries(groups)
      .map(([monthKey, txs]) => {
        const totals = txs.reduce(
          (acc: any, t: any) => {
            const amt = Number(t.amount) || 0;
            const signed = t.type === "income" ? amt : -amt;
            (t.currency === "USD" ? (acc.usd += signed) : (acc.ssp += signed));
            return acc;
          },
          { ssp: 0, usd: 0 }
        );
        return { monthKey, monthLabel: txs[0].monthLabel, transactions: txs, totals, transactionCount: txs.length };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  const toggleMonth = (key: string) =>
    setExpandedMonths((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const transactions = transactionData?.transactions || [];
  const total = transactionData?.total || 0;
  const totalPages = transactionData?.totalPages || 1;

  const groupedTransactions = groupTransactionsByMonth(transactions);

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header
        title="Transaction Management"
        subtitle="Add and manage daily income and expense transactions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkExpense(true)}>Bulk Expenses</Button>
            <Button variant="outline" onClick={() => setShowBulkIncome(true)}>Daily Bulk Income</Button>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-transaction">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <TransactionFilters
            onFilterChange={(filters) => {
              setAppliedFilters(filters);
              setCurrentPage(1);
            }}
            onExport={() => {}}
            transactions={transactions}
            departments={departments as any[]}
            insuranceProviders={insuranceProviders as any[]}
          />

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading transactions...</div>
              ) : !transactions?.length ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No transactions found. Add your first transaction to get started.</p>
                  <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add First Transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedTransactions.map((m) => (
                    <Collapsible
                      key={m.monthKey}
                      open={expandedMonths.has(m.monthKey)}
                      onOpenChange={() => toggleMonth(m.monthKey)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer">
                          <div className="flex items-center gap-2">
                            {expandedMonths.has(m.monthKey) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                            )}
                            <h3 className="text-lg font-semibold text-gray-900">{m.monthLabel}</h3>
                          </div>
                          <div className="text-right space-y-1">
                            {m.totals.ssp !== 0 && (
                              <div className={`text-sm font-semibold ${m.totals.ssp >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {m.totals.ssp >= 0 ? "+" : ""}SSP {m.totals.ssp.toLocaleString()}
                              </div>
                            )}
                            {m.totals.usd !== 0 && (
                              <div className={`text-sm font-semibold ${m.totals.usd >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {m.totals.usd >= 0 ? "+" : ""}USD {m.totals.usd.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="mt-2">
                        <div className="bg-white border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Date</th>
                                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Description</th>
                                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Department</th>
                                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Amount</th>
                                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Status</th>
                                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {m.transactions.map((t: any) => (
                                  <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm text-gray-900">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {t.insuranceProviderName
                                        ? `${t.insuranceProviderName} ${t.description || "Income"}`
                                        : t.description || (t.type === "income" ? "Income" : "Expense")}
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant={t.type === "income" ? "default" : "destructive"}>
                                        {t.type === "income"
                                          ? (t.departmentId ? getDepartmentName(t.departmentId) : "Income")
                                          : (t.expenseCategory || "Expense")}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right font-medium">
                                      <span className={t.type === "income" ? "text-green-600" : "text-red-600"}>
                                        {t.type === "income" ? "+" : "-"}
                                        {t.currency} {Math.round(Number(t.amount)).toLocaleString()}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <Badge variant={t.syncStatus === "synced" ? "default" : "secondary"}>{t.syncStatus}</Badge>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600" onClick={() => handleEditClick(t)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteClick(t.id)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total.toLocaleString()} transactions
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <div className="text-sm text-gray-500">Page {currentPage} of {totalPages}</div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Single-entry Add/Edit */}
      <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} />
      <AddTransactionModal open={showEditModal} onOpenChange={setShowEditModal} editTransaction={transactionToEdit} />

      {/* Bulk modals */}
      <BulkIncomeModal
        open={showBulkIncome}
        onOpenChange={setShowBulkIncome}
        departments={(departments as any[]) || []}
        insuranceProviders={(insuranceProviders as any[]) || []}
      />
      <BulkExpenseModal open={showBulkExpense} onOpenChange={setShowBulkExpense} />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50"
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
