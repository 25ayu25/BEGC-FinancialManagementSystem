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
} from "recharts";

type BreakdownMap = Record<string, number | string>;

function formatSSP(n: number) {
  return `SSP ${Math.round(n).toLocaleString()}`;
}

export interface SimpleExpenseBreakdownProps {
  breakdown?: BreakdownMap | null;
  total?: number | null;        // optional: total expenses SSP for the same range
  title?: string;               // optional: defaults to "Expenses by Category"
  periodLabel?: string;         // optional subtitle
  maxBars?: number;             // optional: how many categories to show before "Others"
}

export default function SimpleExpenseBreakdown({
  breakdown,
  total,
  title = "Expenses by Category",
  periodLabel,
  maxBars = 6,
}: SimpleExpenseBreakdownProps) {
  const rows = React.useMemo(() => {
    const entries = Object.entries(breakdown || {}).map(([k, v]) => ({
      category: k,
      amount: Number(v) || 0,
    }));
    // sort by amount desc
    entries.sort((a, b) => b.amount - a.amount);

    if (entries.length <= maxBars) return entries;

    const top = entries.slice(0, maxBars);
    const othersSum = entries.slice(maxBars).reduce((s, r) => s + r.amount, 0);
    if (othersSum > 0) top.push({ category: "Others", amount: othersSum });
    return top;
  }, [breakdown, maxBars]);

  const computedTotal = rows.reduce((s, r) => s + r.amount, 0);
  const finalTotal = typeof total === "number" && total > 0 ? total : computedTotal;

  const height = Math.max(220, 56 * rows.length + 80); // auto height per row
  const palette = ["#0ea5e9", "#22c55e", "#f97316", "#e11d48", "#8b5cf6", "#14b8a6", "#64748b"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { category, amount } = payload[0].payload;
    const pct = finalTotal > 0 ? ((amount / finalTotal) * 100) : 0;
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow">
        <div className="text-sm font-semibold text-slate-900">{category}</div>
        <div className="text-sm font-mono tabular-nums">{formatSSP(amount)}</div>
        <div className="text-xs text-slate-500">{pct.toFixed(1)}% of total</div>
      </div>
    );
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          {title}
        </CardTitle>
        {periodLabel ? (
          <p className="text-xs text-slate-500">{periodLabel}</p>
        ) : null}
      </CardHeader>

      <CardContent>
        {rows.length > 0 ? (
          <>
            {/* Total line */}
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-slate-600">Total</span>
              <span className="font-semibold">{formatSSP(finalTotal)}</span>
            </div>

            <div style={{ width: "100%", height }}>
              <ResponsiveContainer>
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    width={140}
                    tick={{ fontSize: 12, fill: "#334155" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
                    {rows.map((_, i) => (
                      <Cell key={`c-${i}`} fill={palette[i % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
            No expense data for this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
