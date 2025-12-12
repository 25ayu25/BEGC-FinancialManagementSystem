/**
 * Insurance Overview Page
 * 
 * Comprehensive insurance provider analytics and performance tracking
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileText, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import HeaderAction from "@/components/layout/HeaderAction";
import { useInsuranceOverview, type FilterPreset } from "@/features/insurance-overview/hooks/useInsuranceOverview";
import { InsuranceKPICards } from "@/features/insurance-overview/components/InsuranceKPICards";
import { ProviderRankingCards } from "@/features/insurance-overview/components/ProviderRankingCards";
import { ProviderComparisonTable } from "@/features/insurance-overview/components/ProviderComparisonTable";
import { RevenueTrendChart } from "@/features/insurance-overview/components/RevenueTrendChart";
import { ClaimsDistributionChart } from "@/features/insurance-overview/components/ClaimsDistributionChart";
import { ProviderDeepDiveModal } from "@/features/insurance-overview/components/ProviderDeepDiveModal";
import { PerformanceInsights } from "@/features/insurance-overview/components/PerformanceInsights";
import { MonthlyHeatmap } from "@/features/insurance-overview/components/MonthlyHeatmap";
import {
  KPICardsLoadingSkeleton,
  RankingCardsLoadingSkeleton,
  TableLoadingSkeleton,
  ChartLoadingSkeleton,
  InsightsLoadingSkeleton,
} from "@/features/insurance-overview/components/LoadingSkeletons";
import { formatUSD } from "@/features/insurance-overview/utils/calculations";
import { toast } from "@/hooks/use-toast";
import { filterOptions as centralizedFilterOptions } from "@/lib/dateRanges";

const filterOptions: Array<{ value: FilterPreset; label: string }> = [
  ...centralizedFilterOptions,
  { value: 'custom', label: 'Custom Range' },
];

export default function InsuranceOverview() {
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>('this-year');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined,
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const { metrics, insights, kpis, isLoading, error, dateRange } = useInsuranceOverview(
    selectedFilter,
    selectedFilter === 'custom' && customDateRange.start && customDateRange.end
      ? { startDate: customDateRange.start, endDate: customDateRange.end }
      : undefined
  );

  const selectedProvider = metrics.find(m => m.id === selectedProviderId) || null;

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
      const csvHeaders = ['Rank', 'Provider', 'Claims', 'Revenue (SSP)', 'Share %', 'Avg Claim', 'Growth %', 'Status'];
      const csvFields: Array<(provider: typeof metrics[0]) => string | number> = [
        (p) => p.rank,
        (p) => p.name,
        (p) => p.claimsCount,
        (p) => p.revenue.toFixed(2),
        (p) => p.share.toFixed(2),
        (p) => p.avgClaim.toFixed(2),
        (p) => p.growth.toFixed(2),
        (p) => p.status,
      ];
      
      // Prepare CSV data
      const rows = metrics.map(provider => csvFields.map(fn => fn(provider)));
      const csv = [csvHeaders, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `insurance-overview-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Insurance overview exported to CSV",
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
      {/* Premium Multi-Layer Header with Enhanced Design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-700 p-8 shadow-2xl">
        {/* Animated mesh/dot pattern background */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: `
                radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.5) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.4) 0%, transparent 40%),
                radial-gradient(circle at 40% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 40%),
                radial-gradient(circle at 90% 20%, rgba(255, 255, 255, 0.4) 0%, transparent 40%)
              `,
              animation: 'pulse 6s ease-in-out infinite'
            }} 
          />
        </div>

        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${3 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Glass layer with backdrop blur */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5" />
        
        {/* Animated gradient accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 animate-pulse" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Left: Title and Subtitle with enhanced glow effect */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-2xl">
                Insurance Overview
              </h1>
              <p className="mt-1 text-sm sm:text-base text-violet-100 drop-shadow-lg">
                Comprehensive insurance provider analytics and performance tracking
              </p>
            </div>

            {/* Right: Controls with enhanced glassmorphism */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="flex flex-wrap gap-3">
                {/* Date filter with premium glassmorphism */}
                <Select value={selectedFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-[180px] bg-white/95 backdrop-blur-md border-white/30 hover:bg-white transition-all hover:shadow-xl hover:scale-105">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Custom date picker */}
                {showCustomDatePicker && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal bg-white/95 backdrop-blur-md border-white/30 hover:bg-white hover:shadow-xl hover:scale-105 transition-all",
                          !customDateRange.start && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.start && customDateRange.end ? (
                          <>
                            {format(customDateRange.start, "MMM d, yyyy")} -{" "}
                            {format(customDateRange.end, "MMM d, yyyy")}
                          </>
                        ) : (
                          <span>Pick date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Start Date</label>
                          <Calendar
                            mode="single"
                            selected={customDateRange.start}
                            onSelect={(date) => setCustomDateRange(prev => ({ ...prev, start: date }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">End Date</label>
                          <Calendar
                            mode="single"
                            selected={customDateRange.end}
                            onSelect={(date) => setCustomDateRange(prev => ({ ...prev, end: date }))}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Export buttons with enhanced styling */}
                <HeaderAction
                  icon={<Download className="w-4 h-4" />}
                  label="Export CSV"
                  onClick={handleExportCSV}
                  className="bg-white/95 backdrop-blur-md border-white/30 hover:bg-white hover:shadow-xl text-violet-700 transition-all hover:scale-105"
                />
                <HeaderAction
                  icon={<FileText className="w-4 h-4" />}
                  label="Export PDF"
                  onClick={handleExportPDF}
                  className="bg-white/95 backdrop-blur-md border-white/30 hover:bg-white hover:shadow-xl text-violet-700 transition-all hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) translateX(0); }
            25% { transform: translateY(-20px) translateX(10px); }
            50% { transform: translateY(-10px) translateX(-10px); }
            75% { transform: translateY(-30px) translateX(5px); }
          }
        `}</style>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Failed to load insurance data. Please try again later.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <KPICardsLoadingSkeleton />
      ) : (
        <InsuranceKPICards kpis={kpis} />
      )}

      {/* Provider Rankings */}
      <div>
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Provider Performance Rankings
        </h2>
        {isLoading ? (
          <RankingCardsLoadingSkeleton />
        ) : (
          <ProviderRankingCards 
            metrics={metrics} 
            onProviderClick={setSelectedProviderId}
          />
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <ChartLoadingSkeleton />
        ) : (
          <RevenueTrendChart metrics={metrics} />
        )}

        {isLoading ? (
          <ChartLoadingSkeleton />
        ) : (
          <ClaimsDistributionChart metrics={metrics} />
        )}
      </div>

      {/* Insights and Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {isLoading ? (
            <InsightsLoadingSkeleton />
          ) : (
            <PerformanceInsights insights={insights} />
          )}
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
            <TableLoadingSkeleton />
          ) : (
            <ProviderComparisonTable 
              metrics={metrics}
              onProviderClick={setSelectedProviderId}
            />
          )}
        </div>
      </div>

      {/* Monthly Heatmap */}
      {!isLoading && metrics.length > 0 && (
        <MonthlyHeatmap metrics={metrics} />
      )}

      {/* Deep Dive Modal */}
      <ProviderDeepDiveModal
        provider={selectedProvider}
        isOpen={!!selectedProviderId}
        onClose={() => setSelectedProviderId(null)}
      />
    </div>
  );
}
