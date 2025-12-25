/**
 * Premium Revenue Trend Chart with advanced animations and interactivity
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Star, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cardVariants, animateValue } from "@/lib/animations";
import { chartColors, gradients } from "@/lib/designTokens";
import { useEffect, useRef } from "react";

interface MonthlyTrendItem {
  month: string;
  fullMonth: string;
  year: number;
  monthNum: number;
  revenue: number;
  revenueUSD: number;
}

interface PremiumRevenueTrendChartProps {
  data: MonthlyTrendItem[];
  currency: "ssp" | "usd";
  chartType: "line" | "area" | "bar";
  onChartTypeChange: (type: "line" | "area" | "bar") => void;
  trendStats: {
    yoyGrowth: number;
    bestMonth: string;
    monthlyAvg: number;
  };
  isFilterSingleMonth: boolean;
  compactSSP: (n: number) => string;
  compactUSD: (n: number) => string;
  formatXAxisMonth: (monthStr: string) => string;
}

export default function PremiumRevenueTrendChart({
  data,
  currency,
  chartType,
  onChartTypeChange,
  trendStats,
  isFilterSingleMonth,
  compactSSP,
  compactUSD,
  formatXAxisMonth,
}: PremiumRevenueTrendChartProps) {
  const [animatedGrowth, setAnimatedGrowth] = useState(0);
  const [animatedAvg, setAnimatedAvg] = useState(0);
  const hasAnimated = useRef(false);

  const isSsp = currency === "ssp";
  const compactFn = isSsp ? compactSSP : compactUSD;
  const dataKey = isSsp ? "revenue" : "revenueUSD";
  const color = isSsp ? chartColors.primary : chartColors.secondary;
  const gradientId = isSsp ? "revenueGradient" : "usdGradient";

  // Animate stats on mount
  useEffect(() => {
    if (!hasAnimated.current && !isFilterSingleMonth) {
      hasAnimated.current = true;
      
      // Animate growth percentage
      animateValue(0, trendStats.yoyGrowth, 1500, (value) => {
        setAnimatedGrowth(value);
      });

      // Animate average
      animateValue(0, trendStats.monthlyAvg, 1500, (value) => {
        setAnimatedAvg(value);
      });
    }
  }, [trendStats.yoyGrowth, trendStats.monthlyAvg, isFilterSingleMonth]);

  // Custom tooltip with enhanced design
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const dataPoint = payload[0].payload;
    const value = dataPoint[dataKey];
    const avgValue = trendStats.monthlyAvg;
    const isAboveAverage = value > avgValue;
    const percentDiff = avgValue > 0 ? ((value - avgValue) / avgValue) * 100 : 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-200"
        style={{
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.12)`,
        }}
      >
        <p className="font-semibold text-slate-900 mb-2">{dataPoint.fullMonth}</p>
        <p className={cn("text-xl font-bold mb-1", isSsp ? "text-teal-600" : "text-blue-600")}>
          {compactFn(value)}
        </p>
        
        {/* Comparison to average */}
        {!isFilterSingleMonth && (
          <div className="flex items-center gap-1 text-xs">
            <span className={cn(
              "font-medium",
              isAboveAverage ? "text-green-600" : "text-orange-600"
            )}>
              {isAboveAverage ? "↑" : "↓"} {Math.abs(percentDiff).toFixed(1)}% vs avg
            </span>
          </div>
        )}

        {/* Mini sparkline would go here in a full implementation */}
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            {isAboveAverage ? "Above average" : "Below average"}
          </p>
        </div>
      </motion.div>
    );
  };

  // Enhanced dot for data points
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const value = payload[dataKey];
    const isBestMonth = payload.fullMonth === trendStats.bestMonth || payload.month === trendStats.bestMonth;

    return (
      <g>
        {/* Outer glow circle */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={8}
          fill={isBestMonth ? "#fbbf24" : color}
          opacity={0.2}
          initial={{ r: 0 }}
          animate={{ r: isBestMonth ? 12 : 8 }}
          transition={{ duration: 0.3 }}
        />
        {/* Inner dot */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={isBestMonth ? 5 : 4}
          fill={isBestMonth ? "#fbbf24" : color}
          stroke="white"
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        />
        {/* Star icon for best month */}
        {isBestMonth && (
          <motion.g
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Star
              x={cx - 6}
              y={cy - 20}
              className="h-3 w-3 fill-amber-400 text-amber-400"
            />
          </motion.g>
        )}
      </g>
    );
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Chart */}
      {data.length > 0 ? (
        <>
          {isFilterSingleMonth && data.length === 1 ? (
            // Single month display
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className={cn(
                  "text-5xl font-bold mb-2",
                  isSsp ? "text-teal-600" : "text-blue-600"
                )}>
                  {compactFn(data[0]?.[dataKey] || 0)}
                </div>
                <div className="text-sm text-slate-500">
                  Total {isSsp ? "Revenue" : "Insurance Revenue"} for {data[0]?.fullMonth || 'Selected Month'}
                </div>
              </motion.div>
              <div className="w-full max-w-md">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Bar 
                      dataKey={dataKey}
                      fill={color}
                      radius={[8, 8, 0, 0]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            // Multi-month chart
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatXAxisMonth}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                        return v.toString();
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone"
                      dataKey={dataKey}
                      stroke={color}
                      strokeWidth={3}
                      fill={`url(#${gradientId})`}
                      dot={<CustomDot />}
                      activeDot={{ r: 6 }}
                      isAnimationActive={true}
                      animationDuration={2000}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                ) : chartType === "line" ? (
                  <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatXAxisMonth}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                        return v.toString();
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone"
                      dataKey={dataKey}
                      stroke={color}
                      strokeWidth={3}
                      dot={<CustomDot />}
                      activeDot={{ r: 6 }}
                      isAnimationActive={true}
                      animationDuration={2000}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                ) : (
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatXAxisMonth}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                        return v.toString();
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey={dataKey}
                      fill={color}
                      radius={[8, 8, 0, 0]}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Stats below chart */}
          {!isFilterSingleMonth && (
            <motion.div
              className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 border-t border-slate-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className={cn(
                  "h-4 w-4",
                  animatedGrowth >= 0 ? "text-green-500" : "text-red-500"
                )} />
                <span className="text-sm text-slate-600">Period Growth:</span>
                <span className={cn(
                  "font-semibold text-lg",
                  animatedGrowth >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {animatedGrowth >= 0 ? "+" : ""}{animatedGrowth.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-slate-600">Best Month:</span>
                <span className="font-semibold text-slate-900">{trendStats.bestMonth}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-slate-600">Monthly Avg:</span>
                <span className="font-semibold text-slate-900">{compactFn(animatedAvg)}</span>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center text-slate-500">
          <BarChart3 className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium">No revenue data available</p>
          <p className="text-xs text-slate-400 mt-1">Try selecting a different time period</p>
        </div>
      )}
    </motion.div>
  );
}
