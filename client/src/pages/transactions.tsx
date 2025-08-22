import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import AddTransactionModal from "@/components/transactions/add-transaction-modal";
import TransactionFilters from "@/components/transactions/transaction-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Filter, Download, Edit, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
  const [appliedFilters, setAppliedFilters] = useState<any>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // Default page size
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
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
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
    if (transactionToDelete) {
      deleteTransactionMutation.mutate(transactionToDelete);
    }
  };

  const handleEditClick = (transaction: any) => {
    setTransactionToEdit(transaction);
    setShowEditModal(true);
  };

  // Build query parameters for server-side filtering and pagination
  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    ...Object.fromEntries(
      Object.entries(appliedFilters).filter(([_, value]) => value !== undefined && value !== '')
    )
  });

  const { data: transactionData, isLoading } = useQuery({
    queryKey: ["/api/transactions", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/transactions?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
  });

  const getDepartmentName = (departmentId: string) => {
    return (departments as any)?.find((d: any) => d.id === departmentId)?.name || 'Unknown';
  };

  // Group transactions by month
  const groupTransactionsByMonth = (transactions: any[]) => {
    const groups: { [key: string]: any[] } = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push({ ...transaction, monthLabel });
    });

    // Convert to array and sort by month (newest first)
    return Object.entries(groups)
      .map(([monthKey, transactions]) => {
        // Calculate totals separately by currency
        const totals = transactions.reduce((acc, t) => {
          const amount = parseFloat(t.amount) || 0;
          const adjustedAmount = t.type === 'income' ? amount : -amount;
          
          if (t.currency === 'USD') {
            acc.usd += adjustedAmount;
          } else {
            acc.ssp += adjustedAmount;
          }
          return acc;
        }, { ssp: 0, usd: 0 });

        return {
          monthKey,
          monthLabel: transactions[0].monthLabel,
          transactions,
          totals,
          transactionCount: transactions.length
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Extract data from paginated response
  const transactions = transactionData?.transactions || [];
  const total = transactionData?.total || 0;
  const totalPages = transactionData?.totalPages || 1;
  const hasMore = transactionData?.hasMore || false;

  // Group transactions by month
  const groupedTransactions = groupTransactionsByMonth(transactions);

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header 
        title="Transaction Management" 
        subtitle="Add and manage daily income and expense transactions"
        actions={
          <Button onClick={() => setShowAddModal(true)} data-testid="button-add-transaction">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <TransactionFilters 
            onFilterChange={(filters) => {
              console.log('Filters:', filters);
              setAppliedFilters(filters);
              setCurrentPage(1); // Reset to first page when filters change
            }}
            onExport={() => console.log('Export requested')}
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
              <div className="text-center py-8">
                <p className="text-gray-500">Loading transactions...</p>
              </div>
            ) : !transactions?.length ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No transactions found. Add your first transaction to get started.</p>
                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Transaction
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map((monthGroup) => (
                  <Collapsible
                    key={monthGroup.monthKey}
                    open={expandedMonths.has(monthGroup.monthKey)}
                    onOpenChange={() => toggleMonth(monthGroup.monthKey)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {expandedMonths.has(monthGroup.monthKey) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <h3 className="text-lg font-semibold text-gray-900">
                              {monthGroup.monthLabel}
                            </h3>
                          </div>
                          <Badge variant="secondary">
                            {monthGroup.transactionCount} transaction{monthGroup.transactionCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="text-right space-y-1">
                          {monthGroup.totals.ssp !== 0 && (
                            <div className={`text-sm font-semibold ${monthGroup.totals.ssp >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {monthGroup.totals.ssp >= 0 ? '+' : ''}SSP {monthGroup.totals.ssp.toLocaleString()}
                            </div>
                          )}
                          {monthGroup.totals.usd !== 0 && (
                            <div className={`text-sm font-semibold ${monthGroup.totals.usd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {monthGroup.totals.usd >= 0 ? '+' : ''}USD {monthGroup.totals.usd.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="space-y-2 mt-2">
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Date
                                </th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Description
                                </th>
                                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Department
                                </th>
                                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Amount
                                </th>
                                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Status
                                </th>
                                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {monthGroup.transactions.map((transaction: any) => (
                                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors" data-testid={`row-transaction-${transaction.id}`}>
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    {new Date(transaction.date).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    {transaction.insuranceProviderName 
                                      ? `${transaction.insuranceProviderName} ${transaction.description || 'Income'}`
                                      : (transaction.description || (transaction.type === 'income' ? 'Income' : 'Expense'))
                                    }
                                  </td>
                                  <td className="py-3 px-4">
                                    <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                                      {transaction.type === 'income' 
                                        ? (transaction.departmentId ? getDepartmentName(transaction.departmentId) : 'Income')
                                        : (transaction.expenseCategory || 'Expense')
                                      }
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-right font-medium">
                                    <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                      {transaction.type === 'income' ? '+' : '-'}{transaction.currency} {Math.round(parseFloat(transaction.amount)).toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <Badge variant={transaction.syncStatus === 'synced' ? 'default' : 'secondary'}>
                                      {transaction.syncStatus}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                        onClick={() => handleEditClick(transaction)}
                                        data-testid={`button-edit-${transaction.id}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                        onClick={() => handleDeleteClick(transaction.id)}
                                        data-testid={`button-delete-${transaction.id}`}
                                      >
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total.toLocaleString()} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
        </div>
      </main>

      <AddTransactionModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />

      <AddTransactionModal 
        open={showEditModal} 
        onOpenChange={setShowEditModal}
        editTransaction={transactionToEdit}
      />

      {/* Delete confirmation dialog */}
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
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 !text-white font-medium border-0"
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
