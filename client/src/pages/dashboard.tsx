import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Users, Calendar } from "lucide-react";
import { api } from "@/lib/queryClient";
import ExecutiveStyleKPIs from "@/components/dashboard/executive-style-kpis";

import SimpleTopDepartments from "@/components/dashboard/simple-top-departments";

import SimpleRecentTransactions from "@/components/dashboard/simple-recent-transactions";
import SimpleMonthlyFooter from "@/components/dashboard/simple-monthly-footer";
import { Link } from "wouter";

export default function Dashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [timeRange, setTimeRange] = useState<'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom'>('current-month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const handleTimeRangeChange = (range: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom') => {
    setTimeRange(range);
    
    // Auto-set appropriate dates based on selection
    const now = new Date();
    switch(range) {
      case 'current-month':
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        setSelectedYear(lastMonth.getFullYear());
        setSelectedMonth(lastMonth.getMonth() + 1);
        break;
      case 'last-3-months':
        // For last 3 months, use current month but let the backend handle the 3-month range
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
      case 'year':
        setSelectedYear(now.getFullYear());
        setSelectedMonth(1); // January for year view
        break;
    }
  };

  // Function to determine the correct year/month for patient volume navigation
  const getPatientVolumeNavigation = () => {
    const now = new Date();
    switch(timeRange) {
      case 'current-month':
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        return { year: lastMonth.getFullYear(), month: lastMonth.getMonth() + 1 };
      case 'last-3-months':
        // Navigate to the start of the 3-month period (3 months ago)
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2);
        return { year: threeMonthsAgo.getFullYear(), month: threeMonthsAgo.getMonth() + 1 };
      case 'year':
        return { year: now.getFullYear(), month: 1 }; // January
      case 'custom':
        if (customStartDate) {
          return { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 };
        }
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
      default:
        return { year: selectedYear, month: selectedMonth };
    }
  };

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      const response = await api.get(url);
      return response.data;
    }
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ["/api/insurance-providers"],
  });

  // Get patient volume for the selected time period
  const { data: periodPatientVolume = [] } = useQuery({
    queryKey: ["/api/patient-volume/period", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/patient-volume/period/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      try {
        const response = await api.get(url);
        return response.data;
      } catch (error) {
        return [];
      }
    }
  });



  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
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
              <Skeleton className="h-8 w-32 mb-2" />
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">Overview</h1>
            <div className="mt-1 flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Key financials · {
                  timeRange === 'current-month' ? 'Current month' :
                  timeRange === 'last-month' ? 'Last month' :
                  timeRange === 'last-3-months' ? 'Last 3 months' :
                  timeRange === 'year' ? 'This year' :
                  timeRange === 'custom' && customStartDate && customEndDate ? 
                    `${format(customStartDate, 'MMM d, yyyy')} to ${format(customEndDate, 'MMM d, yyyy')}` :
                    'Custom period'
                }
              </p>
              {/* Patient Volume Chip - Clickable */}
              <Link href={`/patient-volume?view=monthly&year=${getPatientVolumeNavigation().year}&month=${getPatientVolumeNavigation().month}&range=${timeRange}`} className="inline-block">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors cursor-pointer min-h-[44px]">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-teal-600 text-sm font-medium font-variant-numeric-tabular">
                    {timeRange === 'current-month' ? 'Current month' : 
                     timeRange === 'last-month' ? 'Last month' : 
                     'Selected period'}: {periodPatientVolume.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0)} patients
                  </span>
                </div>
              </Link>
            </div>
          </div>
          
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            {/* Time Period Dropdown */}
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Range Controls */}
            {timeRange === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="bottom" 
                    align="start" 
                    sideOffset={12} 
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: 'rgb(255, 255, 255)' }}
                    avoidCollisions={true}
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
                      showOutsideDays={false}
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span aria-hidden="true" className="text-muted-foreground">to</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="bottom" 
                    align="start" 
                    sideOffset={12} 
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl"
                    style={{ zIndex: 50000, backgroundColor: 'rgb(255, 255, 255)' }}
                    avoidCollisions={true}
                    collisionPadding={15}
                  >
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
                      showOutsideDays={false}
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Band - Executive Style */}
        <ExecutiveStyleKPIs 
          data={dashboardData || {}} 
          timeRange={timeRange}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />


        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments Chart */}
          <SimpleTopDepartments 
            data={dashboardData?.departmentBreakdown || {}} 
            departments={(departments as any) || []}
          />

          {/* Recent Transactions */}
          <SimpleRecentTransactions transactions={dashboardData?.recentTransactions || []} />
        </div>


      </main>
    </div>
  );
}
