/**
 * Expense Analytics Page
 * 
 * Comprehensive expense tracking and cost optimization insights
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileText, Calendar as CalendarIcon, Receipt } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useExpenseAnalytics, type FilterPreset } from "@/features/expense-analytics/hooks/useExpenseAnalytics";
import { ExpenseKPICards } from "@/features/expense-analytics/components/ExpenseKPICards";
import { CategoryPerformanceGrid } from "@/features/expense-analytics/components/CategoryPerformanceGrid";
import { ExpenseTrendChart } from "@/features/expense-analytics/components/ExpenseTrendChart";
import { ExpenseInsights } from "@/features/expense-analytics/components/ExpenseInsights";
import { CategoryDeepDiveModal } from "@/features/expense-analytics/components/CategoryDeepDiveModal";
import type { CategoryMetrics } from "@/features/expense-analytics/utils/calculations";
import { toast } from "@/hooks/use-toast";
import { filterOptions as centralizedFilterOptions } from "@/lib/dateRanges";

const filterOptions: Array<{ value: FilterPreset; label: string }> = [
  ...centralizedFilterOptions,
  { value: 'custom', label: 'Custom Range' },
];

export default function ExpenseAnalytics() {
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>('this-year');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryMetrics | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { metrics, kpis, insights, chartData, isLoading, error } = useExpenseAnalytics(
    selectedFilter,
    selectedFilter === 'custom' && customDateRange.start && customDateRange.end
      ? { startDate: customDateRange.start, endDate: customDateRange.end }
      : undefined
  );

  const handleFilterChange = (value: FilterPreset) => {
    setSelectedFilter(value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const handleCategoryClick = (category: CategoryMetrics) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    try {
      const csvHeaders = ['Rank', 'Category', 'Total (SSP)', 'Share %', 'Growth %', 'Avg/Month'];
      const csvRows = metrics.map((metric, index) => [
        index + 1,
        metric.name,
        metric.total.toFixed(2),
        metric.percentage.toFixed(2),
        metric.growth.toFixed(2),
        metric.avgPerMonth.toFixed(2),
      ]);

      const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expense-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Expense analytics exported to CSV",
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

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">Failed to load expense analytics. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-red-500 via-red-600 to-orange-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Receipt className="w-8 h-8" />
              Expense Analytics
            </h1>
            <p className="text-red-100 mt-1">
              Comprehensive expense tracking and cost optimization insights
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
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.start}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, start: date }))}
                        disabled={(date) => date > new Date()}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
                      <Calendar
                        mode="single"
                        selected={customDateRange.end}
                        onSelect={(date) => setCustomDateRange(prev => ({ ...prev, end: date }))}
                        disabled={(date) => 
                          date > new Date() || 
                          (customDateRange.start ? date < customDateRange.start : false)
                        }
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
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-gray-900 hover:bg-gray-100"
              onClick={handleExportCSV}
              disabled={isLoading || metrics.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="bg-white text-gray-900 hover:bg-gray-100"
              onClick={handleExportPDF}
              disabled={isLoading || metrics.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <ExpenseKPICards kpis={kpis} isLoading={isLoading} />

      {/* Insights */}
      <ExpenseInsights insights={insights} isLoading={isLoading} />

      {/* Expense Trend Chart */}
      <ExpenseTrendChart 
        chartData={chartData} 
        metrics={metrics}
        isLoading={isLoading} 
      />

      {/* Category Performance Grid */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Category Performance</h2>
        <CategoryPerformanceGrid
          metrics={metrics}
          onCategoryClick={handleCategoryClick}
          isLoading={isLoading}
        />
      </div>

      {/* Category Deep Dive Modal */}
      <CategoryDeepDiveModal
        category={selectedCategory}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
