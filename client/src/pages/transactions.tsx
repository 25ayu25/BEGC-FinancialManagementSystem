import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import AddTransactionModal from "@/components/transactions/add-transaction-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Download } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export default function Transactions() {
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const getDepartmentName = (departmentId: string) => {
    return departments?.find(d => d.id === departmentId)?.name || 'Unknown';
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions?.map((transaction) => (
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
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(transaction.amount), transaction.currency)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <Badge variant={transaction.syncStatus === 'synced' ? 'default' : 'secondary'}>
                            {transaction.syncStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AddTransactionModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
    </div>
  );
}
