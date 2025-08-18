import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DepartmentBreakdownProps {
  data?: Record<string, string>;
  departments?: Array<{ id: string; name: string; code: string }>;
}

export default function DepartmentBreakdown({ data, departments }: DepartmentBreakdownProps) {
  if (!departments?.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            Income by Department
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-slate-300 rounded animate-pulse"></div>
            </div>
            <p className="text-slate-500 font-medium">No department data available</p>
            <p className="text-slate-400 text-sm mt-1">Department breakdown will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = departments.reduce((sum, dept) => 
    sum + parseFloat(data?.[dept.id] || '0'), 0
  );

  const departmentColors = [
    { bg: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-50' },
    { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
    { bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
    { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
    { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' }
  ];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-100">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          Income by Department
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-5" data-testid="department-breakdown">
          {departments.map((department, index) => {
            const amount = parseFloat(data?.[department.id] || '0');
            const percentage = total > 0 ? (amount / total) * 100 : 0;
            const colors = departmentColors[index % departmentColors.length];
            
            return (
              <div key={department.id} className={`p-4 rounded-lg border border-slate-100 ${colors.light} hover:shadow-sm transition-all duration-200`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 ${colors.bg} rounded-full shadow-sm`} />
                    <span className="text-sm font-medium text-slate-700">{department.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm font-bold ${colors.text}`} data-testid={`amount-${department.code}`}>
                      SSP {Math.round(amount).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200 font-medium">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`${colors.bg} h-3 rounded-full transition-all duration-500 ease-out shadow-sm`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Total Summary */}
        <div className="mt-6 p-4 bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg border border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">Total Department Revenue</span>
            <span className="text-lg font-bold text-slate-900">SSP {Math.round(total).toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
