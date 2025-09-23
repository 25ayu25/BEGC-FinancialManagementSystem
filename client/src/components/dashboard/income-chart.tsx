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
import { memo, useMemo } from "react";

/**
 * Supported data shapes:
 *  - Daily:  day: 1..31, optional label/fullDate/dateISO
 *  - Multi-month / Monthly-agg:  label: "Sep 2025" | "2025-09" | "Sep 7", optional monthKey/dateISO
 *
 * Examples:
 * [{ day: 1, label: "Sep 1", dateISO: "2025-09-01", amountSSP: 1200, amountUSD: 0 }]
 * [{ label: "2025-07", monthKey: "2025-07", amountSSP: 55000, amountUSD: 120 }]
 */
export type Row = {
  day?: number;
  label?: string;      // preferred x-axis when present for multi-month/monthly
  fullDate?: string;   // e.g. "Sep 7, 2025"
  dateISO?: string;    // YYYY-MM-DD (optional, good for drilldown)
  monthKey?: string;   // YYYY-MM (optional, good for monthly drilldown)
  amountSSP: number;
  amountUSD: number;
  amount?: number;
};

type Props = {
  data: Row[];
  avgLineSSP?: number;          // optional reference line for SSP daily average
  yTickStep?: number;           // e.g. 10_000; if omitted we auto-pick
  onBarClick?: (row: Row) => void; // drilldown handler receives the row
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
  const dateLabel =
    row.fullDate || row.label || (typeof row.day === "number" ? `Day ${row.day}` : "");

  const ssp = Math.round(row.amountSSP || 0);
  const usd = Math.round(row.amountUSD || 0);
  const total = ssp + usd;

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
      <p className="font-semibold text-slate-900 mb-2">{dateLabel}</p>
      <p className="text-sm text-slate-700 font-mono">SSP {ssp.toLocaleString()}</p>
      <p className="text-sm text-slate-700 font-mono">USD {usd.toLocaleString()}</p>
      <div className="mt-2 pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-500">Total: SSP {total.toLocaleString()}</p>
      </div>
    </div>
  );
};

function computeTicks(data: Row[], step?: number) {
  const peak = Math.max(
    0,
    ...data.map((d) => (d.amountSSP || 0) + (d.amountUSD || 0))
  );
  if (peak === 0) return [0, 10_000, 20_000, 30_000, 40_000];
  const tick = step || Math.max(10_000, Math.round(peak / 6 / 1000) * 1000); // ~6 ticks
  const ticks = [0];
  for (let v = tick; v <= peak * 1.2 + tick; v += tick) ticks.push(v);
  return ticks;
}

const IncomeChart = memo(({ data, avgLineSSP, yTickStep, onBarClick }: Props) => {
  const xKey = useMemo<"label" | "day">(() => {
    // Prefer label if present on all points (multi-month or monthly aggregation)
    const allHaveLabel = data.length > 0 && data.every((d) => typeof d.label === "string" && d.label.length > 0);
    if (allHaveLabel) return "label";

    // Fallback to numeric day if present (single-month daily series)
    const allHaveDay = data.length > 0 && data.every((d) => typeof d.day === "number");
    return allHaveDay ? "day" : "label"; // last resort: label (some points may still have it)
  }, [data]);

  const ticks = useMemo(() => computeTicks(data, yTickStep), [data, yTickStep]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 20, right: 60, left: 10, bottom: 30 }}
        barCategoryGap="6%"
      >
        <CartesianGrid
          strokeDasharray="1 1"
          stroke="#f1f5f9"
          strokeWidth={0.3}
          opacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          axisLine={{ stroke: "#eef2f7", strokeWidth: 1 }}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          // keep labels readable if they are long (e.g., "2025-01")
          interval="preserveStartEnd"
          minTickGap={12}
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
        <Legend
          verticalAlign="top"
          height={36}
          iconType="rect"
          wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
        />

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
          fill="#14b8a6" // teal
          stackId="revenue"
          maxBarSize={18}
          radius={[0, 0, 0, 0]}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
          onClick={(e: any) =>
            onBarClick?.(e?.activePayload?.[0]?.payload || e?.payload)
          }
        />
        <Bar
          dataKey="amountUSD"
          name="USD"
          fill="#0891b2" // teal-blue
          stackId="revenue"
          maxBarSize={18}
          radius={[4, 4, 0, 0]}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
          onClick={(e: any) =>
            onBarClick?.(e?.activePayload?.[0]?.payload || e?.payload)
          }
        />
      </BarChart>
    </ResponsiveContainer>
  );
});

export default IncomeChart;
