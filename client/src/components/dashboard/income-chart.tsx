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
    <Card className="border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Daily Income Trend
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant={days === 7 ? "default" : "outline"} 
              size="sm" 
              className="px-4 py-2 text-sm min-h-[44px] touch-manipulation"
              onClick={() => setDays(7)}
              data-testid="button-chart-7days"
            >
              7D
            </Button>
            <Button 
              variant={days === 30 ? "default" : "outline"} 
              size="sm" 
              className="px-4 py-2 text-sm min-h-[44px] touch-manipulation"
              onClick={() => setDays(30)}
              data-testid="button-chart-30days"
            >
              30D
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64">
            <Skeleton className="h-full w-full" />
          </div>
        ) : chartData && chartData.length > 0 ? (
          <>
            <div className="h-64 flex items-end justify-between space-x-2" data-testid="chart-daily-income">
              {chartData.map((item: any, index: number) => (
                <div 
                  key={item.date}
                  className="flex flex-col items-center flex-1"
                >
                  <div 
                    className="w-full bg-primary rounded-t hover:bg-blue-700 transition-colors cursor-pointer"
                    style={{ 
                      height: `${Math.max(...chartData.map((d: any) => d.income)) === 0 ? 20 : (item.income / Math.max(...chartData.map((d: any) => d.income))) * 200}px`,
                      minHeight: item.income === 0 ? '8px' : '20px'
                    }}
                    title={`${item.date}: SSP ${item.income.toLocaleString()}`}
                  />
                  <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                    {item.date}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Average daily income: <span className="font-medium text-primary">
                  SSP {(chartData.reduce((sum: number, d: any) => sum + d.income, 0) / chartData.length).toLocaleString()}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 mb-2">No income data available for the selected period</p>
              <p className="text-sm text-gray-400">Add some income transactions to see the trend</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
