import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type ExpenseBreakdownMap = Record<string, number | string>;

function formatSSP(n: number) {
  return `SSP ${Math.round(n).toLocaleString()}`;
}

export interface ExpensesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  expenseBreakdown?: ExpenseBreakdownMap | null;
  totalExpenseSSP?: number | null;
  onViewFullReport?: () => void;
}

export default function ExpensesDrawer({
  open,
  onOpenChange,
  periodLabel,
  expenseBreakdown,
  totalExpenseSSP,
  onViewFullReport,
}: ExpensesDrawerProps) {
  // 🔒 Ensure no-dim overlay wins even when the overlay is portaled to <body>
  React.useEffect(() => {
    const cls = "no-dim-overlay";
    const el = typeof document !== "undefined" ? document.body : null;
    if (!el) return;
    if (open) el.classList.add(cls);
    else el.classList.remove(cls);
    return () => el.classList.remove(cls);
  }, [open]);

  const rows = React.useMemo(() => {
    if (!expenseBreakdown) return [];
    const arr = Object.entries(expenseBreakdown).map(
      ([k, v]) => [k, Number(v) || 0] as [string, number]
    );
    arr.sort((a, b) => b[1] - a[1]);
    return arr;
  }, [expenseBreakdown]);

  const sum = rows.reduce((s, [, v]) => s + v, 0);
  const total = typeof totalExpenseSSP === "number" ? totalExpenseSSP : sum;
  const safeTotal = total || 0;

  return (
    <>
      {/* Scoped, high-specificity override for the Radix overlay when the drawer is open */}
      <style>{`
        body.no-dim-overlay [data-radix-dialog-overlay] {
          background: transparent !important;
          backdrop-filter: none !important;
        }
        /* Fallback for builds where the overlay lacks the radix data-attr
           but uses the standard fixed inset-0 class cluster */
        body.no-dim-overlay .fixed.inset-0.z-50[data-state="open"] {
          background: transparent !important;
          backdrop-filter: none !important;
        }
      `}</style>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle>Expense Breakdown</SheetTitle>
            <SheetDescription>For {periodLabel}</SheetDescription>
          </SheetHeader>

          {/* Total line */}
          <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="font-semibold">{formatSSP(safeTotal)}</span>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-3">
            {rows.map(([name, amt]) => {
              const pct = safeTotal > 0 ? (amt / safeTotal) * 100 : 0;
              return (
                <div key={name} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="truncate pr-3 font-medium">{name}</div>
                    <div className="text-sm tabular-nums">{formatSSP(amt)}</div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {pct.toFixed(1)}%
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No expense data for this period.
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => onViewFullReport?.()}>View full report</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
