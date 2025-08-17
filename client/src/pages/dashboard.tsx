import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import KPICards from "@/components/dashboard/kpi-cards";
import IncomeChart from "@/components/dashboard/income-chart";
import DepartmentBreakdown from "@/components/dashboard/department-breakdown";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import QuickActions from "@/components/dashboard/quick-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${year}/${month}`, {
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
      <div className="flex-1 overflow-auto">
        <Header 
          title="Financial Dashboard" 
          subtitle={`Track daily income and expenses - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
        />
        <main className="p-6">
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
      <div className="flex-1 overflow-auto">
        <Header 
          title="Financial Dashboard" 
          subtitle={`Track daily income and expenses - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
        />
        <main className="p-6 space-y-8">
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
    <div className="flex-1 overflow-auto">
      <Header 
        title="Financial Dashboard" 
        subtitle={`Track daily income and expenses - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
      />
      
      <main className="p-6 space-y-8">
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
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} Financial Summary
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
                        ${(dashboardData as any)?.departmentBreakdown?.[dept.id] || '0.00'}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Income</span>
                    <span className="text-green-600">${(dashboardData as any)?.totalIncome || '0.00'}</span>
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
                        ${(dashboardData as any)?.insuranceBreakdown?.[provider.id] || '0.00'}
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
