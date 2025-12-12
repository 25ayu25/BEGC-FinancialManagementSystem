/**
 * Claims Distribution Chart Component
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { formatUSD, formatPercentage, type ProviderMetrics } from "../utils/calculations";

interface ClaimsDistributionChartProps {
  metrics: ProviderMetrics[];
}

const COLORS = [
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
];

export function ClaimsDistributionChart({ metrics }: ClaimsDistributionChartProps) {
  // Prepare pie chart data (top 8 providers + others)
  const topProviders = metrics.slice(0, 8);
  const others = metrics.slice(8);
  
  const pieData = topProviders.map(m => ({
    name: m.name,
    value: m.revenue,
  }));

  if (others.length > 0) {
    const othersRevenue = others.reduce((sum, m) => sum + m.revenue, 0);
    pieData.push({
      name: 'Others',
      value: othersRevenue,
    });
  }

  // Prepare bar chart data (sorted by revenue)
  const barData = [...metrics]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(m => ({
      name: m.name,
      revenue: m.revenue,
    }));

  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut Chart */}
      <Card className="border-violet-200 dark:border-violet-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Revenue Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${formatPercentage((entry.value / totalRevenue) * 100, 0)}`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatUSD(value)}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {formatUSD(totalRevenue)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horizontal Bar Chart */}
      <Card className="border-violet-200 dark:border-violet-800">
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
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
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
                  fill="url(#colorGradient)"
                  radius={[0, 8, 8, 0]}
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
