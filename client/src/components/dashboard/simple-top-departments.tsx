import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SimpleTopDepartmentsProps {
  data?: Record<string, string>;
  departments?: Array<{ id: string; name: string; code: string }>;
}

export default function SimpleTopDepartments({ data, departments }: SimpleTopDepartmentsProps) {
  if (!departments?.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Departments
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs">
              View full breakdown
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No department data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = departments.reduce((sum, dept) => 
    sum + parseFloat(data?.[dept.id] || '0'), 0
  );

  // Sort departments by income and take top 5
  const sortedDepartments = departments
    .map(dept => ({
      ...dept,
      amount: parseFloat(data?.[dept.id] || '0'),
      percentage: total > 0 ? (parseFloat(data?.[dept.id] || '0') / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const colors = [
    'bg-teal-500',
    'bg-blue-500', 
    'bg-purple-500',
    'bg-orange-500',
    'bg-red-500'
  ];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Departments
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 text-xs">
            View full breakdown
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Compact Donut/Stacked Bar */}
          <div className="space-y-4">
            {sortedDepartments.map((department, index) => (
              <div key={department.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 ${colors[index]} rounded-full`} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        {department.name}
                      </span>
                      {index === 0 && department.amount > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                          Top Performer
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      SSP {Math.round(department.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {department.percentage.toFixed(1)}% • Avg/day: SSP {Math.round(department.amount / new Date().getDate()).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className={`${colors[index]} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${department.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary - Enhanced Professional Style */}
          <div className="pt-4 border-t border-slate-200">
            <div className="relative p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-xl shadow-sm overflow-hidden">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full bg-gradient-to-br from-teal-200 via-transparent to-emerald-200"></div>
              </div>
              
              {/* Content */}
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-teal-700">Total Revenue</span>
                  </div>
                  <span className="text-xl font-bold font-variant-numeric-tabular text-teal-900">
                    SSP {Math.round(total).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                    <span className="text-xs font-medium text-emerald-600">
                      {sortedDepartments.filter(d => d.amount > 0).length} active departments
                    </span>
                  </div>
                  <span className="text-xs font-medium font-variant-numeric-tabular text-slate-600 bg-white/60 px-2 py-1 rounded-full">
                    Day {new Date().getDate()} of {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}