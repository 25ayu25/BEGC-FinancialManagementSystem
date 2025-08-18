import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function IncomeChart() {
  const [days, setDays] = useState(7);
  
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["/api/income-trends", days],
    queryFn: async () => {
      const res = await fetch(`/api/income-trends?days=${days}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch income trends');
      return res.json();
    }
  });

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
            Daily Income Trend
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant={days === 7 ? "default" : "outline"} 
              size="sm" 
              className="px-3 py-1 text-xs font-medium"
              onClick={() => setDays(7)}
            >
              7D
            </Button>
            <Button 
              variant={days === 30 ? "default" : "outline"} 
              size="sm" 
              className="px-3 py-1 text-xs font-medium"
              onClick={() => setDays(30)}
            >
              30D
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="h-64">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : chartData && chartData.length > 0 ? (
          <>
            <div className="h-64 flex items-end justify-between space-x-1 bg-gradient-to-t from-slate-50 to-transparent rounded-lg p-4" data-testid="chart-daily-income">
              {chartData.map((item: any, index: number) => (
                <div 
                  key={item.date}
                  className="flex flex-col items-center flex-1 group"
                >
                  <div 
                    className="w-full bg-gradient-to-t from-teal-600 to-teal-500 rounded-t-sm hover:from-teal-700 hover:to-teal-600 transition-all duration-200 cursor-pointer shadow-sm group-hover:shadow-md"
                    style={{ 
                      height: `${Math.max((item.income / Math.max(...chartData.map((d: any) => d.income))) * 200, 4)}px`,
                      minHeight: '4px'
                    }}
                    title={`${item.date}: SSP ${Math.round(item.income).toLocaleString()}`}
                  />
                  <span className="text-xs text-slate-500 mt-2 rotate-45 origin-left font-medium">
                    {item.date.replace('Aug ', '')}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-100">
              <p className="text-sm text-slate-700 text-center">
                Average daily income: <span className="font-semibold text-teal-700">
                  SSP {Math.round(chartData.reduce((sum: number, d: any) => sum + d.income, 0) / chartData.length).toLocaleString()}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No income data available</p>
            <p className="text-slate-400 text-sm mt-1">Try a different time period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
