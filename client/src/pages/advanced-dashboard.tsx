import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  CalendarIcon,
  Building2,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  RefreshCw
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  Legend
} from 'recharts';

// Removed MonthSelector import - will create inline selector

export default function AdvancedDashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [timeRange, setTimeRange] = useState<'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom'>('current-month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const handleTimeRangeChange = (range: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom') => {
    setTimeRange(range);
    
    // For single month selections, set specific month
    // For multi-period selections, we'll let the backend handle the range
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
        // Keep current date for reference, but let backend calculate the range
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
    }
  };

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard', selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: () => {
      let url = `/api/dashboard/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      return fetch(url, { credentials: 'include' }).then(r => r.json());
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  const { data: rawIncome } = useQuery({
    queryKey: ['/api/income-trends', selectedYear, selectedMonth],
    queryFn: () =>
      fetch(`/api/income-trends/${selectedYear}/${selectedMonth}`).then(r => r.json()),
  });

  // Build a zero-filled daily series for the selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    amount: 0,
    amountUSD: 0,
    amountSSP: 0,
    label: `${i + 1}`,
    fullDate: new Date(selectedYear, selectedMonth - 1, i + 1).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }),
  }));

  if (Array.isArray(rawIncome)) {
    for (const r of rawIncome) {
      // Accept several shapes: {day}, {dateISO}, {date}
      let day = r.day;
      if (!day && r.dateISO) day = new Date(r.dateISO).getDate();
      if (!day && r.date) day = new Date(r.date).getDate();
      if (day >= 1 && day <= daysInMonth) {
        // Use new currency-specific fields
        incomeSeries[day - 1].amountUSD += Number(r.incomeUSD ?? 0);
        incomeSeries[day - 1].amountSSP += Number(r.incomeSSP ?? 0);
        incomeSeries[day - 1].amount += Number(r.income ?? r.amount ?? 0); // Total for backward compatibility
      }
    }
  }
  
  // Compute summary stats from the same series
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const monthTotal = incomeSeries.reduce((s, d) => s + d.amount, 0);
  const nonzeroDays = incomeSeries.filter(d => d.amount > 0).length;
  const monthlyAvg = nonzeroDays > 0 ? Math.round(monthTotalSSP / nonzeroDays) : 0;
  const peak = Math.max(...incomeSeries.map(d => d.amountSSP), 0);
  const showAvgLine = nonzeroDays >= 2; // Only show if 2+ non-zero days
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasSSP = data.amountSSP > 0;
      const hasUSD = data.amountUSD > 0;
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-medium text-slate-900 mb-1">{data.fullDate}</p>
          {hasSSP && <p className="text-sm text-slate-600">SSP {data.amountSSP.toLocaleString()}</p>}
          {hasUSD && <p className="text-sm text-slate-600">USD {data.amountUSD.toLocaleString()}</p>}
          {!hasSSP && !hasUSD && <p className="text-sm text-slate-500">No transactions</p>}
        </div>
      );
    }
    return null;
  };

  // Handle bar click to show day's transactions
  const handleBarClick = (data: any) => {
    if (data && data.amount > 0) {
      const sspPart = data.amountSSP > 0 ? `SSP ${data.amountSSP.toLocaleString()}` : '';
      const usdPart = data.amountUSD > 0 ? `USD ${data.amountUSD.toLocaleString()}` : '';
      const amounts = [sspPart, usdPart].filter(Boolean).join(' + ');
      console.log(`Opening transactions for ${data.fullDate} (Day ${data.day}) - ${amounts}`);
      // TODO: Implement side panel with filtered transactions for that day
    }
  };

  // Format Y-axis values - no SSP prefix on ticks
  const formatYAxis = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return `${Math.round(value)}`;
  };

  // Generate standard Y-axis ticks: 0, 20k, 40k, 60k, 80k
  const generateYTicks = () => {
    if (peak === 0) return [0, 20000, 40000, 60000, 80000];
    const maxNeeded = Math.max(peak * 1.2, 20000);
    const ticks = [0];
    for (let i = 20000; i <= maxNeeded + 20000; i += 20000) {
      ticks.push(i);
    }
    return ticks;
  };

  // Custom X-axis tick formatter - show key days and transaction days
  const formatXAxis = (tickItem: any, index: number) => {
    const day = parseInt(tickItem);
    
    // Always show days with transactions
    const dayData = incomeSeries.find(d => d.day === day);
    const hasTransaction = dayData && dayData.amount > 0;
    
    if (hasTransaction) {
      return day.toString();
    }
    
    // For months with many days, show strategic spacing
    if (daysInMonth <= 28) {
      // Show all days for shorter months
      return day.toString();
    } else if (daysInMonth <= 30) {
      // Show every 5th day for 29-30 day months, plus first and last
      return (day === 1 || day === daysInMonth || day % 5 === 0) ? day.toString() : '';
    } else {
      // Show every 5th day for 31-day months, plus first and last
      return (day === 1 || day === daysInMonth || day % 5 === 0) ? day.toString() : '';
    }
  };

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
    <div className="min-h-screen bg-white dark:bg-slate-900 p-6 dashboard-content">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Executive Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Track key financial metrics - {
              timeRange === 'current-month' ? 'Current month overview' :
              timeRange === 'last-month' ? 'Last month overview' :
              timeRange === 'last-3-months' ? 'Last 3 months overview' :
              timeRange === 'year' ? 'This year overview' :
              timeRange === 'custom' && customStartDate && customEndDate ? 
                `${format(customStartDate, 'MMM d, yyyy')} to ${format(customEndDate, 'MMM d, yyyy')}` :
                'Custom period overview'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3 relative">
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40 h-9 text-sm">
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
          
          {timeRange === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] h-9 justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="p-2 w-[280px] bg-white border border-slate-200 shadow-xl rounded-lg" 
                  align="start" 
                  side="bottom" 
                  sideOffset={12}
                  style={{ zIndex: 10000 }}
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
              
              <span className="text-slate-400 text-sm">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] h-9 justify-start text-left font-normal",
                      !customEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="p-2 w-[280px] bg-white border border-slate-200 shadow-xl rounded-lg" 
                  align="start" 
                  side="bottom" 
                  sideOffset={12}
                  style={{ zIndex: 10000 }}
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                <p className="text-lg font-semibold text-slate-900">SSP {Math.round(totalIncome).toLocaleString()}</p>
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

        {/* Total Expenses */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-lg font-semibold text-slate-900">SSP {Math.round(totalExpenses).toLocaleString()}</p>
                <div className="flex items-center mt-1 text-red-600">
                  <span className="text-xs font-medium">vs last month</span>
                </div>
              </div>
              <div className="bg-red-50 p-2 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Income */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Net Income</p>
                <p className="text-lg font-semibold text-slate-900">SSP {Math.round(netIncome).toLocaleString()}</p>
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
                <p className="text-lg font-semibold text-slate-900">USD {Math.round(insuranceIncome).toLocaleString()}</p>
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
                <p className="text-lg font-semibold text-slate-900">{patientVolume}</p>
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
        {/* Revenue Analytics */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Revenue Analytics</CardTitle>
                <p className="text-sm text-slate-600 mt-1">Daily revenue • {monthName}</p>
              </div>
              <Badge variant="outline" className="text-slate-600">Live Data</Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {monthTotal > 0 ? (
              <div className="space-y-0">
                {/* Professional Revenue Chart */}
                <div className="h-64 relative">
                  {/* Y-axis title */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 transform-gpu">
                    <span className="text-xs text-slate-500 font-medium">Revenue</span>
                  </div>
                  
                  <div className="ml-8 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={incomeSeries} 
                        margin={{ top: 20, right: 60, left: 10, bottom: 30 }}
                        barCategoryGap="1%"
                      >
                        <CartesianGrid 
                          strokeDasharray="1 1" 
                          stroke="#eef2f7" 
                          strokeWidth={0.5}
                          opacity={0.4}
                          vertical={false}
                        />
                        <XAxis 
                          dataKey="day"
                          axisLine={{ stroke: '#eef2f7', strokeWidth: 1 }}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          tickFormatter={formatXAxis}
                          interval={0}
                          angle={0}
                          height={40}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={formatYAxis}
                          domain={[0, Math.max(...generateYTicks())]}
                          ticks={generateYTicks()}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          verticalAlign="top" 
                          height={36}
                          iconType="rect"
                          wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
                        />
                        
                        {/* Monthly Average Reference Line */}
                        {showAvgLine && monthlyAvg > 0 && (
                          <ReferenceLine 
                            y={monthlyAvg} 
                            stroke="#0d9488" 
                            strokeWidth={1}
                            strokeDasharray="4 2"
                            label={{ 
                              value: `Avg SSP ${monthlyAvg.toLocaleString()}`, 
                              position: "insideTopRight", 
                              style: { fontSize: 10, fill: '#0d9488', fontWeight: 500 },
                              offset: 8
                            }}
                          />
                        )}
                        
                        <Bar 
                          dataKey="amountSSP" 
                          fill="#14b8a6"
                          radius={[0, 0, 0, 0]}
                          stroke="none"
                          style={{ cursor: 'pointer' }}
                          onClick={handleBarClick}
                          maxBarSize={18}
                          name="SSP"
                          stackId="revenue"
                        />
                        <Bar 
                          dataKey="amountUSD" 
                          fill="#0891b2"
                          radius={[4, 4, 0, 0]}
                          stroke="none"
                          style={{ cursor: 'pointer' }}
                          onClick={handleBarClick}
                          maxBarSize={18}
                          name="USD"
                          stackId="revenue"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Summary Stats Footer */}
                <div className="border-t border-slate-100 pt-4 grid grid-cols-3 gap-4">
                  <div className="flex flex-col text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                    <div className="space-y-1">
                      {monthTotalSSP > 0 && <span className="block text-sm font-bold text-slate-900">SSP {monthTotalSSP.toLocaleString()}</span>}
                      {monthTotalUSD > 0 && <span className="block text-sm font-bold text-slate-900">USD {monthTotalUSD.toLocaleString()}</span>}
                      {monthTotalSSP === 0 && monthTotalUSD === 0 && <span className="text-sm text-slate-500">No revenue</span>}
                    </div>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Peak Day</span>
                    <span className="text-lg font-bold text-slate-900">SSP {peak.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col text-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Monthly Avg</span>
                    <span className="text-lg font-bold text-slate-900">SSP {monthlyAvg.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium">No income recorded in {monthName}</p>
                  <p className="text-slate-500 text-xs mt-1">Add transactions to see analytics</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Departments */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">Top Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.isArray(departments) ? departments.slice(0, 5).map((dept: any, index: number) => {
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
            }) : []}
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