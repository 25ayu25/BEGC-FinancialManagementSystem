import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface SimpleDailyChartProps {
  timeRange: 'current-month' | 'last-month' | 'last-3-months' | 'year' | 'custom';
}

export default function SimpleDailyChart({ timeRange }: SimpleDailyChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["/api/income-trends", timeRange],
    queryFn: async () => {
      let days = 30; // default
      if (timeRange === 'current-month' || timeRange === 'last-month' || timeRange === 'custom') {
        days = 30;
      } else if (timeRange === 'last-3-months') {
        days = 90;
      } else if (timeRange === 'year') {
        days = 365;
      }
      
      const res = await fetch(`/api/income-trends?days=${days}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch income trends');
      return res.json();
    }
  });

  const getDayLabel = (date: string) => {
    const d = new Date(date);
    const day = d.getDate();
    return day % 7 === 0 || day === 1 || day === 15 ? day.toString() : '';
  };

  const avgIncome = chartData?.length ? 
    chartData.reduce((sum: number, d: any) => sum + d.income, 0) / chartData.length : 0;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
          Daily Income ({
            timeRange === 'current-month' ? 'Current Month' : 
            timeRange === 'last-month' ? 'Last Month' :
            timeRange === 'last-3-months' ? 'Last 3 Months' :
            timeRange === 'year' ? 'This Year' :
            'Custom Period'
          })
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : chartData && chartData.length > 0 ? (
          <div className="space-y-4">
            {/* Chart Area */}
            <div className="h-64 relative bg-gradient-to-t from-slate-50 to-transparent rounded-lg p-4 overflow-hidden">
              {/* Grid Lines */}
              <div className="absolute inset-4 grid grid-cols-7 opacity-20">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="border-r border-slate-300 last:border-r-0" />
                ))}
              </div>
              
              {/* Average Line */}
              <div 
                className="absolute left-4 right-4 border-t-2 border-dashed border-slate-400 opacity-50"
                style={{ 
                  top: `${20 + (1 - avgIncome / Math.max(...chartData.map((d: any) => d.income))) * 200}px`
                }}
              />
              
              {/* Bars */}
              <div className="h-full flex items-end justify-between gap-1">
                {chartData.map((item: any, index: number) => (
                  <div 
                    key={item.date}
                    className="flex flex-col items-center flex-1 group"
                  >
                    <div 
                      className="w-full bg-gradient-to-t from-teal-600 to-teal-500 rounded-t-sm hover:from-teal-700 hover:to-teal-600 transition-all duration-200 cursor-pointer shadow-sm relative"
                      style={{ 
                        height: `${Math.max((item.income / Math.max(...chartData.map((d: any) => d.income))) * 200, 4)}px`,
                        minHeight: '4px'
                      }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {item.date} — SSP {Math.round(item.income).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 mt-2 font-medium">
                      {getDayLabel(item.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
              <div className="text-sm">
                <span className="text-slate-600">Average: </span>
                <span className="font-semibold text-teal-700">
                  SSP {Math.round(avgIncome).toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Dotted line shows average
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No income data available</p>
            <p className="text-slate-400 text-sm mt-1">Data will appear here once transactions are added</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}