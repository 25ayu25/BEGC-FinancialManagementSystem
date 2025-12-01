/**
 * Sparkline Component
 * 
 * A miniature trend chart showing historical data trends.
 * Perfect for showing 7-day or 30-day trends next to metrics.
 */

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';

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
  // Convert array to chart data format - memoized to prevent re-renders
  const chartData = useMemo(() => 
    data.map((value, index) => ({ value, index })),
    [data]
  );
  
  // Determine color based on trend if not provided
  const lineColor = color || (
    trend === 'up' ? '#10b981' : // green-500
    trend === 'down' ? '#ef4444' : // red-500
    '#6b7280' // gray-500
  );

  // Add a subtle gradient fill color
  const fillColor = trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : 
                    trend === 'down' ? 'rgba(239, 68, 68, 0.1)' : 
                    'rgba(107, 114, 128, 0.1)';

  return (
    <div 
      style={{ width, height }} 
      className="overflow-hidden"
      role="img"
      aria-label={`Sparkline chart showing ${trend} trend`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient id={`sparklineGradient-${trend}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            fill={`url(#sparklineGradient-${trend})`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
