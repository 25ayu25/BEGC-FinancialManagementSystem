import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  User, 
  Building2, 
  FlaskConical, 
  Stethoscope, 
  TestTube, 
  Pill, 
  Package,
  type LucideIcon
} from "lucide-react";

type ExpenseBreakdownMap = Record<string, number | string>;

// Number formatting
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatSSP(n: number) {
  return `SSP ${Math.round(n).toLocaleString()}`;
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

export interface ExpensesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  expenseBreakdown?: ExpenseBreakdownMap | null;
  totalExpenseSSP?: number | null;
  onViewFullReport?: () => void;
}

// ExpenseCard component for each expense category in the drawer
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
      "shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300",
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

export default function ExpensesDrawer({
  open,
  onOpenChange,
  periodLabel,
  expenseBreakdown,
  totalExpenseSSP,
  onViewFullReport,
}: ExpensesDrawerProps) {
  // Process expenses: merge "Other" entries, sort by amount, "Other" always last
  const sortedExpenses = React.useMemo(() => {
    if (!expenseBreakdown) return [];
    
    const entries = Object.entries(expenseBreakdown).map(([k, v]) => ({
      name: k,
      amount: Number(v) || 0,
    }));

    // Separate "Other" from the rest and merge all "Other" type entries
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

    // Build final entries with "Other" always last if there's any amount
    const finalEntries = [...nonOtherEntries];
    if (otherExpensesTotal > 0) {
      finalEntries.push({ name: "Other", amount: otherExpensesTotal });
    }
    
    return finalEntries;
  }, [expenseBreakdown]);

  const computedTotal = sortedExpenses.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof totalExpenseSSP === "number" && totalExpenseSSP > 0 ? totalExpenseSSP : computedTotal;
  const safeTotal = finalTotal || 0;

  // Add percentage to each expense for display
  const expensesWithPct = React.useMemo(() => 
    sortedExpenses.map((expense) => ({
      ...expense,
      percentage: safeTotal > 0 ? Math.round((expense.amount / safeTotal) * 100) : 0,
    })),
    [sortedExpenses, safeTotal]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Force overlay to the very top so background does not bleed through */}
      <SheetOverlay className="fixed inset-0 z-[9999] bg-black/40" />
      {/* Force the panel above the overlay and any sticky/z-indexed content */}
      <SheetContent
        side="right"
        className="fixed z-[10000] w-full sm:max-w-[560px] bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
      >
        <SheetHeader className="mb-4 flex-shrink-0">
          <SheetTitle>Expense Breakdown</SheetTitle>
          <SheetDescription>For {periodLabel}</SheetDescription>
        </SheetHeader>

        <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-semibold">{formatSSP(safeTotal)}</span>
          </div>
        </div>

        {/* Scrollable container for expense cards */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
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
          {expensesWithPct.length === 0 && (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              No expense data for this period.
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-end flex-shrink-0">
          <Button onClick={() => onViewFullReport?.()}>View full report</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
