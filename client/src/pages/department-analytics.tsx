/**
 * Department Analytics Page
 * 
 * Comprehensive insights into department performance
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileText, Calendar as CalendarIcon, Building2 } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import HeaderAction from "@/components/layout/HeaderAction";
import { useDepartmentAnalytics, type FilterPreset } from "@/features/department-analytics/hooks/useDepartmentAnalytics";
import { DepartmentOverviewCards } from "@/features/department-analytics/components/DepartmentOverviewCards";
import { DepartmentComparisonTable } from "@/features/department-analytics/components/DepartmentComparisonTable";
import { DepartmentTrendChart } from "@/features/department-analytics/components/DepartmentTrendChart";
import { PerformanceInsights } from "@/features/department-analytics/components/PerformanceInsights";
import { DepartmentDeepDive } from "@/features/department-analytics/components/DepartmentDeepDive";
import {
  DepartmentCardsLoadingSkeleton,
  TableLoadingSkeleton,
  ChartLoadingSkeleton,
  InsightsLoadingSkeleton,
} from "@/features/department-analytics/components/LoadingSkeletons";
import { formatSSP, formatMonthSafely } from "@/features/department-analytics/utils/calculations";
import { toast } from "@/hooks/use-toast";

const filterOptions: Array<{ value: FilterPreset; label: string }> = [
  { value: 'this-year', label: 'This Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'custom', label: 'Custom Range' },
];

export default function DepartmentAnalytics() {
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>('this-year');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  const { metrics, insights, totals, trendData, isLoading, error, dateRange } = useDepartmentAnalytics(
    selectedFilter,
    selectedFilter === 'custom' && customDateRange.start && customDateRange.end
      ? { startDate: customDateRange.start, endDate: customDateRange.end }
      : undefined
  );

  const selectedDepartment = metrics.find(m => m.id === selectedDepartmentId) || null;

  const handleFilterChange = (value: FilterPreset) => {
    setSelectedFilter(value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const handleExportCSV = () => {
    try {
      // CSV configuration
      const csvHeaders = ['Department', 'Code', 'Revenue (SSP)', 'Share %', 'Growth %', 'Avg/Month', 'Best Month', 'Best Month Revenue'];
      const csvFields: Array<(dept: typeof metrics[0]) => string | number> = [
        (dept) => dept.name,
        (dept) => dept.code,
        (dept) => dept.revenue.toFixed(2),
        (dept) => dept.share.toFixed(2),
        (dept) => dept.growth.toFixed(2),
        (dept) => dept.avgPerMonth.toFixed(2),
        (dept) => dept.bestMonth ? formatMonthSafely(dept.bestMonth.month) : '-',
        (dept) => dept.bestMonth ? dept.bestMonth.revenue.toFixed(2) : '-',
      ];
      
      // Prepare CSV data
      const rows = metrics.map(dept => csvFields.map(fn => fn(dept)));
      const csv = [csvHeaders, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `department-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Department analytics exported to CSV",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = () => {
    toast({
      title: "PDF Export",
      description: "PDF export feature coming soon",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-teal-500 via-teal-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="w-8 h-8" />
              Department Analytics
            </h1>
            <p className="text-teal-100 mt-1">
              Comprehensive performance insights across all departments
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Time Period Filter */}
            <Select value={selectedFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[180px] bg-white text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom Date Range Picker */}
            {selectedFilter === 'custom' && (
              <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-white text-gray-900">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {customDateRange.start && customDateRange.end
                      ? `${format(customDateRange.start, 'MMM d')} - ${format(customDateRange.end, 'MMM d, yyyy')}`
                      : 'Select dates'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.start}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, start: date }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.end}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, end: date }))}
                      />
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => setShowCustomDatePicker(false)}
                      disabled={!customDateRange.start || !customDateRange.end}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Export Buttons */}
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="bg-white text-gray-900">
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="bg-white text-gray-900">
              <FileText className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-teal-100 text-sm mb-1">Total Revenue</div>
              <div className="text-2xl font-bold tabular-nums">
                SSP {formatSSP(totals.totalRevenue)}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-teal-100 text-sm mb-1">Active Departments</div>
              <div className="text-2xl font-bold tabular-nums">
                {totals.activeDepartments}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-teal-100 text-sm mb-1">Period Growth</div>
              <div className={cn(
                "text-2xl font-bold tabular-nums",
                totals.growth >= 0 ? "text-green-100" : "text-red-100"
              )}>
                {totals.growth > 0 ? '+' : ''}{totals.growth.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm">Please try again later or contact support if the issue persists.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <DepartmentCardsLoadingSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TableLoadingSkeleton />
            <InsightsLoadingSkeleton />
          </div>
          <ChartLoadingSkeleton />
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {/* Department Overview Cards */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Department Overview</h2>
            <DepartmentOverviewCards
              metrics={metrics}
              onDepartmentClick={setSelectedDepartmentId}
            />
          </div>

          {/* Performance Insights & Comparison Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PerformanceInsights insights={insights} />
            <DepartmentComparisonTable
              metrics={metrics}
              onDepartmentClick={setSelectedDepartmentId}
            />
          </div>

          {/* Revenue Trend Chart */}
          <DepartmentTrendChart metrics={metrics} trendData={trendData} />
        </div>
      )}

      {/* Department Deep Dive Modal */}
      {selectedDepartment && (
        <DepartmentDeepDive
          department={selectedDepartment}
          onClose={() => setSelectedDepartmentId(null)}
        />
      )}
    </div>
  );
}
