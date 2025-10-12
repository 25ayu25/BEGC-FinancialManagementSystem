import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Users } from "lucide-react";
import { api } from "@/lib/queryClient";
import ExecutiveStyleKPIs from "@/components/dashboard/executive-style-kpis";
import SimpleTopDepartments from "@/components/dashboard/simple-top-departments";
import SimpleExpenseBreakdown from "@/components/dashboard/simple-expense-breakdown";
import MonthlyIncome from "@/components/dashboard/monthly-income";
import { Link } from "wouter";

type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

export default function Dashboard() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [timeRange, setTimeRange] = useState<TimeRange>("current-month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const thisYear = now.getFullYear();
  const years = useMemo(() => [thisYear, thisYear - 1, thisYear - 2], [thisYear]);
  const months = [
    { label: "January", value: 1 }, { label: "February", value: 2 }, { label: "March", value: 3 },
    { label: "April", value: 4 },   { label: "May", value: 5 },      { label: "June", value: 6 },
    { label: "July", value: 7 },    { label: "August", value: 8 },   { label: "September", value: 9 },
    { label: "October", value: 10 },{ label: "November", value: 11 },{ label: "December", value: 12 },
  ];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    const now = new Date();
    switch (range) {
      case "current-month":
        setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth() + 1); break;
      case "last-month": {
        const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        setSelectedYear(last.getFullYear()); setSelectedMonth(last.getMonth() + 1); break;
      }
      case "last-3-months":
        setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth() + 1); break;
      case "year":
        setSelectedYear(now.getFullYear()); setSelectedMonth(1); break;
      case "month-select":
      case "custom":
        break;
    }
  };

  // IMPORTANT FIX: treat last-month like a specific month for API calls
  const normalizedRange =
    timeRange === "month-select" || timeRange === "last-month"
      ? "current-month"
      : timeRange;

  const getPatientVolumeNavigation = () => {
    const now = new Date();
    switch (timeRange) {
      case "current-month": return { year: now.getFullYear(), month: now.getMonth() + 1 };
      case "last-month": {
        const last = new Date(now.getFullYear(), now.getMonth() - 1);
        return { year: last.getFullYear(), month: last.getMonth() + 1 };
      }
      case "last-3-months": {
        const threeAgo = new Date(now.getFullYear(), now.getMonth() - 2);
        return { year: threeAgo.getFullYear(), month: threeAgo.getMonth() + 1 };
      }
      case "year": return { year: now.getFullYear(), month: 1 };
      case "month-select": return { year: selectedYear, month: selectedMonth };
      case "custom":
        if (customStartDate) {
          return { year: customStartDate.getFullYear(), month: customStartDate.getMonth() + 1 };
        }
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
      default: return { year: selectedYear, month: selectedMonth };
    }
  };

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: [
      "/api/dashboard", selectedYear, selectedMonth, normalizedRange,
      customStartDate?.toISOString(), customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });

  const { data: periodPatientVolume = [] } = useQuery({
    queryKey: [
      "/api/patient-volume/period", selectedYear, selectedMonth, normalizedRange,
      customStartDate?.toISOString(), customEndDate?.toISOString(),
    ],
    queryFn: async () => {
      let url = `/api/patient-volume/period/${selectedYear}/${selectedMonth}?range=${normalizedRange}`;
      if (timeRange === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
      }
      try {
        const { data } = await api.get(url);
        return Array.isArray(data) ? data : [];
      } catch {
        console.warn("Patient volume unavailable for this period");
        return [];
      }
    },
  });

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-600">Daily operations at a glance</p>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Card><CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-semibold">Error Loading Dashboard</p>
              <p className="text-sm mt-2">Unable to fetch dashboard data. Please check your connection and try again.</p>
            </div>
          </CardContent></Card>
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
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6"><Skeleton className="h-20 w-full" /></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
            <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
          </div>
        </main>
      </div>
    );
  }

  const headerLabel =
    timeRange === "current-month" ? "Current month" :
    timeRange === "last-month" ? "Last month" :
    timeRange === "last-3-months" ? "Last 3 months" :
    timeRange === "year" ? "This year" :
    timeRange === "month-select" ? `${monthShort[(selectedMonth - 1) % 12]} ${selectedYear}` :
    timeRange === "custom" && customStartDate && customEndDate
      ? `${format(customStartDate, "MMM d, yyyy")} to ${format(customEndDate, "MMM d, yyyy")}`
      : "Custom period";

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header with Time Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">Overview</h1>
            <div className="mt-1 flex items-center gap-4">
              <p className="text-sm text-muted-foreground">Key financials · {headerLabel}</p>
              <Link
                href={`/patient-volume?view=monthly&year=${getPatientVolumeNavigation().year}&month=${getPatientVolumeNavigation().month}&range=${normalizedRange}`}
                className="inline-block"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors cursor-pointer min-h-[44px]">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span className="text-teal-600 text-sm font-medium font-variant-numeric-tabular">
                    {periodPatientVolume.reduce((sum: number, v: any) => sum + (v.patientCount || 0), 0)}{" "}
                    patients in selected period
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* RIGHT: range + optional pickers */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            <Select value={timeRange} onValueChange={(v: TimeRange) => handleTimeRangeChange(v)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Current Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="month-select">Select Month…</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === "month-select" && (
              <>
                <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                  <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent>
                </Select>

                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>{months.map((m) => (<SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>))}</SelectContent>
                </Select>
              </>
            )}

            {timeRange === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl" style={{ zIndex: 50000 }}>
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                  </PopoverContent>
                </Popover>

                <span aria-hidden className="text-muted-foreground">to</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" sideOffset={12} className="p-2 w-[280px] bg-white border border-gray-200 shadow-2xl" style={{ zIndex: 50000 }}>
                    <DatePicker mode="single" numberOfMonths={1} showOutsideDays={false} selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
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

        {/* NEW: Monthly Income (inserted under KPI band) */}
        <MonthlyIncome
          timeRange={timeRange}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimpleTopDepartments
            data={dashboardData?.departmentBreakdown || {}}
            departments={(departments as any) || []}
          />

          <SimpleExpenseBreakdown
            breakdown={(dashboardData as any)?.expenseBreakdown}
            total={parseFloat((dashboardData as any)?.totalExpenses || "0")}
            title="Expenses Breakdown"
            periodLabel={headerLabel}
          />
        </div>
      </main>
    </div>
  );
}
