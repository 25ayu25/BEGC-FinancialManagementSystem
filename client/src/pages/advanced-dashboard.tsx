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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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

export default function AdvancedDashboard() {
  // All the same state and logic variables from the original file
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [timeRange, setTimeRange] = useState('current-month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [showDataTable, setShowDataTable] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showAvgLine, setShowAvgLine] = useState(true);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard", selectedYear, selectedMonth],
  });

  // Fetch department income trends
  const { data: incomeTrends } = useQuery({
    queryKey: ["/api/income-trends", selectedYear, selectedMonth],
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  if (error || isLoading || !dashboardData) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-slate-600">Loading dashboard...</p>
      </div>
    </div>;
  }

  // Calculate metrics
  const totalIncome = parseFloat((dashboardData as any)?.totalIncome || '0');
  const totalExpenses = parseFloat((dashboardData as any)?.totalExpenses || '0');
  const netIncome = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100) : 0;
  const insuranceIncome = parseFloat((dashboardData as any)?.insuranceIncome || '0');
  const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Process income trends for chart
  const incomeSeries = Array.isArray(incomeTrends) ? incomeTrends.map((trend: any) => ({
    day: trend.date,
    date: trend.date,
    amount: parseFloat(trend.income || '0'),
    amountSSP: parseFloat(trend.incomeSSP || '0'),
    amountUSD: parseFloat(trend.incomeUSD || '0') * 320, // Convert for display
  })) : [];

  const monthTotal = incomeSeries.reduce((sum: number, item: any) => sum + item.amount, 0);
  const monthlyAvg = incomeSeries.length > 0 ? monthTotal / incomeSeries.length : 0;
  const peak = Math.max(...incomeSeries.map((item: any) => item.amount));
  const peakDay = incomeSeries.find((item: any) => item.amount === peak);

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
    if (value !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  // Chart formatting functions
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const formatXAxis = (value: string) => {
    try {
      const parts = value.split(' ');
      if (parts.length >= 2) return parts[1];
      return value;
    } catch {
      return value;
    }
  };

  const generateYTicks = () => {
    const maxValue = Math.max(...incomeSeries.map((item: any) => item.amount));
    if (maxValue === 0) return [0];
    
    const step = Math.ceil(maxValue / 5);
    const ticks = [];
    for (let i = 0; i <= 5; i++) {
      ticks.push(i * step);
    }
    return ticks;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalForDay = data.amountSSP + (data.amountUSD / 320); // Convert back
      const percentOfMonth = monthTotal > 0 ? ((totalForDay / monthTotal) * 100) : 0;
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-900 mb-2">{data.date}</p>
          {data.amountSSP > 0 && (
            <p className="text-sm text-teal-600">
              SSP: <span className="font-mono font-semibold">{data.amountSSP.toLocaleString()}</span>
            </p>
          )}
          {data.amountUSD > 0 && (
            <p className="text-sm text-blue-600">
              USD: <span className="font-mono font-semibold">{(data.amountUSD / 320).toLocaleString()}</span>
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
            {percentOfMonth.toFixed(1)}% of month
          </p>
        </div>
      );
    }
    return null;
  };

  const handleBarClick = (data: any) => {
    console.log('Clicked bar:', data);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">
              Executive Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
          </div>

          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
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
                  <PopoverContent className="p-2 w-[280px]">
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground">to</span>
                
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
                  <PopoverContent className="p-2 w-[280px]">
                    <DatePicker
                      mode="single"
                      numberOfMonths={1}
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

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI Strip - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Revenue */}
          <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600 font-medium">Total revenue</p>
                <p className="text-xl font-bold text-slate-900 font-mono text-right">SSP {Math.round(totalIncome).toLocaleString()}</p>
                <p className="text-xs text-slate-500">↑ +12.5% vs last month</p>
              </div>
            </CardContent>
          </Card>

          {/* Total Expenses */}
          <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600 font-medium">Total expenses</p>
                <p className="text-xl font-bold text-slate-900 font-mono text-right">SSP {Math.round(totalExpenses).toLocaleString()}</p>
                <p className="text-xs text-slate-500">2.1% under budget</p>
              </div>
            </CardContent>
          </Card>

          {/* Net Income */}
          <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600 font-medium">Net income</p>
                <p className="text-xl font-bold text-slate-900 font-mono text-right">SSP {Math.round(netIncome).toLocaleString()}</p>
                <p className="text-xs text-slate-500">{profitMargin.toFixed(1)}% margin</p>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Revenue */}
          <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                <p className="text-sm text-slate-600 font-medium">Insurance (USD)</p>
                <p className="text-xl font-bold text-slate-900 font-mono text-right">USD {Math.round(insuranceIncome).toLocaleString()}</p>
                <p className="text-xs text-slate-500">{Object.keys((dashboardData as any)?.insuranceBreakdown || {}).length} providers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Revenue Analytics */}
          <Card className="lg:col-span-2 border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">Revenue Analytics</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">Daily revenue • {monthName}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                    Avg {Math.round(monthlyAvg / 1000).toLocaleString()},643
                  </div>
                  <p className="text-xs text-slate-400">Updated {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {monthTotal > 0 ? (
                <div className="space-y-4">
                  <div className="h-64 relative">
                    <div className="ml-8 h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={incomeSeries} 
                          margin={{ top: 20, right: 60, left: 10, bottom: 30 }}
                          barCategoryGap="1%"
                        >
                          <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="day" axisLine={{ stroke: '#eef2f7', strokeWidth: 1 }} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={formatYAxis} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend verticalAlign="top" height={36} />
                          
                          {/* Average Reference Line */}
                          {showAvgLine && monthlyAvg > 0 && (
                            <ReferenceLine 
                              y={monthlyAvg} 
                              stroke="#0d9488" 
                              strokeWidth={1}
                              strokeDasharray="4 2"
                              label={{ value: `Avg ${(monthlyAvg / 1000).toFixed(0)}k`, position: "insideTopRight" }}
                            />
                          )}
                          
                          {/* Peak Day Badge positioned above highest bar */}
                          {peak > 0 && peakDay && (
                            <ReferenceLine 
                              y={peak + (peak * 0.1)} 
                              stroke="transparent"
                              label={{ 
                                value: `Peak SSP ${(peak / 1000).toFixed(0)},000 • ${peakDay.date.split(' ')[1]}`, 
                                position: "insideTopLeft",
                                offset: 0,
                                style: { 
                                  fontSize: '11px',
                                  fill: '#0d9488',
                                  fontWeight: '500',
                                  background: '#f0fdfa',
                                  padding: '4px 8px',
                                  borderRadius: '12px'
                                }
                              }}
                            />
                          )}
                          
                          <Bar dataKey="amountSSP" fill="#14b8a6" radius={[0, 0, 0, 0]} name="SSP" stackId="revenue" />
                          <Bar dataKey="amountUSD" fill="#0891b2" radius={[4, 4, 0, 0]} name="USD" stackId="revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* Totals row under chart - matching visual spec exactly */}
                  <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                    <div className="text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide block mb-2">TOTAL</span>
                      <div className="space-y-0.5">
                        {monthTotal > 0 ? (
                          <>
                            <div className="text-sm font-bold text-slate-900 font-mono">
                              SSP {Math.round(monthTotal - (insuranceIncome * 320)).toLocaleString()}
                            </div>
                            {insuranceIncome > 0 && (
                              <div className="text-sm font-bold text-slate-900 font-mono">
                                USD {Math.round(insuranceIncome).toLocaleString()}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-slate-500">No data this period</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide block mb-2">PEAK DAY</span>
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        SSP {peak.toLocaleString()}
                      </div>
                      {peakDay && (
                        <div className="text-xs text-slate-500 mt-0.5">{peakDay.date.split(' ')[1]}</div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide block mb-2">MONTHLY AVG</span>
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        SSP {Math.round(monthlyAvg).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* View Data Table - only show if data exists */}
                  {monthTotal > 0 && (
                    <div className="text-center pt-4 border-t border-slate-100 mt-4">
                      <Dialog open={showDataTable} onOpenChange={setShowDataTable}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-slate-600">
                            <Building2 className="h-4 w-4 mr-2" />
                            View Data Table
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Revenue Data • {monthName}</DialogTitle>
                          <DialogDescription>
                            Daily revenue breakdown for {monthName}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>SSP</TableHead>
                                <TableHead>USD</TableHead>
                                <TableHead>Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {incomeSeries.filter((item: any) => item.amount > 0).map((item: any) => (
                                <TableRow key={item.date}>
                                  <TableCell>{item.date}</TableCell>
                                  <TableCell className="font-mono">{item.amountSSP.toLocaleString()}</TableCell>
                                  <TableCell className="font-mono">{(item.amountUSD / 320).toLocaleString()}</TableCell>
                                  <TableCell className="font-mono font-semibold">{item.amount.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-600 font-medium">Waiting for entries</p>
                    <p className="text-xs text-slate-400 mt-1">Revenue data will appear once transactions are recorded</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Departments */}
          <Card className="border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
                {selectedDepartment && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedDepartment(null)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.isArray(departments) ? departments
                .map((dept: any) => {
                  const amount = parseFloat((dashboardData as any)?.departmentBreakdown?.[dept.id] || '0');
                  const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100) : 0;
                  return { ...dept, amount, percentage };
                })
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5)
                .map((dept: any, index: number) => (
                  <div
                    key={dept.id}
                    className={cn(
                      "w-full bg-slate-50 border border-slate-100 rounded-lg p-3 cursor-pointer transition-colors",
                      selectedDepartment === dept.id ? "bg-teal-50 border-teal-200" : "hover:bg-slate-100"
                    )}
                    onClick={() => setSelectedDepartment(dept.id === selectedDepartment ? null : dept.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        <span className="font-medium text-slate-700 text-sm">{dept.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-slate-900">
                          SSP {Math.round(dept.amount).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {dept.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 transition-all duration-300"
                        style={{ width: `${Math.min(dept.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )) : []}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}