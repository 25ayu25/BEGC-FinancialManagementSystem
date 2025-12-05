import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Receipt, TrendingUp } from "lucide-react";
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

function compactValue(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(v < 10_000_000_000 ? 1 : 0)}B`;
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  if (v >= 1_000) return `${nf0.format(Math.round(n / 1_000))}k`;
  return `${nf0.format(Math.round(n))}`;
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

  // Number of top expense categories to emphasize visually
  const TOP_CATEGORIES_COUNT = 3;

  // Calculate percentages for each row and mark top categories
  const rowsWithPct = rows.map((row, index) => ({
    ...row,
    pct: finalTotal > 0 ? (row.amount / finalTotal) * 100 : 0,
    isTopCategory: index < TOP_CATEGORIES_COUNT && !row.category.toLowerCase().includes('other'), // Top non-other categories
    rank: index + 1,
  }));

  // Give bars room and keep category labels aligned by fixing Y-axis width
  const height = Math.max(280, 56 * rows.length + 80);
  const yLabelWidth = 170;

  // Enhanced color palette - more vibrant for top categories, progressively muted
  const palette = [
    "#0ea5e9", // sky-500 - dominant (1st)
    "#22c55e", // green-500 (2nd)
    "#f97316", // orange-500 (3rd)
    "#8b5cf6", // violet-500
    "#14b8a6", // teal-500
    "#f43f5e", // rose-500
    "#eab308", // yellow-500
    "#64748b", // slate-500 - for "other"
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { category, amount, pct, rank } = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-lg min-w-[180px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">#{rank}</span>
          <span className="text-sm font-semibold text-slate-900">{category}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-mono tabular-nums font-bold text-slate-800">{compactSSP(amount)}</span>
          <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  };

  // Custom label to show compact amount and percentage in single line
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height: barHeight, value, index } = props;
    const row = rowsWithPct[index];
    if (!row) return null;
    
    const labelX = x + width + 10;
    const labelY = y + barHeight / 2 + 4;
    
    // Combine amount and percentage in a clean format: "22M · 22%"
    return (
      <text
        x={labelX}
        y={labelY}
        fill={row.isTopCategory ? "#1e293b" : "#64748b"}
        fontSize={row.isTopCategory ? 12 : 11}
        fontWeight={row.isTopCategory ? 600 : 500}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      >
        {compactValue(value)} · {row.pct.toFixed(0)}%
      </text>
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
            <span className="font-bold text-slate-900 font-mono tabular-nums">{compactSSP(finalTotal)}</span>
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
                margin={{ top: 8, right: 90, bottom: 8, left: 16 }}
                barCategoryGap={10}
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
                    // Use muted color for "Other expenses", stronger opacity for top 3
                    const isOther = row.category.toLowerCase().includes('other');
                    const color = isOther ? palette[palette.length - 1] : palette[i % (palette.length - 1)];
                    return (
                      <Cell 
                        key={`c-${i}`} 
                        fill={color}
                        fillOpacity={row.isTopCategory ? 1 : 0.8}
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
