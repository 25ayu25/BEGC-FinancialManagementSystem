import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, Edit, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface Transaction {
  id: string;
  description: string;
  type: string;
  amount: string;
  currency: string;
  date: string;
  syncStatus: string;
  departmentId?: string;
}

interface RecentTransactionsProps {
  transactions?: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
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
  if (!transactions?.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Recent Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No recent transactions found</p>
            <p className="text-slate-400 text-sm mt-1">
              Transactions will appear here once you start adding them.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDepartmentBadgeColor = (type: string) => {
    switch (type) {
      case 'income': return 'default';
      case 'expense': return 'destructive';
      default: return 'secondary';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <Check className="w-3 h-3 mr-1" />;
      case 'pending': return <Clock className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Recent Transactions
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Date
                </th>
                <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Description
                </th>
                <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Type
                </th>
                <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Amount
                </th>
                <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Status
                </th>
                <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-4 px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100" data-testid="table-recent-transactions">
              {transactions.slice(0, 5).map((transaction) => (
                <tr 
                  key={transaction.id} 
                  className="hover:bg-slate-50 transition-all duration-200"
                  data-testid={`row-recent-transaction-${transaction.id}`}
                >
                  <td className="py-4 px-6 text-sm font-medium text-slate-700">
                    {new Date(transaction.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-700 font-medium">
                    {transaction.description}
                  </td>
                  <td className="py-4 px-6">
                    <Badge variant={getDepartmentBadgeColor(transaction.type)} className="font-medium">
                      {transaction.type}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-sm text-right font-bold">
                    <span className={transaction.type === 'income' ? 'text-emerald-600' : 'text-red-500'}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(parseFloat(transaction.amount), transaction.currency)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Badge 
                      variant={getSyncStatusColor(transaction.syncStatus)}
                      className="inline-flex items-center font-medium"
                    >
                      {getSyncStatusIcon(transaction.syncStatus)}
                      {transaction.syncStatus}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        data-testid={`button-edit-${transaction.id}`}
                      >
                        <Edit className="h-4 w-4" />
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
      </CardContent>

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
    </Card>
  );
}
