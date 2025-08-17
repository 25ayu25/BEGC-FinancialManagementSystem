import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function IncomeChart() {
  // Mock data for demo - in real app this would come from API
  const chartData = [
    { date: 'Aug 1', income: 1200 },
    { date: 'Aug 3', income: 1450 },
    { date: 'Aug 5', income: 1100 },
    { date: 'Aug 7', income: 1650 },
    { date: 'Aug 9', income: 1400 },
    { date: 'Aug 11', income: 1800 },
    { date: 'Aug 13', income: 1300 },
    { date: 'Aug 15', income: 1550 },
    { date: 'Aug 17', income: 1750 },
  ];

  return (
    <Card className="border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Daily Income Trend
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="default" size="sm" className="px-3 py-1 text-xs">
              7D
            </Button>
            <Button variant="outline" size="sm" className="px-3 py-1 text-xs">
              30D
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between space-x-2" data-testid="chart-daily-income">
          {chartData.map((item, index) => (
            <div 
              key={item.date}
              className="flex flex-col items-center flex-1"
            >
              <div 
                className="w-full bg-primary rounded-t hover:bg-blue-700 transition-colors cursor-pointer"
                style={{ 
                  height: `${(item.income / Math.max(...chartData.map(d => d.income))) * 200}px`,
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
              ${(chartData.reduce((sum, d) => sum + d.income, 0) / chartData.length).toFixed(0)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
