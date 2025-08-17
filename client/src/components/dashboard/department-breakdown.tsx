import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DepartmentBreakdownProps {
  data?: Record<string, string>;
  departments?: Array<{ id: string; name: string; code: string }>;
}

export default function DepartmentBreakdown({ data, departments }: DepartmentBreakdownProps) {
  if (!departments?.length) {
    return (
      <Card className="border border-gray-100">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Income by Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No department data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = departments.reduce((sum, dept) => 
    sum + parseFloat(data?.[dept.id] || '0'), 0
  );

  const departmentColors = [
    'bg-primary',
    'bg-success', 
    'bg-accent',
    'bg-purple-500',
    'bg-red-500'
  ];

  return (
    <Card className="border border-gray-100">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Income by Department
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" data-testid="department-breakdown">
          {departments.map((department, index) => {
            const amount = parseFloat(data?.[department.id] || '0');
            const percentage = total > 0 ? (amount / total) * 100 : 0;
            const colorClass = departmentColors[index % departmentColors.length];
            
            return (
              <div key={department.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 ${colorClass} rounded-full`} />
                    <span className="text-sm text-gray-600">{department.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900" data-testid={`amount-${department.code}`}>
                      ${amount.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${colorClass} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
