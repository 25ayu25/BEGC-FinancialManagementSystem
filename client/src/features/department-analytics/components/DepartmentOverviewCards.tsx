/**
 * Department Overview Cards Component
 * 
 * Displays all departments in a grid with ranking, revenue, share, trends, and badges
 */

import { Card, CardContent } from "@/components/ui/card";
import { 
  FlaskConical, 
  Microscope, 
  Radiation, 
  Pill, 
  Stethoscope, 
  Building2,
  TrendingUp,
  TrendingDown,
  Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentMetrics } from "../utils/calculations";
import { formatSSP } from "../utils/calculations";

interface DepartmentOverviewCardsProps {
  metrics: DepartmentMetrics[];
  onDepartmentClick?: (departmentId: string) => void;
}

function DeptIcon({ code, className }: { code: string; className?: string }) {
  const key = code.toLowerCase();
  const iconClass = cn("w-5 h-5", className);
  
  if (key.includes("lab")) return <FlaskConical className={iconClass} />;
  if (key.includes("ultra")) return <Microscope className={iconClass} />;
  if (key.includes("xray") || key.includes("x-ray")) return <Radiation className={iconClass} />;
  if (key.includes("pharm")) return <Pill className={iconClass} />;
  if (key.includes("con")) return <Stethoscope className={iconClass} />;
  return <Building2 className={iconClass} />;
}

function getRankBadgeColor(rank: number): string {
  if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900";
  if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900";
  if (rank === 3) return "bg-gradient-to-r from-orange-400 to-orange-500 text-orange-900";
  return "bg-gray-200 text-gray-700";
}

function SimpleSparkline({ data }: { data: Array<{ month: string; revenue: number }> }) {
  if (!data.length) return null;
  
  const values = data.map(d => d.revenue);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-teal-500"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DepartmentOverviewCards({ metrics, onDepartmentClick }: DepartmentOverviewCardsProps) {
  if (metrics.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">No department data available for this period</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((dept) => (
        <Card
          key={dept.id}
          className={cn(
            "hover:shadow-lg transition-all duration-200 cursor-pointer border-2",
            onDepartmentClick && "hover:border-teal-300"
          )}
          onClick={() => onDepartmentClick?.(dept.id)}
        >
          <CardContent className="p-6">
            {/* Header: Icon, Name, Rank */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-teal-50 to-teal-100"
                )}>
                  <DeptIcon code={dept.code} className="text-teal-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{dept.name}</h3>
                  <p className="text-xs text-gray-500">{dept.code}</p>
                </div>
              </div>
              
              {/* Rank Badge */}
              <div className={cn(
                "px-2 py-1 rounded-full text-xs font-bold",
                getRankBadgeColor(dept.rank)
              )}>
                #{dept.rank}
              </div>
            </div>

            {/* Revenue */}
            <div className="mb-2">
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                SSP {formatSSP(dept.revenue)}
              </div>
              <div className="text-sm text-gray-600">
                {dept.share.toFixed(1)}% of total revenue
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(dept.share, 100)}%` }}
                />
              </div>
            </div>

            {/* Trend and Avg */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {dept.growth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={cn(
                  "text-sm font-semibold",
                  dept.growth >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {dept.growth > 0 ? '+' : ''}{dept.growth.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Avg/mo: SSP {formatSSP(dept.avgPerMonth, true)}
              </div>
            </div>

            {/* Sparkline */}
            {dept.monthlyData.length > 0 && (
              <div className="mt-3 text-teal-600">
                <SimpleSparkline data={dept.monthlyData} />
              </div>
            )}

            {/* Badges */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {dept.rank === 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                  <Award className="w-3 h-3" />
                  TOP PERFORMER
                </span>
              )}
              {dept.growth < -5 && (
                <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                  NEEDS ATTENTION
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
