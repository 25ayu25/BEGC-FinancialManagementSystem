import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Props = {
  /** array of { name: string; value: number } OR object map */
  breakdown:
    | Array<{ name: string; value: number }>
    | Record<string, number>
    | undefined;
  /** total expenses (SSP) for caption & scale */
  total: number;
  /** panel title */
  title?: string;
  /** small caption such as "Current month" */
  periodLabel?: string;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function SimpleExpenseBreakdown({
  breakdown,
  total,
  title = "Expenses Breakdown",
  periodLabel,
}: Props) {
  const rows = normalize(breakdown);
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-1">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
          {typeof total === "number" && (
            <div className="text-xs text-slate-500">Total: SSP {nf0.format(Math.round(total))}</div>
          )}
        </div>
        {periodLabel && <div className="text-xs text-slate-500">{periodLabel}</div>}
      </CardHeader>

      <CardContent className="pt-2">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No expense data</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                barCategoryGap={10}
              >
                <CartesianGrid stroke="#e5e7eb" opacity={0.4} />
                <XAxis
                  type="number"
                  domain={[0, Math.max(max * 1.1, 1)]}
                  hide
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: "rgba(2, 132, 199, 0.06)" }}
                  formatter={(v: number) => [`SSP ${nf0.format(Math.round(v))}`, "Total"]}
                  labelClassName="text-slate-700"
                />
                {/* Use a pleasant (but subtle) palette */}
                <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={14} fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function normalize(
  b: Props["breakdown"]
): Array<{ name: string; value: number }> {
  if (!b) return [];
  if (Array.isArray(b)) {
    return b
      .map((r) => ({ name: r.name, value: Number(r.value || 0) }))
      .filter((r) => r.value > 0);
  }
  return Object.entries(b)
    .map(([k, v]) => ({ name: titleize(k), value: Number(v || 0) }))
    .filter((r) => r.value > 0);
}

function titleize(s: string) {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
