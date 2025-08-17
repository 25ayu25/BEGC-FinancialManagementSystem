import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import AddTransactionModal from "@/components/transactions/add-transaction-modal";
import TransactionFilters from "@/components/transactions/transaction-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Download, Edit, Trash2 } from "lucide-react";
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

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const getDepartmentName = (departmentId: string) => {
    return (departments as any)?.find((d: any) => d.id === departmentId)?.name || 'Unknown';
  };

  return (
    <div className="flex-1 overflow-auto">
      <Header 
        title="Transaction Management" 
        subtitle="Add and manage daily income and expense transactions"
        actions={
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-transaction">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        }
      />

      <main className="p-6">
        <div className="space-y-6">
          <TransactionFilters 
            onFilterChange={(filters) => console.log('Filters:', filters)}
            onExport={() => console.log('Export requested')}
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
            ) : !(transactions as any)?.length ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No transactions found. Add your first transaction to get started.</p>
                <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Transaction
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Date
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Description
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Department
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Amount
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Status
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(transactions as any)?.map((transaction: any) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors" data-testid={`row-transaction-${transaction.id}`}>
                        <td className="py-4 px-6 text-sm text-gray-900">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-900">
                          {transaction.description}
                        </td>
                        <td className="py-4 px-6">
                          <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                            {transaction.departmentId ? getDepartmentName(transaction.departmentId) : transaction.type}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-sm text-right font-medium">
                          <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.type === 'income' ? '+' : '-'}SSP {parseFloat(transaction.amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <Badge variant={transaction.syncStatus === 'synced' ? 'default' : 'secondary'}>
                            {transaction.syncStatus}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-center">
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
            )}
          </CardContent>
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
              className="bg-red-600 hover:bg-red-700"
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
