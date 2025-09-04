import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { api } from "@/lib/queryClient";
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

// Revenue Data Table Component
interface DetailedTransaction {
  id: string;
  date: string;
  fullDate: string;
  amount: number;
  currency: string;
  departmentId: string;
  departmentName: string;
  description: string;
}

interface RevenueDataTableProps {
  data: Array<{
    day: number;
    amount: number;
    amountSSP: number;
    amountUSD: number;
    label: string;
    fullDate: string;
  }>;
  departments: any[];
  monthName: string;
  selectedYear: number;
  selectedMonth: number;
  onClose: () => void;
}

type SortField = 'date' | 'ssp' | 'usd' | 'total' | 'department';
type SortDirection = 'asc' | 'desc';

function RevenueDataTable({ data, departments, monthName, selectedYear, selectedMonth, onClose }: RevenueDataTableProps) {
  // Fetch detailed transaction data for the table
  const { data: detailedTransactions, isLoading: isLoadingDetailed } = useQuery({
    queryKey: ['/api/detailed-transactions', selectedYear, selectedMonth],
    enabled: true,
  }) as { data: DetailedTransaction[] | undefined, isLoading: boolean };

  // Use detailed transactions if available, otherwise fallback to aggregated data
  const tableData = detailedTransactions || [];
  const showDepartmentColumn = true; // Always show department column now
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...tableData].sort((a, b) => {
    let aVal: any, bVal: any;
    
    switch (sortField) {
      case 'date':
        aVal = new Date(a.fullDate).getTime();
        bVal = new Date(b.fullDate).getTime();
        break;
      case 'ssp':
        aVal = a.currency === 'SSP' ? a.amount : 0;
        bVal = b.currency === 'SSP' ? b.amount : 0;
        break;
      case 'usd':
        aVal = a.currency === 'USD' ? a.amount : 0;
        bVal = b.currency === 'USD' ? b.amount : 0;
        break;
      case 'total':
        aVal = a.amount;
        bVal = b.amount;
        break;
      case 'department':
        aVal = a.departmentName;
        bVal = b.departmentName;
        break;
      default:
        aVal = a.fullDate;
        bVal = b.fullDate;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totals = {
    ssp: tableData.reduce((sum, row) => sum + (row.currency === 'SSP' ? row.amount : 0), 0),
    usd: tableData.reduce((sum, row) => sum + (row.currency === 'USD' ? row.amount : 0), 0),
    total: tableData.reduce((sum, row) => sum + (row.currency === 'SSP' ? row.amount : 0), 0) // Only SSP for total
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-3 w-3 text-slate-600" /> : 
      <ArrowDown className="h-3 w-3 text-slate-600" />;
  };

  const exportCSV = () => {
    const headers = ['Department', 'Date', 'SSP', 'USD', 'Total', 'Description'];
    const csvData = [
      headers.join(','),
      ...sortedData.map(row => {
        const sspAmount = row.currency === 'SSP' ? row.amount : 0;
        const usdAmount = row.currency === 'USD' ? row.amount : 0;
        const values = [
          `"${row.departmentName}"`,
          `"${row.fullDate}"`,
          Math.round(sspAmount).toLocaleString(),
          usdAmount.toLocaleString(),
          Math.round(sspAmount + usdAmount).toLocaleString(),
          `"${row.description}"`
        ];
        return values.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RevenueRows_${monthName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoadingDetailed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <Building2 className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (tableData.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-slate-600 text-sm font-medium mb-4">No rows for this range</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Change dates</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Table Container */}
      <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white dark:bg-slate-800">
        <Table>
          <TableHeader className="sticky top-0 bg-white dark:bg-slate-800 z-10">
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('department')} className="font-semibold h-8 p-1">
                  Department {getSortIcon('department')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('date')} className="font-semibold h-8 p-1">
                  Date {getSortIcon('date')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('ssp')} className="font-semibold h-8 p-1 ml-auto">
                  SSP {getSortIcon('ssp')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('usd')} className="font-semibold h-8 p-1 ml-auto">
                  USD {getSortIcon('usd')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('total')} className="font-semibold h-8 p-1 ml-auto">
                  Total {getSortIcon('total')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, index) => (
              <TableRow key={row.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <TableCell className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  {row.departmentName}
                </TableCell>
                <TableCell className="text-sm font-medium">{row.fullDate}</TableCell>
                <TableCell className="text-sm font-mono tabular-nums text-right">
                  {row.currency === 'SSP' ? Math.round(row.amount).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-sm font-mono tabular-nums text-right">
                  {row.currency === 'USD' ? row.amount.toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-sm font-mono tabular-nums text-right font-semibold">
                  {Math.round(row.amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            
            {/* Sticky Totals Row */}
            <TableRow className="bg-slate-100 dark:bg-slate-700 border-t-2 border-slate-300 dark:border-slate-600 font-semibold sticky bottom-0">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-sm font-mono tabular-nums text-right font-bold">
                {Math.round(totals.ssp).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm font-mono tabular-nums text-right font-bold">
                {totals.usd.toLocaleString()}
              </TableCell>
              <TableCell className="text-sm font-mono tabular-nums text-right font-bold">
                {Math.round(totals.ssp).toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      
      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="text-sm text-slate-500">
          {tableData.length} transaction{tableData.length !== 1 ? 's' : ''} • SSP Total: {Math.round(totals.ssp).toLocaleString()} • USD Total: {totals.usd.toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdvancedDashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [timeRange, setTimeRange] = useState<'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom'>('current-month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showDataTable, setShowDataTable] = useState(false);
  const [showAllDepartments, setShowAllDepartments] = useState(false);

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
        // For last 3 months, use 3 months back as reference to get the main financial period
        const threeMonthsBack = new Date(now.getFullYear(), now.getMonth() - 3);
        setSelectedYear(threeMonthsBack.getFullYear());
        setSelectedMonth(threeMonthsBack.getMonth() + 1);
        break;
      case 'year':
        // Keep current date for reference, but let backend calculate the range
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        break;
    }
  };

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard', selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/dashboard?year=${selectedYear}&month=${selectedMonth}&range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['/api/departments'],
  });

  // Function to determine the correct navigation for patient volume based on time range
  const getPatientVolumeNavigation = () => {
    const currentDate = new Date();
    
    switch(timeRange) {
      case 'current-month':
        return { 
          year: currentDate.getFullYear(), 
          month: currentDate.getMonth() + 1 
        };
      case 'last-month':
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        return { 
          year: lastMonth.getFullYear(), 
          month: lastMonth.getMonth() + 1 
        };
      case 'last-3-months':
        // Go to the start of the 3-month period (June)
        const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2);
        return { 
          year: threeMonthsAgo.getFullYear(), 
          month: threeMonthsAgo.getMonth() + 1 
        };
      case 'year':
        return { 
          year: currentDate.getFullYear(), 
          month: 1 // January
        };
      case 'custom':
        return customStartDate ? { 
          year: customStartDate.getFullYear(), 
          month: customStartDate.getMonth() + 1 
        } : { 
          year: currentDate.getFullYear(), 
          month: currentDate.getMonth() + 1 
        };
      default:
        return { 
          year: currentDate.getFullYear(), 
          month: currentDate.getMonth() + 1 
        };
    }
  };

  const { data: rawIncome } = useQuery({
    queryKey: ['/api/income-trends', selectedYear, selectedMonth, timeRange, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      let url = `/api/income-trends/${selectedYear}/${selectedMonth}?range=${timeRange}`;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  // Build income series based on the selected range
  let incomeSeries = [];
  let monthName = '';
  
  if (timeRange === 'custom' && customStartDate && customEndDate && Array.isArray(rawIncome)) {
    // For custom date range, create series from the API response dates
    monthName = `${format(customStartDate, 'MMM d, yyyy')} - ${format(customEndDate, 'MMM d, yyyy')}`;
    
    // Create a map from the API response
    const dataMap = new Map();
    for (const r of rawIncome) {
      const dateStr = r.date; // "Jun 1", "Jul 15", etc.
      dataMap.set(dateStr, {
        amount: Number(r.income ?? r.amount ?? 0),
        amountUSD: Number(r.incomeUSD ?? 0),
        amountSSP: Number(r.incomeSSP ?? 0),
        dateStr: dateStr
      });
    }
    
    // Build series from the API data
    incomeSeries = rawIncome.map((r, index) => {
      const totalIncome = Number(r.income ?? r.amount ?? 0);
      return {
        day: index + 1, // Sequential numbering for chart
        amount: totalIncome,
        // For custom date range, assume all income is SSP unless specified otherwise
        amountUSD: Number(r.incomeUSD ?? 0),
        amountSSP: Number(r.incomeSSP ?? totalIncome), // Default to SSP if no breakdown provided
        label: r.date, // "Jun 1", "Jul 15", etc.
        fullDate: r.date,
      };
    });
  } else {
    // For single month ranges, use the existing logic
    const displayYear = selectedYear;
    const displayMonth = selectedMonth;
    const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();
    monthName = new Date(displayYear, displayMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    incomeSeries = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: 0,
      amountUSD: 0,
      amountSSP: 0,
      label: `${i + 1}`,
      fullDate: new Date(displayYear, displayMonth - 1, i + 1).toLocaleDateString('en-US', { 
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
  }
  
  // Compute summary stats from the same series (currency-separated)
  const monthTotalSSP = incomeSeries.reduce((s, d) => s + d.amountSSP, 0);
  const monthTotalUSD = incomeSeries.reduce((s, d) => s + d.amountUSD, 0);
  const nonzeroDaysSSP = incomeSeries.filter(d => d.amountSSP > 0).length;
  const monthlyAvgSSP = nonzeroDaysSSP > 0 ? Math.round(monthTotalSSP / nonzeroDaysSSP) : 0;
  const peakSSP = Math.max(...incomeSeries.map(d => d.amountSSP), 0);
  const peakDaySSP = incomeSeries.find(d => d.amountSSP === peakSSP);
  const showAvgLine = nonzeroDaysSSP >= 2; // Only show if 2+ non-zero days
  
  // Enhanced tooltip component with context
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasSSP = data.amountSSP > 0;
      const hasUSD = data.amountUSD > 0;
      const totalAmount = data.amount;
      const shareOfMonth = (monthTotalSSP + monthTotalUSD) > 0 ? ((totalAmount / (monthTotalSSP + monthTotalUSD)) * 100) : 0;
      
      // Calculate MTD total up to this point
      const dayIndex = incomeSeries.findIndex(d => d.day === data.day);
      const mtdTotal = incomeSeries.slice(0, dayIndex + 1).reduce((sum, d) => sum + d.amount, 0);
      
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[200px]">
          <p className="font-semibold text-slate-900 mb-2">{data.fullDate}</p>
          {hasSSP && <p className="text-sm text-slate-700 font-mono">SSP {data.amountSSP.toLocaleString()}</p>}
          {hasUSD && <p className="text-sm text-slate-700 font-mono">USD {data.amountUSD.toLocaleString()}</p>}
          {totalAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">Share of period: {shareOfMonth.toFixed(1)}%</p>
              <p className="text-xs text-slate-500">MTD total: SSP {mtdTotal.toLocaleString()}</p>
            </div>
          )}
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

  // Generate Y-axis ticks: 0, 10k, 20k, 30k, 40k
  const generateYTicks = () => {
    const peak = Math.max(...incomeSeries.map(d => d.amountSSP), 0);
    if (peak === 0) return [0, 10000, 20000, 30000, 40000];
    const maxNeeded = Math.max(peak * 1.2, 10000);
    const ticks = [0];
    for (let i = 10000; i <= maxNeeded + 10000; i += 10000) {
      ticks.push(i);
    }
    return ticks;
  };

  // Custom X-axis tick formatter
  const formatXAxis = (tickItem: any, index: number) => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      // For custom date ranges, show the date labels directly
      const dayData = incomeSeries[index];
      if (!dayData) return '';
      
      // Show dates with transactions, plus strategic spacing
      const hasTransaction = dayData.amount > 0;
      if (hasTransaction) {
        return dayData.label;
      }
      
      // Show every 7th day for readability in custom ranges
      return index % 7 === 0 ? dayData.label : '';
    } else {
      // Single month logic
      const day = parseInt(tickItem);
      const dayData = incomeSeries.find(d => d.day === day);
      const hasTransaction = dayData && dayData.amount > 0;
      
      if (hasTransaction) {
        return day.toString();
      }
      
      const daysInCurrentMonth = incomeSeries.length;
      if (daysInCurrentMonth <= 28) {
        return day.toString();
      } else if (daysInCurrentMonth <= 30) {
        return (day === 1 || day === daysInCurrentMonth || day % 5 === 0) ? day.toString() : '';
      } else {
        return (day === 1 || day === daysInCurrentMonth || day % 5 === 0) ? day.toString() : '';
      }
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

  // Use the backend-separated currency amounts to prevent mixing
  const sspIncome = parseFloat(dashboardData?.totalIncomeSSP || '0');
  const usdIncome = parseFloat(dashboardData?.totalIncomeUSD || '0');
  const totalExpenses = parseFloat(dashboardData?.totalExpenses || '0');
  const netIncome = parseFloat(dashboardData?.netIncome || '0');
  
  const sspRevenue = monthTotalSSP || sspIncome;
  
  // Calculate correct SSP-only net income
  const sspNetIncome = sspRevenue - totalExpenses;

  const profitMargin = sspRevenue > 0 ? ((sspNetIncome / sspRevenue) * 100) : 0;
  // Remove hardcoded values - use real data only
  const hasRealData = sspIncome > 0 || usdIncome > 0 || totalExpenses > 0;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 dashboard-content">
      <header className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:items-start md:gap-x-8">
          {/* Left: title + subtitle */}
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-white">
              Executive Dashboard
            </h1>
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

            </div>
          </div>

          {/* Right: controls (moved away from title) */}
          <div className="mt-2 md:mt-0 flex flex-wrap items-center justify-end gap-2">
            {/* Period select */}
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

            {/* Date range controls */}
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
        {/* Total Revenue */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Revenue</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">SSP {Math.round(sspRevenue).toLocaleString()}</p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.incomeChangeSSP !== undefined && (
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.incomeChangeSSP > 0 ? 'text-emerald-600' :
                      dashboardData.changes.incomeChangeSSP < 0 ? 'text-red-600' : 
                      'text-slate-500'
                    }`}>
                      {dashboardData.changes.incomeChangeSSP > 0 ? '+' : ''}{dashboardData.changes.incomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.incomeChangeSSP !== undefined && dashboardData.changes.incomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Total Expenses</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">SSP {Math.round(totalExpenses).toLocaleString()}</p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.expenseChangeSSP !== undefined && (
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.expenseChangeSSP > 0 ? 'text-red-600' :
                      dashboardData.changes.expenseChangeSSP < 0 ? 'text-emerald-600' : 
                      'text-slate-500'
                    }`}>
                      {dashboardData.changes.expenseChangeSSP > 0 ? '+' : ''}{dashboardData.changes.expenseChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-red-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.expenseChangeSSP !== undefined && dashboardData.changes.expenseChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Income */}
        <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
          <CardContent className="p-4 sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-medium">Net Income</p>
                <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">SSP {Math.round(sspNetIncome).toLocaleString()}</p>
                <div className="flex items-center mt-1">
                  {dashboardData?.changes?.netIncomeChangeSSP !== undefined && (
                    <span className={`text-xs font-medium ${
                      dashboardData.changes.netIncomeChangeSSP > 0 ? 'text-emerald-600' :
                      dashboardData.changes.netIncomeChangeSSP < 0 ? 'text-red-600' : 
                      'text-slate-500'
                    }`}>
                      {dashboardData.changes.netIncomeChangeSSP > 0 ? '+' : ''}{dashboardData.changes.netIncomeChangeSSP.toFixed(1)}% vs last month
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg">
                {dashboardData?.changes?.netIncomeChangeSSP !== undefined && dashboardData.changes.netIncomeChangeSSP < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <DollarSign className="h-4 w-4 text-blue-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Revenue */}
        <Link href={`/insurance-providers?range=${timeRange}${timeRange === 'custom' && customStartDate && customEndDate ? `&startDate=${format(customStartDate, 'yyyy-MM-dd')}&endDate=${format(customEndDate, 'yyyy-MM-dd')}` : ''}`}>
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Insurance (USD)</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">USD {Math.round(usdIncome).toLocaleString()}</p>
                  <div className="flex items-center mt-1">
                    {dashboardData?.changes?.incomeChangeUSD !== undefined ? (
                      <span className={`text-xs font-medium ${
                        dashboardData.changes.incomeChangeUSD > 0 ? 'text-emerald-600' :
                        dashboardData.changes.incomeChangeUSD < 0 ? 'text-red-600' : 
                        'text-slate-500'
                      }`}>
                        {dashboardData.changes.incomeChangeUSD > 0 ? '+' : ''}{dashboardData.changes.incomeChangeUSD.toFixed(1)}% vs last month
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-purple-600">
                        {Object.keys(dashboardData?.insuranceBreakdown || {}).length === 1 ? '1 provider' : `${Object.keys(dashboardData?.insuranceBreakdown || {}).length} providers`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-purple-50 p-1.5 rounded-lg">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Patient Volume */}
        <Link href={`/patient-volume?view=monthly&year=${getPatientVolumeNavigation().year}&month=${getPatientVolumeNavigation().month}&range=${timeRange}`}>
          <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4 sm:p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs font-medium">Total Patients</p>
                  <p className="text-base font-semibold text-slate-900 font-mono tabular-nums">{(dashboardData?.totalPatients || 0).toLocaleString()}</p>
                  <div className="flex items-center mt-1">
                    <span className="text-xs font-medium text-teal-600">
                      Current period
                    </span>
                  </div>
                </div>
                <div className="bg-teal-50 p-1.5 rounded-lg">
                  <Users className="h-4 w-4 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Analytics */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-slate-900">Revenue Analytics</CardTitle>
              </div>

            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {(monthTotalSSP > 0 || monthTotalUSD > 0) ? (
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
                          stroke="#f1f5f9" 
                          strokeWidth={0.3}
                          opacity={0.3}
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
                        {showAvgLine && monthlyAvgSSP > 0 && (
                          <ReferenceLine 
                            y={monthlyAvgSSP} 
                            stroke="#0d9488" 
                            strokeWidth={1}
                            strokeDasharray="4 2"
                            label={{ 
                              value: `Avg ${(monthlyAvgSSP / 1000).toFixed(0)}k`, 
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
                <div className="border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Total</span>
                      <div className="space-y-1">
                        {monthTotalSSP > 0 && <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">SSP {monthTotalSSP.toLocaleString()}</span>}
                        {monthTotalUSD > 0 && <span className="block text-sm font-bold text-slate-900 font-mono tabular-nums">USD {monthTotalUSD.toLocaleString()}</span>}
                        {monthTotalSSP === 0 && monthTotalUSD === 0 && <span className="text-sm text-slate-500">No revenue in this range</span>}
                      </div>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Peak Day</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {peakSSP.toLocaleString()}</span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">Peak</Badge>
                      </div>
                      {peakDaySSP && <span className="text-xs text-slate-500 mt-1">{peakDaySSP.fullDate}</span>}
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Monthly Avg</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">SSP {monthlyAvgSSP.toLocaleString()}</span>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">Avg</Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Data Table Toggle */}
                  <div className="flex justify-center mt-4 pt-3 border-t border-slate-100">
                    {(monthTotalSSP > 0 || monthTotalUSD > 0) ? (
                      <Dialog open={showDataTable} onOpenChange={setShowDataTable}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-slate-600" data-testid="button-data-table">
                            <Building2 className="h-4 w-4 mr-2" />
                            View Data Table
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900">
                          <DialogHeader>
                            <DialogTitle>Revenue Data • {monthName}</DialogTitle>
                            <DialogDescription>
                              Daily revenue breakdown • Updated {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </DialogDescription>
                          </DialogHeader>
                          <RevenueDataTable 
                            data={incomeSeries.filter(d => d.amountSSP > 0 || d.amountUSD > 0)} 
                            departments={Array.isArray(departments) ? departments : []}
                            monthName={monthName}
                            selectedYear={selectedYear}
                            selectedMonth={selectedMonth}
                            onClose={() => setShowDataTable(false)}
                          />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Button variant="outline" size="sm" className="text-slate-400 cursor-not-allowed" disabled title="No data for this range">
                        <Building2 className="h-4 w-4 mr-2" />
                        View Data Table
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="h-64 bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="flex items-center space-x-4">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="bg-slate-200 rounded animate-pulse" style={{ 
                      height: `${Math.random() * 120 + 20}px`, 
                      width: '12px' 
                    }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 bg-slate-50/50 rounded-lg flex items-center justify-center border border-slate-100">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium">No revenue in this range</p>
                  <p className="text-slate-500 text-xs mt-1">Try selecting a different time period</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        
        {/* Departments Widget */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
          {Array.isArray(departments) ? departments
            .map((dept: any) => {
              const amount = parseFloat(dashboardData?.departmentBreakdown?.[dept.id] || '0');
              const percentage = sspRevenue > 0 ? ((amount / sspRevenue) * 100) : 0;
              return { ...dept, amount, percentage };
            })
            .sort((a, b) => b.amount - a.amount) // Sort by revenue descending
            .slice(0, showAllDepartments ? departments.length : 5)
            .map((dept: any, index: number) => {
              const maxAmount = Math.max(...departments.map((d: any) => parseFloat(dashboardData?.departmentBreakdown?.[d.id] || '0')));
              const proportionWidth = maxAmount > 0 ? (dept.amount / maxAmount) * 100 : 0;
              
              return (
                <div
                  key={dept.id}
                  className="w-full flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100"
                  data-testid={`row-department-${dept.id}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      index === 0 ? 'bg-emerald-500' : 
                      index === 1 ? 'bg-blue-500' : 
                      index === 2 ? 'bg-purple-500' : 
                      index === 3 ? 'bg-orange-500' : 
                      'bg-slate-400'
                    }`} />
                    <span className="font-medium text-slate-700 flex-1 text-left">{dept.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4 min-w-[80px]">
                    <p className="font-semibold text-slate-900 text-sm font-mono tabular-nums">
                      SSP {Math.round(dept.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">{dept.percentage.toFixed(1)}%</p>
                    {/* Proportion bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                      <div 
                        className="bg-teal-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${proportionWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            }) : []}
          
          {/* View all departments button if more than 5 */}
          {Array.isArray(departments) && departments.length > 5 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              onClick={() => setShowAllDepartments(!showAllDepartments)}
              data-testid="button-view-all-departments"
            >
              {showAllDepartments ? 'Show less' : `View all departments (${departments.length} total)`}
            </Button>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Card - to fill empty space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="/transactions" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Add Transaction</span>
                    <span className="text-xs text-slate-500">Record new income or expense</span>
                  </div>
                </Button>
              </a>
              <a href="/patient-volume" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Patient Volume</span>
                    <span className="text-xs text-slate-500">Update patient count</span>
                  </div>
                </Button>
              </a>
              <a href="/reports" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">Monthly Reports</span>
                    <span className="text-xs text-slate-500">View generated reports</span>
                  </div>
                </Button>
              </a>
              <a href="/users" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-3 hover:bg-teal-50 hover:border-teal-200">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-slate-900">User Management</span>
                    <span className="text-xs text-slate-500">Manage user accounts</span>
                  </div>
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* System Status Card */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 rounded-full">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last Sync</span>
                <Badge variant="outline" className="rounded-full border-slate-200 text-slate-600">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Active Users</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">
                  1 online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}