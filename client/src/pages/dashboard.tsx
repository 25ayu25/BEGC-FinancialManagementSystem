import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, WifiOff, Clock, Plus, Upload, AlertTriangle } from "lucide-react";
import SimpleDashboardKPIs from "@/components/dashboard/simple-dashboard-kpis";
import SimpleDailyChart from "@/components/dashboard/simple-daily-chart";
import SimpleTopDepartments from "@/components/dashboard/simple-top-departments";
import SimpleQuickActions from "@/components/dashboard/simple-quick-actions";
import SimpleAlerts from "@/components/dashboard/simple-alerts";
import SimpleRecentTransactions from "@/components/dashboard/simple-recent-transactions";
import SimpleMonthlyFooter from "@/components/dashboard/simple-monthly-footer";

export default function Dashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [timeRange, setTimeRange] = useState<'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom'>('current-month');
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState(new Date());

  const handleTimeRangeChange = (range: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom') => {
    setTimeRange(range);
    
    // Auto-set dates based on preset selection
    const now = new Date();
    if (range === 'current-month') {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
    } else if (range === 'last-month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      setSelectedYear(lastMonth.getFullYear());
      setSelectedMonth(lastMonth.getMonth() + 1);
    } else if (range === 'year') {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(1); // January for year view
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${selectedYear}/${selectedMonth}?range=${timeRange}`, {
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
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Simple Dashboard</h1>
          <p className="text-slate-600">Daily operations at a glance</p>
        </div>
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
      <div className="flex-1 flex flex-col h-full bg-slate-50">
        {/* Simple Header with Skeleton */}
        <div className="bg-white border-b border-slate-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>
        
        {/* Loading Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Simplified Header with Time Range Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Simple Dashboard</h1>
            <p className="text-slate-600">Daily operations at a glance</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Time Range Preset Buttons */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                { key: 'current-month', label: 'Current Month' },
                { key: 'last-month', label: 'Last Month' },
                { key: 'last-3-months', label: 'Last 3 Months' },
                { key: 'year', label: 'Year' },
                { key: 'custom', label: 'Custom' }
              ].map((range) => (
                <button
                  key={range.key}
                  onClick={() => handleTimeRangeChange(range.key as any)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    timeRange === range.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker - Only show when Custom is selected */}
            {timeRange === 'custom' && (
              <select 
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  handleMonthChange(parseInt(year), parseInt(month));
                }}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  const value = `${selectedYear}-${month.toString().padStart(2, '0')}`;
                  const label = new Date(selectedYear, i).toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  });
                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Online Status Pill */}
            <Badge variant={isOnline ? "default" : "secondary"} className="flex items-center gap-2">
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
              {isOnline && (
                <span className="text-xs opacity-70">
                  • {lastSync.toLocaleTimeString()}
                </span>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 max-w-7xl mx-auto w-full">
        {/* KPI Band */}
        <SimpleDashboardKPIs data={dashboardData || {}} />

        {/* Visuals Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimpleDailyChart timeRange={timeRange} />
          <SimpleTopDepartments 
            data={dashboardData?.departmentBreakdown || {}} 
            departments={departments as any[] || []}
          />
        </div>

        {/* Operations Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SimpleQuickActions />
          <SimpleAlerts />
          <SimpleRecentTransactions transactions={dashboardData?.recentTransactions || []} />
        </div>

        {/* Footer Strip */}
        <SimpleMonthlyFooter data={dashboardData || {}} />
      </main>
    </div>
  );
}
