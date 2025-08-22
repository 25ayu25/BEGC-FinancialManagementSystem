import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

interface Transaction {
  id: string;
  description: string;
  type: string;
  amount: string;
  currency: string;
  date: string;
  syncStatus: string;
}

interface SimpleRecentTransactionsProps {
  transactions?: Transaction[];
}

export default function SimpleRecentTransactions({ transactions }: SimpleRecentTransactionsProps) {
  if (!transactions?.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Recent Transactions
            </CardTitle>
            <Link href="/transactions">
              <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs">
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No recent transactions</p>
            <p className="text-slate-400 text-sm mt-1">Add your first transaction to see activity here</p>
            <Link href="/transactions/add" className="mt-3">
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                Add Transaction
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Recent Transactions
          </CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs">
              View all
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {transactions.slice(0, 7).map((transaction) => (
            <div 
              key={transaction.id}
              className="min-h-[44px] flex items-center justify-between py-3 px-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant={transaction.type === 'income' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {transaction.type}
                  </Badge>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {new Date(transaction.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 truncate">
                  {transaction.description}
                </p>
              </div>
              <div className="text-right ml-4">
                <p className={`text-sm font-bold tabular-nums text-right ${
                  transaction.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {transaction.type === 'income' ? '' : '-'}
                  {formatCurrency(parseFloat(transaction.amount), transaction.currency)}
                </p>
                <Badge 
                  variant={transaction.syncStatus === 'synced' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {transaction.syncStatus}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}