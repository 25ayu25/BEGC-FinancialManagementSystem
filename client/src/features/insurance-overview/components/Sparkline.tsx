/**
 * Sparkline Component
 * 
 * A miniature trend chart showing historical data trends.
 * Perfect for showing 7-day or 30-day trends next to metrics.
 */

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export function Sparkline({ 
  data, 
  color, 
  width = 80, 
  height = 24,
  trend = 'neutral'
}: SparklineProps) {
  // Convert array to chart data format
  const chartData = data.map((value, index) => ({ value, index }));
  
  // Determine color based on trend if not provided
  const lineColor = color || (
    trend === 'up' ? '#10b981' : // green-500
    trend === 'down' ? '#ef4444' : // red-500
    '#6b7280' // gray-500
  );

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={true}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
