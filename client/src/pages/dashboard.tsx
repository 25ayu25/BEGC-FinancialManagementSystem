'use client';

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Users } from "lucide-react";
import { api } from "@/lib/queryClient";
import ExecutiveStyleKPIs from "@/components/dashboard/executive-style-kpis";
import SimpleTopDepartments from "@/components/dashboard/simple-top-departments";
import SimpleExpenseBreakdown from "@/components/dashboard/simple-expense-breakdown";
import { Link } from "wouter";

// ---------- helpers ----------
type RangeMode = 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom' | 'pick-month';
const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function Dashboard() {
  const now = new Date();

  const [timeRange, setTimeRange] = useState<RangeMode>('current-month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // avoid hydration mismatch when reading Date on server
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const years = useMemo(
    () => Array.from({ length: 7 }, (_, i) => now.getFullYear() - i),
    [now]
  );

  const handleTimeRangeChange = (range: RangeMode) => {
    setTimeRange(range);
    const d = new Date();
    if (range === 'current-month') {
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth() + 1);
    } else if (range === 'last-month') {
      const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      setSelectedYear(lm.getFullYear());
      setSelectedMonth(lm.getMonth() + 1);
    } else if (range === 'last-3-months') {
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth() + 1);
    } else if (range === 'year') {
      setSelectedYear(d.getFullYear());
      setSelectedMonth(1); // January placeholder
    }
    // 'pick-month' and 'custom' keep current selections / custom dates
  };

  const patientNav = () => {
    const d = new Date();
    switch (timeRange) {
      case 'current-month': return { year: d.getFullYear(), month: d.getMonth() + 1 };
      case 'last-month': {
        const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        return { year: lm.getFullYear(), month: lm.getMonth() + 1 };
      }
      case 'last-3-months': {
        const threeAgo = new Date(d.getFullYear(), d.getMonth() - 2, 1);
        return { year: threeAgo.getFullYear(), month: threeAgo.getMonth() + 1 };
      }
      case 'year': return { year: d.getFullYear(), month: 1 };
      case 'custom':
        return customStartDate
          ? { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 }
          : { year: selectedYear, month: selectedMonth };
      case 'pick-month':
      default:
        return { year: selectedYear, month: selectedMonth };
    }
  };

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: [
      "/api/dashboard",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString()
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      const response = await api.get(url);
      return response.data;
    },
    enabled: ready
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"], enabled: ready });
  const { data: insuranceProviders } = useQuery({ queryKey: ["/api/insurance-providers"], enabled: ready });

  const { data: periodPatientVolume = [] } = useQuery({
    queryKey: [
      "/api/patient-volume/period",
      selectedYear,
      selectedMonth,
      timeRange,
      customStartDate?.toISOString(),
      customEndDate?.toISOString()
    ],
    queryFn: async () => {
      let url = `/api/patient-volume/period/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      try {
        const response = await api.get(url);
        return Array.isArray(response.data) ? response.data : [];
      } catch {
        console.warn('Patient volume unavailable for this period');
        return [];
      }
    },
    enabled: ready
  });

  if (!ready) return null;

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
        <div className="bg-white border-b border-slate-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>
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
      {/* Header w/ filters */}
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
                  timeRange === 'pick-month' ? `${monthNames[selectedMonth-1]} ${selectedYear}` :
                  timeRange === 'custom' && customStartDate && customEndDate
                    ? `${format(customStartDate, 'MMM d, yyyy')} to ${format(customEndDate, 'MMM d, yyyy')}`
                    : 'Custom period'
                }
              </p>

              {/* Patient Volume Chip */}
              <Link
                href={`/patient-volume?view=monthly&year=${patientNav().year}&month=${patientNav().month}&range=${timeRange}`}
                className="inline-block"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors cursor-pointer min-h-[36px]">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-teal-600 text-sm font-medium tabular-nums">
                    {timeRange === 'current-month' ? 'Current month' :
                     timeRange === 'last-month' ? 'Last month' : 'Selected period'}
                    : {periodPatientVolume.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0)} patients
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2 relative z-10">
            {/* Range mode */}
            <Select value={timeRange} onValueChange={(v: RangeMode) => handleTimeRangeChange(v)}>
              <SelectTrigger className="h-9 w-[160px]" aria-label="Select period mode">
                <SelectValue placeholder="Select period…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="pick-month">Select Month…</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Year selector */}
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
              disabled={!(timeRange === 'pick-month' || timeRange === 'custom' || timeRange === 'year')}
            >
              <SelectTrigger className="h-9 w-[110px]" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Month selector */}
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}
              disabled={!(timeRange === 'pick-month' || timeRange === 'custom')}
            >
              <SelectTrigger className="h-9 w-[140px]" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((m, idx) => (
                  <SelectItem key={m} value={String(idx + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom range pickers */}
            {timeRange === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("h-9 justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl z-[50000]"
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
                      className={cn("h-9 justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom" align="start" sideOffset={12}
                    className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl z-[50000]"
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
        <ExecutiveStyleKPIs data={dashboardData || {}} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimpleTopDepartments
            data={dashboardData?.departmentBreakdown || {}}
            departments={(departments as any) || []}
          />

          <SimpleExpenseBreakdown
            breakdown={(dashboardData as any)?.expenseBreakdown}
            total={parseFloat((dashboardData as any)?.totalExpenses || "0")}
            title="Expenses Breakdown"
            periodLabel={
              timeRange === "current-month" ? "Current month" :
              timeRange === "last-month" ? "Last month" :
              timeRange === "last-3-months" ? "Last 3 months" :
              timeRange === "year" ? "This year" :
              timeRange === "pick-month" ? `${monthNames[selectedMonth-1]} ${selectedYear}` :
              timeRange === "custom" && customStartDate && customEndDate
                ? `${customStartDate.toLocaleDateString()} to ${customEndDate.toLocaleDateString()}`
                : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
