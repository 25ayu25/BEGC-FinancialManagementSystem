import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

type BreakdownMap = Record<string, number | string>;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function compactSSP(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `SSP ${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `SSP ${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `SSP ${nf0.format(Math.round(n / 1_000))}k`;
  return `SSP ${nf0.format(Math.round(n))}`;
}

function axisCompact(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${nf0.format(Math.round(n))}`;
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
  maxBars = 8,
}: SimpleExpenseBreakdownProps) {
  const rows = React.useMemo(() => {
    const entries = Object.entries(breakdown || {}).map(([k, v]) => ({
      category: k,
      amount: Number(v) || 0,
    }));
    entries.sort((a, b) => b.amount - a.amount);

    // Merge "Other" and "Others" into "Other expenses"
    const mergedEntries: typeof entries = [];
    let otherExpensesTotal = 0;
    
    for (const entry of entries) {
      const normalized = entry.category.toLowerCase().trim();
      if (normalized === 'other' || normalized === 'others') {
        otherExpensesTotal += entry.amount;
      } else {
        mergedEntries.push(entry);
      }
    }
    
    // Add merged "Other expenses" if there was any
    if (otherExpensesTotal > 0) {
      mergedEntries.push({ category: "Other expenses", amount: otherExpensesTotal });
    }
    
    // Sort again after merging
    mergedEntries.sort((a, b) => b.amount - a.amount);

    if (mergedEntries.length <= maxBars) return mergedEntries;

    const top = mergedEntries.slice(0, maxBars - 1);
    const othersSum = mergedEntries.slice(maxBars - 1).reduce((s, r) => s + r.amount, 0);
    if (othersSum > 0) top.push({ category: "Other expenses", amount: othersSum });
    return top;
  }, [breakdown, maxBars]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof total === "number" && total > 0 ? total : computedTotal;

  // Calculate percentages for each row
  const rowsWithPct = rows.map(row => ({
    ...row,
    pct: finalTotal > 0 ? (row.amount / finalTotal) * 100 : 0,
  }));

  // Give bars room and keep category labels aligned by fixing Y-axis width
  const height = Math.max(280, 52 * rows.length + 80);
  const yLabelWidth = 160;

  // Enhanced color palette - more vibrant for top categories, muted for smaller
  const palette = [
    "#0ea5e9", // sky-500 - dominant
    "#22c55e", // green-500
    "#f97316", // orange-500
    "#8b5cf6", // violet-500
    "#14b8a6", // teal-500
    "#f43f5e", // rose-500
    "#eab308", // yellow-500
    "#64748b", // slate-500 - for "other"
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { category, amount, pct } = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-lg">
        <div className="text-sm font-semibold text-slate-900 mb-1">{category}</div>
        <div className="flex items-center gap-2">
          <span className="text-base font-mono tabular-nums font-bold text-slate-800">{compactSSP(amount)}</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{pct.toFixed(1)}% of total</span>
        </div>
      </div>
    );
  };

  // Custom label to show amount and percentage
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height: barHeight, value, index } = props;
    const row = rowsWithPct[index];
    if (!row) return null;
    
    const labelX = x + width + 8;
    const labelY = y + barHeight / 2;
    
    return (
      <g>
        <text
          x={labelX}
          y={labelY - 6}
          fill="#334155"
          fontSize={11}
          fontWeight={600}
          fontFamily="monospace"
        >
          {compactSSP(value).replace("SSP ", "")}
        </text>
        <text
          x={labelX}
          y={labelY + 8}
          fill="#94a3b8"
          fontSize={10}
        >
          {row.pct.toFixed(0)}%
        </text>
      </g>
    );
  };

  return (
    <Card className="border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <div className="p-1.5 rounded-lg bg-red-100">
                <Receipt className="h-5 w-5 text-red-600" />
              </div>
              {title}
            </CardTitle>
            {periodLabel && (
              <CardDescription className="mt-1">{periodLabel}</CardDescription>
            )}
          </div>
          <div className="rounded-lg bg-gradient-to-r from-red-50 to-rose-50 px-4 py-2 border border-red-100">
            <span className="text-xs text-slate-500 block">Total</span>
            <span className="font-bold text-slate-900">{compactSSP(finalTotal)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {rows.length > 0 ? (
          <div style={{ width: "100%", height }}>
            <ResponsiveContainer>
              <BarChart
                data={rowsWithPct}
                layout="vertical"
                margin={{ top: 8, right: 70, bottom: 8, left: 16 }}
                barCategoryGap={8}
              >
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={axisCompact}
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={yLabelWidth}
                  tick={{ fontSize: 12, fill: "#334155", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  radius={[4, 4, 4, 4]}
                  label={renderCustomLabel}
                >
                  {rowsWithPct.map((row, i) => {
                    // Use muted color for "Other expenses"
                    const isOther = row.category.toLowerCase().includes('other');
                    return (
                      <Cell 
                        key={`c-${i}`} 
                        fill={isOther ? palette[palette.length - 1] : palette[i % (palette.length - 1)]} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
