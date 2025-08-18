import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import IncomeChart from "@/components/dashboard/income-chart";
import DepartmentBreakdown from "@/components/dashboard/department-breakdown";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import QuickActions from "@/components/dashboard/quick-actions";
import MonthSelector from "@/components/dashboard/month-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const handleMonthChange = (year: number, month: number, range?: string) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    // Handle range-based filtering here if needed in the future
    console.log('Filter changed:', { year, month, range });
  };

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

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
  });

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <Header 
          title="Financial Dashboard" 
          subtitle={`Track daily income and expenses - ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold">Error Loading Dashboard</p>
                <p className="text-sm mt-2">Unable to fetch dashboard data. Please check your connection and try again.</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <Header 
          title="Financial Dashboard" 
          subtitle={`Track daily income and expenses - ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <MonthSelector onMonthChange={handleMonthChange} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <Header 
        title="Financial Dashboard" 
        subtitle={`Track daily income and expenses - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
        actions={
          <div className="flex items-center space-x-4">
            <MonthSelector onMonthChange={handleMonthChange} />
            <Button variant="outline" size="sm" data-testid="button-generate-pdf">
              Generate PDF
            </Button>
          </div>
        }
      />
      
      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        <KPICards data={dashboardData || {}} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncomeChart />
          <DepartmentBreakdown 
            data={dashboardData?.departmentBreakdown || {}} 
            departments={departments || []}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentTransactions transactions={dashboardData?.recentTransactions || []} />
          </div>
          <QuickActions 
            insuranceData={dashboardData?.insuranceBreakdown || {}}
            insuranceProviders={insuranceProviders || []}
          />
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-slate-100">
            <CardTitle className="text-lg font-semibold text-slate-900">
              {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Department Income Breakdown */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  Income Breakdown
                </h4>
                <div className="space-y-3 text-sm">
                  {(departments || []).map((dept: any) => (
                    <div key={dept.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
                      <span className="text-slate-600 font-medium">{dept.name}</span>
                      <span className="font-semibold text-slate-900">
                        SSP {Math.round(parseFloat((dashboardData as any)?.departmentBreakdown?.[dept.id] || '0')).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-teal-100 font-semibold">
                    <span className="text-slate-900">Total Income</span>
                    <span className="text-teal-600 text-base">
                      SSP {Math.round(parseFloat((dashboardData as any)?.totalIncome || '0')).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insurance Income */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Insurance Income
                </h4>
                <div className="space-y-3 text-sm">
                  {(insuranceProviders || []).map((provider: any) => {
                    const amount = parseFloat((dashboardData as any)?.insuranceBreakdown?.[provider.id] || '0');
                    return (
                      <div key={provider.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
                        <span className="text-slate-600 font-medium">{provider.name}</span>
                        <span className="font-semibold text-slate-900">
                          USD {amount.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-blue-100 font-semibold">
                    <span className="text-slate-900">Total Insurance</span>
                    <span className="text-blue-600 text-base">
                      USD {Object.values((dashboardData as any)?.insuranceBreakdown || {})
                        .reduce((sum: number, val: any) => sum + parseFloat(val || '0'), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Position with Visual Indicators */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Net Position
                </h4>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Income</span>
                      <span className="font-semibold text-emerald-600">
                        SSP {Math.round(parseFloat((dashboardData as any)?.totalIncome || '0')).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Total Expenses</span>
                      <span className="font-semibold text-red-500">
                        SSP {Math.round(parseFloat((dashboardData as any)?.totalExpenses || '0')).toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t border-slate-300 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-slate-900">Net Income</span>
                        <span className={`font-bold text-lg ${parseFloat((dashboardData as any)?.netIncome || '0') >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          SSP {Math.round(parseFloat((dashboardData as any)?.netIncome || '0')).toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Profit Margin Visual */}
                      <div className="space-y-2">
                        <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-4 rounded-full transition-all duration-500 ease-out" 
                            style={{ 
                              width: `${Math.max(0, Math.min(100, (parseFloat((dashboardData as any)?.netIncome || '0') / parseFloat((dashboardData as any)?.totalIncome || '1')) * 100))}%` 
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-slate-600 font-medium">
                            Profit Margin: {((parseFloat((dashboardData as any)?.netIncome || '0') / parseFloat((dashboardData as any)?.totalIncome || '1')) * 100).toFixed(1)}%
                          </p>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="text-xs text-slate-600">Healthy</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
