import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Receipt, 
  Lightbulb, 
  User, 
  Building2, 
  FlaskConical, 
  Stethoscope, 
  TestTube, 
  Pill, 
  Package,
  type LucideIcon
} from "lucide-react";

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

// Category configuration with icons and colors
interface CategoryConfig {
  icon: LucideIcon;
  gradient: string;
  border: string;
  bg: string;
}

const expenseCategories: Record<string, CategoryConfig> = {
  'Radiographer Payments': { 
    icon: User, 
    gradient: 'from-blue-400 to-blue-600',
    border: 'border-t-blue-500',
    bg: 'hover:bg-blue-50/50'
  },
  'Clinic Operations': { 
    icon: Building2, 
    gradient: 'from-green-400 to-green-600',
    border: 'border-t-green-500',
    bg: 'hover:bg-green-50/50'
  },
  'Lab Tech Payments': { 
    icon: FlaskConical, 
    gradient: 'from-orange-400 to-orange-600',
    border: 'border-t-orange-500',
    bg: 'hover:bg-orange-50/50'
  },
  'Doctor Payments': { 
    icon: Stethoscope, 
    gradient: 'from-teal-400 to-teal-600',
    border: 'border-t-teal-500',
    bg: 'hover:bg-teal-50/50'
  },
  'Lab Reagents': { 
    icon: TestTube, 
    gradient: 'from-pink-400 to-pink-600',
    border: 'border-t-pink-500',
    bg: 'hover:bg-pink-50/50'
  },
  'Drugs Purchased': { 
    icon: Pill, 
    gradient: 'from-amber-400 to-amber-600',
    border: 'border-t-amber-500',
    bg: 'hover:bg-amber-50/50'
  },
  'Other': { 
    icon: Package, 
    gradient: 'from-slate-400 to-slate-600',
    border: 'border-t-slate-500',
    bg: 'hover:bg-slate-50/50'
  },
};

// Get config for a category, with fallback to Other
function getCategoryConfig(categoryName: string): CategoryConfig {
  return expenseCategories[categoryName] || expenseCategories['Other'];
}

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

// ExpenseCard component for each expense category
interface ExpenseCardProps {
  expense: { name: string; amount: number; percentage: number };
  config: CategoryConfig;
}

function ExpenseCard({ expense, config }: ExpenseCardProps) {
  const Icon = config.icon;
  const isOther = isOtherCategory(expense.name);
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-white",
      "shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300",
      "hover:-translate-y-1 cursor-pointer border-t-4",
      // Use dashed border for "Other" category to make it visually distinct
      isOther ? "border border-dashed border-slate-300" : "border border-slate-200",
      config.border,
      config.bg
    )}>
      <div className="p-4">
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-lg bg-gradient-to-br",
          "flex items-center justify-center mb-3 shadow-lg",
          config.gradient
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        
        {/* Category Name */}
        <h4 className="text-sm font-medium text-slate-600 mb-1">
          {expense.name}
        </h4>
        
        {/* Amount and Percentage */}
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold text-slate-900">
            SSP {compactValue(expense.amount)}
          </span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {expense.percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SimpleExpenseBreakdown({
  breakdown,
  total,
  title = "Expenses Breakdown",
  periodLabel,
  maxBars = 7,
}: SimpleExpenseBreakdownProps) {
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

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
      <CardHeader className="pb-4">
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

      <CardContent>
        {sortedExpenses.length > 0 ? (
          <>
            {/* Cards Grid - 3 columns on desktop, 2 on tablet, 1 on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {expensesWithPct.map((expense) => {
                const config = getCategoryConfig(expense.name);
                return (
                  <ExpenseCard 
                    key={expense.name} 
                    expense={expense} 
                    config={config}
                  />
                );
              })}
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
