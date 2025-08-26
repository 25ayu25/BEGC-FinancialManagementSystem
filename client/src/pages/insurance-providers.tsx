import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Shield, DollarSign, TrendingUp, TrendingDown, ArrowLeft, CalendarIcon } from "lucide-react";
import { Link, useLocation } from "wouter";

type Range = 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom';

export default function InsuranceProvidersPage() {
  const [location, navigate] = useLocation();

  // Read query string from the current location
  const search = useMemo(() => {
    const q = location.split('?')[1] ?? '';
    return new URLSearchParams(q);
  }, [location]);

  const initialRange = (search.get('range') as Range) ?? 'current-month';
  const initialYear = Number(search.get('year')) || new Date().getFullYear();
  const initialMonth = Number(search.get('month')) || (new Date().getMonth() + 1);

  const [timeRange, setTimeRange] = useState<Range>(initialRange);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Keep the URL in sync when user changes filters (shareable/bookmarkable)
  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('range', timeRange);
    qs.set('year', String(selectedYear));
    if (timeRange === 'current-month') {
      qs.set('month', String(selectedMonth));
    }
    navigate(`/insurance-providers?${qs.toString()}`, { replace: true });
  }, [timeRange, selectedYear, selectedMonth, navigate]);

  const isYearView = timeRange === 'year';

  const handleTimeRangeChange = (range: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom') => {
    setTimeRange(range);
    
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
      case 'year':
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
    }
  };

  const currentYear = selectedYear;
  const currentMonth = selectedMonth;

  // Calculate date ranges
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Get dashboard data for selected time range
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    }
  });

  // Get comparison data (previous period)
  const { data: comparisonData } = useQuery({
    queryKey: ["/api/dashboard/comparison", selectedYear, selectedMonth, timeRange],
    queryFn: async () => {
      // For comparison, get the previous period
      let compYear = selectedYear;
      let compMonth = selectedMonth;
      
      if (timeRange === 'current-month') {
        // Compare with last month
        const lastMonth = new Date(selectedYear, selectedMonth - 2);
        compYear = lastMonth.getFullYear();
        compMonth = lastMonth.getMonth() + 1;
      } else if (timeRange === 'last-month') {
        // Compare with current month
        compYear = new Date().getFullYear();
        compMonth = new Date().getMonth() + 1;
      }
      // For other ranges, we'll compare against the same period
      
      const url = `/api/dashboard/${compYear}/${compMonth}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: timeRange === 'current-month' || timeRange === 'last-month'
  });

  const insuranceBreakdown = (dashboardData as any)?.insuranceBreakdown || {};
  const prevInsuranceBreakdown = (comparisonData as any)?.insuranceBreakdown || {};
  
  // Calculate totals
  const totalSelectedUSD = Object.values(insuranceBreakdown).reduce((sum: number, value) => sum + parseFloat(value as string), 0);
  const totalComparisonUSD = Object.values(prevInsuranceBreakdown).reduce((sum: number, value) => sum + parseFloat(value as string), 0);
  
  // Calculate overall change
  const overallChange = totalComparisonUSD > 0 ? ((totalSelectedUSD - totalComparisonUSD) / totalComparisonUSD) * 100 : 0;

  // For year view, group insurance by month (similar to patient volume)
  const monthlyInsurance = useMemo(() => {
    if (!isYearView || !dashboardData?.transactions) return null;

    const buckets = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: format(new Date(selectedYear, i, 1), 'MMM'),
      totalUSD: 0,
      byProvider: {} as Record<string, number>,
    }));

    // Process transactions to group by month and provider
    for (const transaction of dashboardData.transactions || []) {
      if (!transaction.insuranceProvider) continue;
      
      const date = new Date(transaction.date);
      if (date.getFullYear() !== selectedYear) continue;
      
      const monthIndex = date.getMonth();
      const amountUSD = parseFloat(transaction.amount) || 0;
      
      buckets[monthIndex].totalUSD += amountUSD;
      buckets[monthIndex].byProvider[transaction.insuranceProvider] =
        (buckets[monthIndex].byProvider[transaction.insuranceProvider] ?? 0) + amountUSD;
    }
    
    return buckets;
  }, [isYearView, dashboardData?.transactions, selectedYear]);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Insurance Providers</h1>
              <p className="text-slate-600 mt-1">Detailed breakdown by insurance provider</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-[140px]">
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
              <div className="flex items-center gap-2">
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
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overview Card */}
      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">Insurance Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-xl font-bold text-slate-900">USD {Math.round(totalSelectedUSD as number).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Active Providers</p>
                <p className="text-xl font-bold text-slate-900">{Object.keys(insuranceBreakdown).length}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                {overallChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600">
                  vs {
                    timeRange === 'current-month' ? 'Last Month' :
                    timeRange === 'last-month' ? 'Current Month' :
                    timeRange === 'last-3-months' ? 'Previous Period' :
                    timeRange === 'year' ? 'Previous Period' :
                    'Previous Period'
                  }
                </p>
                <p className={`text-xl font-bold ${overallChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(insuranceBreakdown).map(([provider, amount]) => {
          const currentAmount = parseFloat(amount as string);
          const prevAmount = parseFloat(prevInsuranceBreakdown[provider] as string || '0');
          const change = prevAmount > 0 ? ((currentAmount - prevAmount) / prevAmount) * 100 : 0;
          const percentage = (totalSelectedUSD as number) > 0 ? (currentAmount / (totalSelectedUSD as number)) * 100 : 0;
          
          return (
            <Card key={provider} className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-50 p-1.5 rounded-lg">
                      <Shield className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{provider}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {percentage.toFixed(1)}% of total
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Revenue</span>
                    <span className="font-mono font-semibold text-slate-900">
                      USD {Math.round(currentAmount).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">
                      vs {
                        timeRange === 'current-month' ? 'Last Month' :
                        timeRange === 'last-month' ? 'Current Month' :
                        timeRange === 'last-3-months' ? 'Previous Period' :
                        timeRange === 'year' ? 'Previous Period' :
                        'Previous Period'
                      }
                    </span>
                    <span className={`text-sm font-medium ${
                      change > 0 ? 'text-emerald-600' :
                      change < 0 ? 'text-red-600' : 
                      'text-slate-500'
                    }`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </div>
                  
                  {prevAmount > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-500">
                        {
                          timeRange === 'current-month' ? 'Previous' :
                          timeRange === 'last-month' ? 'Current' :
                          'Previous Period'
                        }
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        USD {Math.round(prevAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {Object.keys(insuranceBreakdown).length === 0 && (
        <Card className="border-0 shadow-md bg-white">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Insurance Data</h3>
            <p className="text-slate-600">No insurance transactions found for the selected period.</p>
          </CardContent>
        </Card>
      )}

      {/* Monthly breakdown for year view */}
      {isYearView && monthlyInsurance && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Monthly Breakdown - {selectedYear}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {monthlyInsurance.map((m) => (
              <Card key={m.month} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{m.label} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xl font-semibold">USD {m.totalUSD.toLocaleString()}</div>
                  <div className="text-xs text-slate-600">By provider</div>
                  <ul className="text-sm space-y-1">
                    {Object.entries(m.byProvider).map(([name, val]) => (
                      <li key={name} className="flex justify-between">
                        <span className="truncate">{name}</span>
                        <span className="font-mono">USD {val.toLocaleString()}</span>
                      </li>
                    ))}
                    {Object.keys(m.byProvider).length === 0 && (
                      <li className="text-slate-500 text-xs">No insurance in this month</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}