import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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
  bgColor: string;
  barColor: string;
}

// Map category names to their visual configuration
function getCategoryConfig(categoryName: string): CategoryConfig {
  const normalizedName = categoryName.toLowerCase().trim();
  
  // Radiographer Payments
  if (normalizedName.includes('radiographer') || normalizedName.includes('radiology')) {
    return {
      icon: User,
      bgColor: 'bg-gradient-to-br from-blue-400 to-blue-600',
      barColor: 'bg-blue-500',
    };
  }
  
  // Clinic Operations
  if (normalizedName.includes('clinic') || normalizedName.includes('operations')) {
    return {
      icon: Building2,
      bgColor: 'bg-gradient-to-br from-green-400 to-green-600',
      barColor: 'bg-green-500',
    };
  }
  
  // Lab Tech Payments
  if (normalizedName.includes('lab tech') || normalizedName.includes('laboratory tech')) {
    return {
      icon: FlaskConical,
      bgColor: 'bg-gradient-to-br from-orange-400 to-orange-600',
      barColor: 'bg-orange-500',
    };
  }
  
  // Doctor Payments
  if (normalizedName.includes('doctor') || normalizedName.includes('physician')) {
    return {
      icon: Stethoscope,
      bgColor: 'bg-gradient-to-br from-teal-400 to-teal-600',
      barColor: 'bg-teal-500',
    };
  }
  
  // Lab Reagents
  if (normalizedName.includes('reagent') || normalizedName.includes('lab supplies')) {
    return {
      icon: TestTube,
      bgColor: 'bg-gradient-to-br from-pink-400 to-pink-600',
      barColor: 'bg-pink-500',
    };
  }
  
  // Drugs Purchased
  if (normalizedName.includes('drug') || normalizedName.includes('pharmacy') || normalizedName.includes('medication')) {
    return {
      icon: Pill,
      bgColor: 'bg-gradient-to-br from-amber-400 to-amber-600',
      barColor: 'bg-amber-500',
    };
  }
  
  // Staff Salaries
  if (normalizedName.includes('salary') || normalizedName.includes('salaries') || normalizedName.includes('staff')) {
    return {
      icon: User,
      bgColor: 'bg-gradient-to-br from-indigo-400 to-indigo-600',
      barColor: 'bg-indigo-500',
    };
  }
  
  // Utilities / Fuel
  if (normalizedName.includes('fuel') || normalizedName.includes('utility') || normalizedName.includes('utilities')) {
    return {
      icon: Building2,
      bgColor: 'bg-gradient-to-br from-cyan-400 to-cyan-600',
      barColor: 'bg-cyan-500',
    };
  }
  
  // Other / Default
  return {
    icon: Package,
    bgColor: 'bg-gradient-to-br from-slate-400 to-slate-600',
    barColor: 'bg-slate-500',
  };
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

export default function SimpleExpenseBreakdown({
  breakdown,
  total,
  title = "Expenses Breakdown",
  periodLabel,
  maxBars = 7,
}: SimpleExpenseBreakdownProps) {
  const rows = React.useMemo(() => {
    const entries = Object.entries(breakdown || {}).map(([k, v]) => ({
      category: k,
      amount: Number(v) || 0,
    }));

    // STEP 1: First pass - merge ALL "Other" type entries into one
    const nonOtherEntries: typeof entries = [];
    let otherExpensesTotal = 0;
    
    for (const entry of entries) {
      if (isOtherCategory(entry.category)) {
        otherExpensesTotal += entry.amount;
      } else {
        nonOtherEntries.push(entry);
      }
    }
    
    // Sort non-other entries by amount descending
    nonOtherEntries.sort((a, b) => b.amount - a.amount);

    // STEP 2: If we need to truncate, combine the excess into "Other"
    // Note: We reserve one slot for the consolidated "Other" entry if needed
    const maxNonOtherBars = otherExpensesTotal > 0 ? maxBars - 1 : maxBars;
    
    let finalEntries: typeof entries;
    
    if (nonOtherEntries.length <= maxNonOtherBars) {
      // All non-other entries fit - just add Other if present
      finalEntries = [...nonOtherEntries];
    } else {
      // Need to truncate - take top entries and add rest to "Other"
      const topEntries = nonOtherEntries.slice(0, maxNonOtherBars);
      const truncatedSum = nonOtherEntries.slice(maxNonOtherBars).reduce((s, r) => s + r.amount, 0);
      otherExpensesTotal += truncatedSum;
      finalEntries = topEntries;
    }
    
    // STEP 3: Add the single consolidated "Other" entry if there's any amount
    if (otherExpensesTotal > 0) {
      finalEntries.push({ category: "Other", amount: otherExpensesTotal });
    }
    
    // Final sort by amount descending
    finalEntries.sort((a, b) => b.amount - a.amount);
    
    return finalEntries;
  }, [breakdown, maxBars]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof total === "number" && total > 0 ? total : computedTotal;

  // Calculate percentages and determine max percentage for bar scaling
  const maxPercentage = React.useMemo(() => {
    if (finalTotal === 0) return 100;
    return Math.max(...rows.map(r => (r.amount / finalTotal) * 100), 1);
  }, [rows, finalTotal]);

  // Calculate percentages for each row
  const rowsWithPct = rows.map((row, index) => ({
    ...row,
    pct: finalTotal > 0 ? (row.amount / finalTotal) * 100 : 0,
    config: getCategoryConfig(row.category),
    isOther: isOtherCategory(row.category),
    rank: index + 1,
  }));

  // Calculate insight: top 3 non-other expenses percentage
  const top3Percentage = React.useMemo(() => {
    const nonOtherRows = rowsWithPct.filter(r => !r.isOther);
    const top3 = nonOtherRows.slice(0, 3);
    return top3.reduce((sum, r) => sum + r.pct, 0);
  }, [rowsWithPct]);

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {periodLabel && (
                <CardDescription>{periodLabel}</CardDescription>
              )}
            </div>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg">
            <span className="text-sm text-slate-500">Total</span>
            <span className="ml-2 font-bold text-slate-900">{compactSSP(finalTotal)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {rows.length > 0 ? (
          <>
            <div className="space-y-4">
              {rowsWithPct.map((row) => {
                const Icon = row.config.icon;
                // Scale bar width relative to the largest item for better visual comparison
                const scaledWidth = (row.pct / maxPercentage) * 100;
                
                return (
                  <div key={row.category} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md ${row.config.bgColor} flex items-center justify-center`}>
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{row.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{compactValue(row.amount)}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {row.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${row.config.barColor} transition-all duration-500 group-hover:opacity-80`}
                        style={{ width: `${Math.max(scaledWidth, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Insight at bottom */}
            {rowsWithPct.filter(r => !r.isOther).length >= 3 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>Top 3 expenses account for <strong>{top3Percentage.toFixed(0)}%</strong> of total spending</span>
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
