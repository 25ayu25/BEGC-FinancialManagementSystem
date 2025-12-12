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
import { formatUSD, formatPercentage, getProviderColor, type ProviderMetrics } from "../utils/calculations";

interface ClaimsDistributionChartProps {
  metrics: ProviderMetrics[];
}

export function ClaimsDistributionChart({ metrics }: ClaimsDistributionChartProps) {
  // Prepare pie chart data (top 8 providers + others)
  const topProviders = metrics.slice(0, 8);
  const others = metrics.slice(8);
  
  const pieData = topProviders.map((m, index) => ({
    name: m.name,
    value: m.revenue,
    color: getProviderColor(m.name, index),
  }));

  if (others.length > 0) {
    const othersRevenue = others.reduce((sum, m) => sum + m.revenue, 0);
    if (othersRevenue > 0) {
      pieData.push({
        name: 'Others',
        value: othersRevenue,
        color: '#9CA3AF', // gray for others
      });
    }
  }

  // Filter out 0% segments
  const filteredPieData = pieData.filter(item => item.value > 0);

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

  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut Chart */}
      <Card className="border-violet-200/50 dark:border-violet-800/50 backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 shadow-lg">
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
                  data={filteredPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => {
                    const percent = (entry.value / totalRevenue) * 100;
                    return percent > 3 ? `${entry.name}: ${formatPercentage(percent, 0)}` : '';
                  }}
                  labelLine={true}
                >
                  {filteredPieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
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
              <div className="text-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2">
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
    </div>
  );
}
