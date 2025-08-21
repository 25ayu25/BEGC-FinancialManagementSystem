import { Card, CardContent } from "@/components/ui/card";

interface SimpleMonthlyFooterProps {
  data?: {
    totalIncome: string;
    totalIncomeSSP?: string;
    totalExpenses: string;
    totalExpensesSSP?: string;
    netIncome: string;
    netIncomeSSP?: string;
    insuranceBreakdown: Record<string, string>;
  };
}

export default function SimpleMonthlyFooter({ data }: SimpleMonthlyFooterProps) {
  const incomeSSP = parseFloat(data?.totalIncomeSSP || data?.totalIncome || '0');
  const expensesSSP = parseFloat(data?.totalExpensesSSP || data?.totalExpenses || '0');
  const netSSP = parseFloat(data?.netIncomeSSP || data?.netIncome || '0');
  const marginSSP = incomeSSP > 0 ? (netSSP / incomeSSP) * 100 : 0;
  
  const totalInsuranceUSD = Object.values(data?.insuranceBreakdown || {})
    .reduce((sum, amount) => sum + parseFloat(amount), 0);

  return (
    <Card className="border border-slate-200 shadow-sm bg-gradient-to-r from-slate-50 to-slate-100">
      <CardContent className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">Total Income</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              SSP {Math.round(incomeSSP).toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">Total Expenses</p>
            <p className="text-xl font-bold text-red-500 mt-1">
              SSP {Math.round(expensesSSP).toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">Net Income</p>
            <p className={`text-xl font-bold mt-1 ${netSSP >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
              SSP {Math.round(netSSP).toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-600 font-medium uppercase tracking-wide">Insurance USD</p>
            <p className="text-xl font-bold text-purple-600 mt-1">
              USD {Math.round(totalInsuranceUSD).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {marginSSP.toFixed(1)}% margin
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}