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
              className="px-3 py-1 text-xs"
              onClick={() => setDays(7)}
            >
              7D
            </Button>
            <Button 
              variant={days === 30 ? "default" : "outline"} 
              size="sm" 
              className="px-3 py-1 text-xs"
              onClick={() => setDays(30)}
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
                      height: `${(item.income / Math.max(...chartData.map((d: any) => d.income))) * 200}px`,
                      minHeight: '20px'
                    }}
                    title={`${item.date}: $${item.income}`}
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
                  ${(chartData.reduce((sum: number, d: any) => sum + d.income, 0) / chartData.length).toFixed(0)}
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500">No income data available for the selected period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
