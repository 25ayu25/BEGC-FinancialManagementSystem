import * as React from "react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ExpensesDrawer from "@/components/dashboard/ExpensesDrawer";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface ExecutiveStyleKPIsProps {
  data?: {
    totalIncomeSSP: string;
    totalIncomeUSD: string;
    totalExpenses: string;
    netIncome: string;
    expenseBreakdown?: Record<string, string | number>;
    insuranceBreakdown: Record<string, string>;
    changes?: {
      incomeChangeSSP?: number;
      expenseChangeSSP?: number;
      netIncomeChangeSSP?: number;
      incomeChangeUSD?: number;
    };
  };
  /** Optional label for the current period (e.g., “Current month”) */
  periodLabel?: string;
}

function formatSSP(n: number) {
  return `SSP ${Math.round(n).toLocaleString()}`;
}

export default function ExecutiveStyleKPIs({
  data,
  periodLabel = "Selected period",
}: ExecutiveStyleKPIsProps) {
  const sspRevenue = parseFloat(data?.totalIncomeSSP || "0");
  const totalExpenses = parseFloat(data?.totalExpenses || "0");
  const sspNetIncome = parseFloat(data?.netIncome || "0");
  const usdIncome = parseFloat(data?.totalIncomeUSD || "0");

  // Drawer state (shared component has transparent overlay)
  const [openExpenses, setOpenExpenses] = React.useState(false);

  const openDrawer = () => setOpenExpenses(true);
  const kpiKeyHandler: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDrawer();
    }
  };

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
                  SSP <AnimatedNumber value={sspRevenue} />
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
                    <span className="text-xs font-medium text-slate-500">
                      vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                {data?.changes?.incomeChangeSSP !== undefined &&
                data.changes.incomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses — opens shared drawer */}
        <Card
          className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          role="button"
          tabIndex={0}
          aria-label="Open expense breakdown"
          onClick={openDrawer}
          onKeyDown={kpiKeyHandler}
          title="Click to view expense breakdown"
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                  SSP <AnimatedNumber value={totalExpenses} />
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
                    <span className="text-xs font-medium text-slate-500">
                      vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-lg">
                {data?.changes?.expenseChangeSSP !== undefined &&
                data.changes.expenseChangeSSP < 0 ? (
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
                  SSP <AnimatedNumber value={sspNetIncome} />
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
                    <span className="text-xs font-medium text-slate-500">
                      vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-600" />
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
                    USD <AnimatedNumber value={usdIncome} />
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

      {/* Shared non-dimming drawer */}
      <ExpensesDrawer
        open={openExpenses}
        onOpenChange={setOpenExpenses}
        periodLabel={periodLabel}
        expenseBreakdown={data?.expenseBreakdown}
        totalExpenseSSP={
          Number.isFinite(totalExpenses) ? totalExpenses : undefined
        }
        onViewFullReport={() => (window.location.href = "/reports")}
      />
    </>
  );
}
