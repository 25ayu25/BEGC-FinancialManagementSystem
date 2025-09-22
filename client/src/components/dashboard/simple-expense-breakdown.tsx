import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  maxBars = 6,
}: SimpleExpenseBreakdownProps) {
  const rows = React.useMemo(() => {
    const entries = Object.entries(breakdown || {}).map(([k, v]) => ({
      category: k,
      amount: Number(v) || 0,
    }));
    entries.sort((a, b) => b.amount - a.amount);

    if (entries.length <= maxBars) return entries;

    const top = entries.slice(0, maxBars);
    const othersSum = entries.slice(maxBars).reduce((s, r) => s + r.amount, 0);
    if (othersSum > 0) top.push({ category: "Others", amount: othersSum });
    return top;
  }, [breakdown, maxBars]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof total === "number" && total > 0 ? total : computedTotal;

  // Give bars room and keep category labels aligned by fixing Y-axis width
  const height = Math.max(240, 56 * rows.length + 90);
  const yLabelWidth = 180;

  const palette = ["#0ea5e9", "#22c55e", "#f97316", "#e11d48", "#8b5cf6", "#14b8a6", "#64748b"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { category, amount } = payload[0].payload;
    const pct = finalTotal > 0 ? (amount / finalTotal) * 100 : 0;
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow">
        <div className="text-sm font-semibold text-slate-900">{category}</div>
        <div className="text-sm font-mono tabular-nums">{compactSSP(amount)}</div>
        <div className="text-xs text-slate-500">{pct.toFixed(1)}% of total</div>
      </div>
    );
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
            {periodLabel ? <p className="text-xs text-slate-500">{periodLabel}</p> : null}
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-1.5 text-sm border border-slate-200">
            <span className="text-slate-600 mr-2">Total</span>
            <span className="font-semibold">{compactSSP(finalTotal)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {rows.length > 0 ? (
          <div style={{ width: "100%", height }}>
            <ResponsiveContainer>
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 16 }}
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
                  tick={{ fontSize: 12, fill: "#334155" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
                  {/* Value labels at the end of each bar */}
                  <LabelList
                    dataKey="amount"
                    position="right"
                    className="fill-slate-700"
                    formatter={(v: number) => compactSSP(v).replace("SSP ", "")}
                    style={{ fontSize: 11 }}
                  />
                  {rows.map((_, i) => (
                    <Cell key={`c-${i}`} fill={palette[i % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
            No expense data for this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
