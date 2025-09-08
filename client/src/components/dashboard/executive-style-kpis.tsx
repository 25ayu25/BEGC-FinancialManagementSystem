import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface ExecutiveStyleKPIsProps {
  data?: {
    totalIncomeSSP: string;
    totalIncomeUSD: string;
    totalExpenses: string;
    netIncome: string;
    // ⬇️ add this so the drawer can show grouped expenses
    expenseBreakdown?: Record<string, string | number>;
    insuranceBreakdown: Record<string, string>;
    changes?: {
      incomeChangeSSP?: number;
      expenseChangeSSP?: number;
      netIncomeChangeSSP?: number;
      incomeChangeUSD?: number;
    };
  };
}

function formatSSP(n: number) {
  return `SSP ${Math.round(n).toLocaleString()}`;
}

export default function ExecutiveStyleKPIs({ data }: ExecutiveStyleKPIsProps) {
  const sspRevenue = parseFloat(data?.totalIncomeSSP || "0");
  const totalExpenses = parseFloat(data?.totalExpenses || "0");
  const sspNetIncome = parseFloat(data?.netIncome || "0");
  const usdIncome = parseFloat(data?.totalIncomeUSD || "0");

  // Drawer state
  const [openExpenses, setOpenExpenses] = React.useState(false);

  // Build sorted rows for the drawer from expenseBreakdown
  const expenseRows = React.useMemo(() => {
    const map = data?.expenseBreakdown || {};
    const arr = Object.entries(map).map(([k, v]) => [k, Number(v) || 0] as [string, number]);
    arr.sort((a, b) => b[1] - a[1]);
    return arr;
  }, [data?.expenseBreakdown]);

  const totalFromRows = React.useMemo(
    () => expenseRows.reduce((s, [, v]) => s + v, 0),
    [expenseRows]
  );

  const periodLabel = "Selected period"; // optional: replace with your actual period label

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {Math.round(sspRevenue).toLocaleString()}
                </p>
                <div className="flex items-center mt-1">
                  {data?.changes?.incomeChangeSSP !== undefined ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        data.changes.incomeChangeSSP > 0
                          ? "text-emerald-700"
                          : data.changes.incomeChangeSSP < 0
                          ? "text-red-700"
                          : "text-slate-500"
                      }`}
                    >
                      {data.changes.incomeChangeSSP > 0 ? "+" : ""}
                      {data.changes.incomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">vs last month</span>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                {data?.changes?.incomeChangeSSP !== undefined && data.changes.incomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses — now clickable */}
        <Card
          className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setOpenExpenses(true)}
          title="Click to view expense breakdown"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {Math.round(totalExpenses).toLocaleString()}
                </p>
                <div className="flex items-center mt-1">
                  {data?.changes?.expenseChangeSSP !== undefined ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        data.changes.expenseChangeSSP > 0
                          ? "text-red-700"
                          : data.changes.expenseChangeSSP < 0
                          ? "text-emerald-700"
                          : "text-slate-500"
                      }`}
                    >
                      {data.changes.expenseChangeSSP > 0 ? "+" : ""}
                      {data.changes.expenseChangeSSP.toFixed(1)}% vs last month
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">vs last month</span>
                  )}
                </div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-lg">
                {data?.changes?.expenseChangeSSP !== undefined && data.changes.expenseChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Income */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Net Income</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {Math.round(sspNetIncome).toLocaleString()}
                </p>
                <div className="flex items-center mt-1">
                  {data?.changes?.netIncomeChangeSSP !== undefined ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        data.changes.netIncomeChangeSSP > 0
                          ? "text-emerald-700"
                          : data.changes.netIncomeChangeSSP < 0
                          ? "text-red-700"
                          : "text-slate-500"
                      }`}
                    >
                      {data.changes.netIncomeChangeSSP > 0 ? "+" : ""}
                      {data.changes.netIncomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">vs last month</span>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg">
                {data?.changes?.netIncomeChangeSSP !== undefined && data.changes.netIncomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <DollarSign className="h-4 w-4 text-blue-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue */}
        <Link href="/insurance-providers">
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    USD {Math.round(usdIncome).toLocaleString()}
                  </p>
                  <div className="flex items-center mt-1">
                    {data?.changes?.incomeChangeUSD !== undefined ? (
                      <span
                        className={`text-xs font-medium tabular-nums ${
                          data.changes.incomeChangeUSD > 0
                            ? "text-emerald-700"
                            : data.changes.incomeChangeUSD < 0
                            ? "text-red-700"
                            : "text-slate-500"
                        }`}
                      >
                        {data.changes.incomeChangeUSD > 0 ? "+" : ""}
                        {data.changes.incomeChangeUSD.toFixed(1)}% vs last month
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-purple-600">
                        {Object.keys(data?.insuranceBreakdown || {}).length === 1
                          ? "1 provider"
                          : `${Object.keys(data?.insuranceBreakdown || {}).length} providers`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-1.5 rounded-lg">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ----- Right-side drawer for Expenses ----- */}
      <Sheet open={openExpenses} onOpenChange={setOpenExpenses}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle>Expense Breakdown</SheetTitle>
            <SheetDescription>For {periodLabel}</SheetDescription>
          </SheetHeader>

          {/* Total line */}
          <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="font-semibold">
                {formatSSP(Number.isFinite(totalExpenses) && totalExpenses > 0 ? totalExpenses : totalFromRows)}
              </span>
            </div>
          </div>

          {/* Category rows */}
          <div className="space-y-3">
            {expenseRows.map(([name, amt]) => {
              const base = Number.isFinite(totalExpenses) && totalExpenses > 0 ? totalExpenses : totalFromRows;
              const pct = base > 0 ? (amt / base) * 100 : 0;
              return (
                <div key={name} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="truncate pr-3 font-medium">{name}</div>
                    <div className="text-sm tabular-nums">{formatSSP(amt)}</div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                </div>
              );
            })}

            {expenseRows.length === 0 && (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">No expense data for this period.</div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => {
                // Simple: navigate to reports page with current filters (adjust if you pass period in URL)
                window.location.href = "/reports";
              }}
            >
              View full report
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
