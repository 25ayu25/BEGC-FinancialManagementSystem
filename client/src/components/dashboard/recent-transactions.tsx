import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
