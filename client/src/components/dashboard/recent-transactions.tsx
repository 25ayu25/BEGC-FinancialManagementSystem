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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Recent Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No recent transactions found</p>
            <p className="text-sm text-gray-400 mt-2">
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Recent Transactions
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
                  Type
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
            <tbody className="divide-y divide-gray-100" data-testid="table-recent-transactions">
              {transactions.slice(0, 5).map((transaction) => (
                <tr 
                  key={transaction.id} 
                  className="hover:bg-gray-50 transition-colors"
                  data-testid={`row-recent-transaction-${transaction.id}`}
                >
                  <td className="py-4 px-6 text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="py-4 px-6">
                    <Badge variant={getDepartmentBadgeColor(transaction.type)}>
                      {transaction.type}
                    </Badge>
                  </td>
                  <td className="py-4 px-6 text-sm text-right font-medium">
                    <span className={transaction.type === 'income' ? 'text-success' : 'text-destructive'}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(parseFloat(transaction.amount), transaction.currency)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Badge 
                      variant={getSyncStatusColor(transaction.syncStatus)}
                      className="inline-flex items-center"
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
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
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
