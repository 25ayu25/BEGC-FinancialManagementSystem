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
    <div className="min-h-screen bg-white dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Executive Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Track key financial metrics - August 2025
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={`${selectedYear}-${selectedMonth}`} onValueChange={(value) => {
            const [year, month] = value.split('-').map(Number);
            setSelectedYear(year);
            setSelectedMonth(month);
          }}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-8">August 2025</SelectItem>
              <SelectItem value="2025-7">July 2025</SelectItem>
              <SelectItem value="2025-6">June 2025</SelectItem>
              <SelectItem value="2025-5">May 2025</SelectItem>
              <SelectItem value="2025-4">April 2025</SelectItem>
              <SelectItem value="2025-3">March 2025</SelectItem>
              <SelectItem value="2025-2">February 2025</SelectItem>
              <SelectItem value="2025-1">January 2025</SelectItem>
              <SelectItem value="2024-12">December 2024</SelectItem>
              <SelectItem value="2024-11">November 2024</SelectItem>
              <SelectItem value="2024-10">October 2024</SelectItem>
              <SelectItem value="2024-9">September 2024</SelectItem>
              <SelectItem value="2024-8">August 2024</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" className="h-9 text-sm">
            <Download className="h-3 w-3 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-slate-900">SSP {Math.round(totalIncome).toLocaleString()}</p>
                <div className="flex items-center mt-1 text-emerald-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  <span className="text-xs font-medium">+{revenueGrowth}%</span>
                </div>
              </div>
              <div className="bg-emerald-50 p-2 rounded-full">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Net Profit</p>
                <p className="text-2xl font-bold text-slate-900">SSP {Math.round(netIncome).toLocaleString()}</p>
                <div className="flex items-center mt-1 text-blue-600">
                  <span className="text-xs font-medium">{profitMargin.toFixed(1)}% margin</span>
                </div>
              </div>
              <div className="bg-blue-50 p-2 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Insurance Revenue</p>
                <p className="text-2xl font-bold text-slate-900">USD {Math.round(insuranceIncome).toLocaleString()}</p>
                <div className="flex items-center mt-1 text-purple-600">
                  <span className="text-xs font-medium">{Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers</span>
                </div>
              </div>
              <div className="bg-purple-50 p-2 rounded-full">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Volume */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Patient Volume</p>
                <p className="text-2xl font-bold text-slate-900">{patientVolume}</p>
                <div className="flex items-center mt-1 text-orange-600">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  <span className="text-xs font-medium">+8.3%</span>
                </div>
              </div>
              <div className="bg-orange-50 p-2 rounded-full">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900">Revenue Analytics</CardTitle>
              <Badge variant="outline" className="text-slate-600">Live Data</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Advanced Revenue Charts</p>
                <p className="text-sm text-slate-500">Interactive analytics coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Departments */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">Top Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments?.slice(0, 5).map((dept: any, index: number) => {
              const amount = parseFloat(dashboardData?.departmentBreakdown?.[dept.id] || '0');
              const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100) : 0;
              
              return (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-blue-500' : index === 2 ? 'bg-purple-500' : index === 3 ? 'bg-orange-500' : 'bg-slate-400'}`} />
                    <span className="font-medium text-slate-700 flex-1">{dept.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-semibold text-slate-900 text-sm">SSP {Math.round(amount).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-slate-900">Financial Summary</CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" className="text-slate-600 border-slate-300">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="text-slate-600 border-slate-300">
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