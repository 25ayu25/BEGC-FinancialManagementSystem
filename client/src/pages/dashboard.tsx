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

        <Card>
          <CardHeader>
            <CardTitle>
              {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Income Breakdown</h4>
                <div className="space-y-2 text-sm">
                  {(departments || []).map((dept: any) => (
                    <div key={dept.id} className="flex justify-between">
                      <span className="text-gray-600">{dept.name}</span>
                      <span className="font-medium">
                        SSP {(dashboardData as any)?.departmentBreakdown?.[dept.id] || '0.00'}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Income</span>
                    <span className="text-green-600">SSP {(dashboardData as any)?.totalIncome || '0.00'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Insurance Income</h4>
                <div className="space-y-2 text-sm">
                  {(insuranceProviders || []).map((provider: any) => (
                    <div key={provider.id} className="flex justify-between">
                      <span className="text-gray-600">{provider.name}</span>
                      <span className="font-medium">
                        SSP {(dashboardData as any)?.insuranceBreakdown?.[provider.id] || '0.00'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Net Position</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Income</span>
                      <span className="font-medium text-green-600">${(dashboardData as any)?.totalIncome || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Expenses</span>
                      <span className="font-medium text-red-600">${(dashboardData as any)?.totalExpenses || '0.00'}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">Net Income</span>
                        <span className={`font-bold text-lg ${parseFloat((dashboardData as any)?.netIncome || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${(dashboardData as any)?.netIncome || '0.00'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-green-600 h-3 rounded-full" 
                            style={{ 
                              width: `${Math.max(0, Math.min(100, (parseFloat((dashboardData as any)?.netIncome || '0') / parseFloat((dashboardData as any)?.totalIncome || '1')) * 100))}%` 
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Profit Margin: {((parseFloat((dashboardData as any)?.netIncome || '0') / parseFloat((dashboardData as any)?.totalIncome || '1')) * 100).toFixed(1)}%
                        </p>
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
