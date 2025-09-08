// client/src/components/dashboard/income-chart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { memo } from "react";

/**
 * Expected data shape (array of days or dates):
 * [
 *   {
 *     day: number;            // 1..31 OR any index
 *     label?: string;         // optional label like "Sep 7"
 *     fullDate?: string;      // optional "Sep 7, 2025"
 *     amountSSP: number;
 *     amountUSD: number;
 *     amount?: number;        // total (optional)
 *   }
 * ]
 */
type Row = {
  day: number;
  label?: string;
  fullDate?: string;
  amountSSP: number;
  amountUSD: number;
  amount?: number;
};

type Props = {
  data: Row[];
  avgLineSSP?: number;       // optional reference line for SSP daily average
  yTickStep?: number;        // e.g. 10_000; if omitted we auto-pick
  onBarClick?: (row: Row) => void;
};

const formatYAxis = (value: number) => {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)}m`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
};

const defaultTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as Row;
  const dateLabel = row.fullDate || row.label || `Day ${row.day}`;
  const total = (row.amountSSP ?? 0) + (row.amountUSD ?? 0);

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
      <p className="font-semibold text-slate-900 mb-2">{dateLabel}</p>
      <p className="text-sm text-slate-700 font-mono">SSP {Math.round(row.amountSSP || 0).toLocaleString()}</p>
      <p className="text-sm text-slate-700 font-mono">USD {(row.amountUSD || 0).toLocaleString()}</p>
      <div className="mt-2 pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Total: SSP {Math.round(total).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

function computeTicks(data: Row[], step?: number) {
  const peak = Math.max(0, ...data.map(d => (d.amountSSP || 0) + (d.amountUSD || 0)));
  if (peak === 0) return [0, 10_000, 20_000, 30_000, 40_000];
  const tick = step || Math.max(10_000, Math.round(peak / 6 / 1000) * 1000); // ~6 ticks
  const ticks = [0];
  for (let v = tick; v <= peak * 1.2 + tick; v += tick) ticks.push(v);
  return ticks;
}

const IncomeChart = memo(({ data, avgLineSSP, yTickStep, onBarClick }: Props) => {
  const ticks = computeTicks(data, yTickStep);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 20, right: 60, left: 10, bottom: 30 }}
        barCategoryGap="6%"
      >
        <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" strokeWidth={0.3} opacity={0.3} vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickFormatter={formatYAxis}
          ticks={ticks}
          domain={[0, Math.max(...ticks)]}
        />
        <Tooltip content={defaultTooltip} />
        <Legend verticalAlign="top" height={36} iconType="rect" wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }} />

        {typeof avgLineSSP === "number" && avgLineSSP > 0 && (
          <ReferenceLine
            y={avgLineSSP}
            stroke="#0d9488"
            strokeWidth={1}
            strokeDasharray="4 2"
            label={{
              value: `Avg ${(avgLineSSP / 1000).toFixed(0)}k`,
              position: "insideTopRight",
              style: { fontSize: 10, fill: "#0d9488", fontWeight: 500 },
              offset: 8,
            }}
          />
        )}

        {/* Stacked bars with distinct modern colors */}
        <Bar
          dataKey="amountSSP"
          name="SSP"
          fill="#14b8a6"          // teal
          stackId="revenue"
          maxBarSize={18}
          radius={[0, 0, 0, 0]}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
          onClick={(e: any) => onBarClick?.(e?.activePayload?.[0]?.payload || e?.payload)}
        />
        <Bar
          dataKey="amountUSD"
          name="USD"
          fill="#0891b2"          // teal-blue
          stackId="revenue"
          maxBarSize={18}
          radius={[4, 4, 0, 0]}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
          onClick={(e: any) => onBarClick?.(e?.activePayload?.[0]?.payload || e?.payload)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
});

export default IncomeChart;
