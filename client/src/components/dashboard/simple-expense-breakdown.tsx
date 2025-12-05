import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Receipt, Lightbulb } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type BreakdownMap = Record<string, number | string>;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function compactSSP(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `SSP ${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `SSP ${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `SSP ${nf0.format(Math.round(n / 1_000))}k`;
  return `SSP ${nf0.format(Math.round(n))}`;
}

function compactValue(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `${nf0.format(Math.round(n / 1_000))}k`;
  return `${nf0.format(Math.round(n))}`;
}

// Cohesive color palette for the donut chart - premium design
const EXPENSE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#6b7280', // Gray - Other (always last)
];

// Check if a category name represents "Other" type
function isOtherCategory(categoryName: string): boolean {
  const normalized = categoryName.toLowerCase().trim();
  return normalized === 'other' || 
         normalized === 'others' || 
         normalized === 'other expenses' ||
         normalized === 'other expense';
}

export interface SimpleExpenseBreakdownProps {
  breakdown?: BreakdownMap | null;
  total?: number | null;
  title?: string;
  periodLabel?: string;
  maxBars?: number;
}

export default function SimpleExpenseBreakdown({
  breakdown,
  total,
  title = "Expenses Breakdown",
  periodLabel,
  maxBars = 7,
}: SimpleExpenseBreakdownProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // Sort expenses: specific categories by amount descending, "Other" always last
  const sortedExpenses = React.useMemo(() => {
    const entries = Object.entries(breakdown || {}).map(([k, v]) => ({
      name: k,
      amount: Number(v) || 0,
    }));

    // Separate "Other" from the rest
    const nonOtherEntries: typeof entries = [];
    let otherExpensesTotal = 0;
    
    for (const entry of entries) {
      if (isOtherCategory(entry.name)) {
        otherExpensesTotal += entry.amount;
      } else {
        nonOtherEntries.push(entry);
      }
    }
    
    // Sort non-other entries by amount descending
    nonOtherEntries.sort((a, b) => b.amount - a.amount);

    // Truncate if needed, combining excess into "Other"
    const maxNonOtherSlices = otherExpensesTotal > 0 ? maxBars - 1 : maxBars;
    
    let finalEntries: typeof entries;
    
    if (nonOtherEntries.length <= maxNonOtherSlices) {
      finalEntries = [...nonOtherEntries];
    } else {
      const topEntries = nonOtherEntries.slice(0, maxNonOtherSlices);
      const truncatedSum = nonOtherEntries.slice(maxNonOtherSlices).reduce((s, r) => s + r.amount, 0);
      otherExpensesTotal += truncatedSum;
      finalEntries = topEntries;
    }
    
    // Add "Other" at the END (always last) if there's any amount
    if (otherExpensesTotal > 0) {
      finalEntries.push({ name: "Other", amount: otherExpensesTotal });
    }
    
    return finalEntries;
  }, [breakdown, maxBars]);

  const computedTotal = sortedExpenses.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof total === "number" && total > 0 ? total : computedTotal;

  // Add percentage to each expense for display (memoized)
  const expensesWithPct = React.useMemo(() => 
    sortedExpenses.map((expense) => ({
      ...expense,
      percentage: finalTotal > 0 ? Math.round((expense.amount / finalTotal) * 100) : 0,
    })),
    [sortedExpenses, finalTotal]
  );

  // Calculate top 3 percentage (excluding Other)
  const top3Percentage = React.useMemo(() => {
    const nonOtherExpenses = expensesWithPct.filter(e => !isOtherCategory(e.name));
    const top3 = nonOtherExpenses.slice(0, 3);
    return top3.reduce((sum, e) => sum + e.percentage, 0);
  }, [expensesWithPct]);

  // Custom tooltip for donut chart
  interface TooltipProps {
    active?: boolean;
    payload?: Array<{ payload: { name: string; amount: number; percentage: number } }>;
  }

  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
          <p className="font-medium text-slate-900">{data.name}</p>
          <p className="text-sm text-slate-600">
            SSP {compactValue(data.amount)} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Handle hover effects
  const onPieEnter = (_: unknown, index: number) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              {periodLabel && (
                <CardDescription>{periodLabel}</CardDescription>
              )}
            </div>
          </div>
          <div className="bg-slate-100 px-4 py-2 rounded-xl">
            <span className="text-sm text-slate-500">Total</span>
            <span className="ml-2 text-lg font-bold text-slate-900">{compactSSP(finalTotal)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {sortedExpenses.length > 0 ? (
          <>
            {/* Donut Chart + Legend Layout */}
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
              {/* Donut Chart */}
              <div className="w-56 h-56 sm:w-64 sm:h-64 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesWithPct}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="amount"
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                      animationDuration={800}
                      animationBegin={0}
                      stroke="none"
                    >
                      {expensesWithPct.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]}
                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                          style={{
                            filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center text showing total */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">{compactSSP(finalTotal)}</span>
                  <span className="text-xs sm:text-sm text-slate-500">Total</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 w-full space-y-2">
                {expensesWithPct.map((expense, index) => (
                  <div 
                    key={expense.name}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    style={{
                      backgroundColor: activeIndex === index ? 'rgb(248, 250, 252)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-slate-700 truncate">{expense.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-900">
                        {compactValue(expense.amount)}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full min-w-[40px] text-center">
                        {expense.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insight at bottom */}
            {expensesWithPct.filter(e => !isOtherCategory(e.name)).length >= 3 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>
                    Top 3 expenses account for <strong className="text-slate-900">{top3Percentage}%</strong> of total spending
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-1">No Expenses Yet</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Expense data for this period will appear here once transactions are recorded.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
