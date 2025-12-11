/**
 * Department Comparison Table Component
 * 
 * Interactive table showing department performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FlaskConical, 
  Microscope, 
  Radiation, 
  Pill, 
  Stethoscope, 
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentMetrics } from "../utils/calculations";
import { formatSSP, formatMonthSafely } from "../utils/calculations";
import { useState } from "react";

interface DepartmentComparisonTableProps {
  metrics: DepartmentMetrics[];
  onDepartmentClick?: (departmentId: string) => void;
}

type SortField = 'name' | 'revenue' | 'share' | 'growth' | 'avgPerMonth';
type SortDirection = 'asc' | 'desc';

function DeptIcon({ code, className }: { code: string; className?: string }) {
  const key = code.toLowerCase();
  const iconClass = cn("w-4 h-4", className);
  
  if (key.includes("lab")) return <FlaskConical className={iconClass} />;
  if (key.includes("ultra")) return <Microscope className={iconClass} />;
  if (key.includes("xray") || key.includes("x-ray")) return <Radiation className={iconClass} />;
  if (key.includes("pharm")) return <Pill className={iconClass} />;
  if (key.includes("con")) return <Stethoscope className={iconClass} />;
  return <Building2 className={iconClass} />;
}

export function DepartmentComparisonTable({ metrics, onDepartmentClick }: DepartmentComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedMetrics = [...metrics].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortField) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'revenue':
        aVal = a.revenue;
        bVal = b.revenue;
        break;
      case 'share':
        aVal = a.share;
        bVal = b.share;
        break;
      case 'growth':
        aVal = a.growth;
        bVal = b.growth;
        break;
      case 'avgPerMonth':
        aVal = a.avgPerMonth;
        bVal = b.avgPerMonth;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Department Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 font-semibold text-sm text-gray-700 hover:text-gray-900"
                  >
                    Department
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => handleSort('revenue')}
                    className="flex items-center gap-1 ml-auto font-semibold text-sm text-gray-700 hover:text-gray-900"
                  >
                    Revenue (SSP)
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => handleSort('share')}
                    className="flex items-center gap-1 ml-auto font-semibold text-sm text-gray-700 hover:text-gray-900"
                  >
                    Share %
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => handleSort('growth')}
                    className="flex items-center gap-1 ml-auto font-semibold text-sm text-gray-700 hover:text-gray-900"
                  >
                    Growth
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right py-3 px-4">
                  <button
                    onClick={() => handleSort('avgPerMonth')}
                    className="flex items-center gap-1 ml-auto font-semibold text-sm text-gray-700 hover:text-gray-900"
                  >
                    Avg/Month
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">
                  Best Month
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((dept) => (
                <tr
                  key={dept.id}
                  onClick={() => onDepartmentClick?.(dept.id)}
                  className={cn(
                    "border-b border-gray-100 hover:bg-gray-50 transition-colors",
                    onDepartmentClick && "cursor-pointer"
                  )}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                        <DeptIcon code={dept.code} className="text-teal-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{dept.name}</div>
                        <div className="text-xs text-gray-500">{dept.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-semibold text-gray-900 tabular-nums">
                      {formatSSP(dept.revenue)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="font-medium text-gray-700 tabular-nums">
                      {dept.share.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 font-semibold tabular-nums",
                      dept.growth >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {dept.growth >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {dept.growth > 0 ? '+' : ''}{dept.growth.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-gray-700 tabular-nums">
                      {formatSSP(dept.avgPerMonth, true)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {dept.bestMonth ? (
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">
                          {formatMonthSafely(dept.bestMonth.month)}
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          SSP {formatSSP(dept.bestMonth.revenue, true)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
