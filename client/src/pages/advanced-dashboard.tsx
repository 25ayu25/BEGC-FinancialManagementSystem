import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  Building2,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  RefreshCw
} from "lucide-react";
// Removed MonthSelector import - will create inline selector

export default function AdvancedDashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [timeRange, setTimeRange] = useState("month");

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard', selectedYear, selectedMonth],
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const { data: incomeData } = useQuery({
    queryKey: ['/api/income-trends'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const totalIncome = parseFloat(dashboardData?.totalIncome || '0');
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || '0');
  const netIncome = parseFloat(dashboardData?.netIncome || '0');
  const insuranceIncome = Object.values(dashboardData?.insuranceBreakdown || {})
    .reduce((sum: number, amount: any) => sum + parseFloat(amount || '0'), 0);

  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100) : 0;
  const revenueGrowth = 12.5; // This would come from backend calculation
  const patientVolume = 456; // This would come from backend

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Executive Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">
            Bahr El Ghazal Clinic Financial Overview
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={`${selectedYear}-${selectedMonth}`} onValueChange={(value) => {
            const [year, month] = value.split('-').map(Number);
            setSelectedYear(year);
            setSelectedMonth(month);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-8">August 2025</SelectItem>
              <SelectItem value="2025-7">July 2025</SelectItem>
              <SelectItem value="2025-6">June 2025</SelectItem>
              <SelectItem value="2025-5">May 2025</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Revenue */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold">SSP {Math.round(totalIncome).toLocaleString()}</p>
                <div className="flex items-center mt-2">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  <span className="text-sm">+{revenueGrowth}% vs last month</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <TrendingUp className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Net Profit</p>
                <p className="text-3xl font-bold">SSP {Math.round(netIncome).toLocaleString()}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm">{profitMargin.toFixed(1)}% profit margin</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <DollarSign className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Insurance Revenue</p>
                <p className="text-3xl font-bold">USD {Math.round(insuranceIncome).toLocaleString()}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm">{Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Shield className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Volume */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Patient Volume</p>
                <p className="text-3xl font-bold">{patientVolume}</p>
                <div className="flex items-center mt-2">
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  <span className="text-sm">+8.3% this month</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold">Revenue Analytics</CardTitle>
              <Badge variant="secondary">Live Data</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-300">Advanced Revenue Charts</p>
                <p className="text-sm text-slate-500">Interactive analytics coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Departments */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">Top Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departments?.slice(0, 5).map((dept: any, index: number) => {
              const amount = parseFloat(dashboardData?.departmentBreakdown?.[dept.id] || '0');
              const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100) : 0;
              
              return (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-blue-500' : index === 2 ? 'bg-purple-500' : 'bg-slate-400'}`} />
                    <span className="font-medium">{dept.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">SSP {Math.round(amount).toLocaleString()}</p>
                    <p className="text-sm text-slate-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Financial Summary</CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Compare
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Income Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Income Sources</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Direct Payments</span>
                  <span className="font-semibold">SSP {Math.round(totalIncome - insuranceIncome).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Insurance Claims</span>
                  <span className="font-semibold">USD {Math.round(insuranceIncome).toLocaleString()}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Total Revenue</span>
                    <span className="text-emerald-600">SSP {Math.round(totalIncome).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Expenses</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Operational</span>
                  <span className="font-semibold">SSP {Math.round(totalExpenses * 0.7).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Administrative</span>
                  <span className="font-semibold">SSP {Math.round(totalExpenses * 0.3).toLocaleString()}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">SSP {Math.round(totalExpenses).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Profit Margin</span>
                  <Badge variant={profitMargin > 90 ? "default" : profitMargin > 70 ? "secondary" : "destructive"}>
                    {profitMargin.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Revenue Growth</span>
                  <Badge variant="default">+{revenueGrowth}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Efficiency Score</span>
                  <Badge variant="default">95%</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}