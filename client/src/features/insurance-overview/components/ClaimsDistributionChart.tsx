/**
 * Claims Distribution Chart Component
 * 
 * Displays top providers by revenue in a horizontal bar chart
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell
} from "recharts";
import { formatUSD, getProviderColor, type ProviderMetrics } from "../utils/calculations";

interface ClaimsDistributionChartProps {
  metrics: ProviderMetrics[];
}

export function ClaimsDistributionChart({ metrics }: ClaimsDistributionChartProps) {
  // Prepare bar chart data (sorted by revenue, with diverse colors)
  const barData = [...metrics]
    .filter(m => m.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((m, index) => ({
      name: m.name,
      revenue: m.revenue,
      color: getProviderColor(m.name, index),
    }));

  return (
    <Card className="border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Top Providers by Revenue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={barData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                type="number" 
                stroke="#6b7280"
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#6b7280"
                width={90}
              />
              <Tooltip 
                formatter={(value: any) => formatUSD(value)}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="revenue" 
                radius={[0, 8, 8, 0]}
              >
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
