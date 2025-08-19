import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Building2,
  Shield
} from "lucide-react";

export default function SimpleDashboard() {
  const currentDate = new Date();
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth() + 1;

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${selectedYear}/${selectedMonth}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading financial data...</p>
          <p className="mt-2 text-sm text-gray-400">Connecting to Supabase...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="text-center py-20">
          <p className="text-red-600">Error loading data: {error.message}</p>
          <p className="mt-2 text-sm text-gray-400">Check console for details</p>
        </div>
      </div>
    )
  }

  const stats = [
    {
      name: "Total Revenue",
      value: `SSP ${dashboardData?.totalIncome || '0'}`,
      change: "+12.5%",
      changeType: "increase" as const,
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      name: "Total Expenses", 
      value: `SSP ${dashboardData?.totalExpense || '0'}`,
      change: "+3.2%",
      changeType: "increase" as const,
      icon: TrendingDown,
      color: "text-red-600"
    },
    {
      name: "Net Income",
      value: `SSP ${dashboardData?.netIncome || '0'}`,
      change: "+8.1%",
      changeType: "increase" as const,
      icon: TrendingUp,
      color: "text-green-600"
    },
    {
      name: "Insurance Revenue",
      value: `USD ${dashboardData?.insuranceRevenue || '0'}`,
      change: "+5.4%",
      changeType: "increase" as const,
      icon: Shield,
      color: "text-blue-600"
    },
    {
      name: "Transactions",
      value: `${dashboardData?.transactionCount || 0}`,
      change: "+22.7%",
      changeType: "increase" as const,
      icon: Users,
      color: "text-purple-600"
    },
    {
      name: "Insurance Providers",
      value: `${dashboardData?.insuranceProviders || 0}`,
      change: "+2",
      changeType: "increase" as const,
      icon: Building2,
      color: "text-orange-600"
    }
  ]

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Financial Overview</h2>
        <Badge variant="outline" className="text-green-600">
          August 2024
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.name}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span className={stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'}>
                    {stat.change}
                  </span>
                  <span>from last month</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                {dashboardData?.transactionCount || 0} transactions processed this month
              </div>
              <div className="text-sm text-gray-600">
                Revenue from {dashboardData?.insuranceProviders || 0} insurance providers
              </div>
              <div className="text-sm text-green-600 font-medium">
                System operating normally
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Financial Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Revenue Growth</span>
                <span className="text-green-600 font-medium">Strong</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Expense Control</span>
                <span className="text-yellow-600 font-medium">Moderate</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Overall Status</span>
                <span className="text-green-600 font-medium">Healthy</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}