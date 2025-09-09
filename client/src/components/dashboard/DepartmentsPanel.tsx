// client/src/components/dashboard/DepartmentsPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlaskConical, Waves, Pill, Scan, Stethoscope, MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";

type DepartmentsPanelProps = {
  className?: string;
  departments: Array<{ id: string; code: string; name: string }>;
  departmentBreakdown?: Record<string, number>; // id -> SSP total
  totalSSP: number;
};

// icon by department code (fallback = dot)
const ICONS: Record<string, any> = {
  LAB: FlaskConical,
  ULT: Waves,
  PHM: Pill,
  XRY: Scan,
  CON: Stethoscope,
};

export default function DepartmentsPanel({
  className,
  departments = [],
  departmentBreakdown = {},
  totalSSP = 0,
}: DepartmentsPanelProps) {
  // Map + sort by amount desc
  const rows = departments
    .map((d) => {
      const ssp = Number(departmentBreakdown[d.id] || 0);
      const pct = totalSSP > 0 ? (ssp / totalSSP) * 100 : 0;
      return { ...d, ssp, pct };
    })
    .sort((a, b) => b.ssp - a.ssp);

  return (
    <Card className={cn("border border-slate-200 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {rows.length === 0 && (
          <div className="text-sm text-slate-500">No department data for this period.</div>
        )}

        {rows.map((row) => {
          const Icon = ICONS[row.code] ?? MoreHorizontal;
          const colorBar =
            row.code === "LAB" ? "bg-emerald-500" :
            row.code === "ULT" ? "bg-sky-500" :
            row.code === "PHM" ? "bg-violet-500" :
            row.code === "XRY" ? "bg-cyan-600" :
            row.code === "CON" ? "bg-orange-500" : "bg-slate-400";

          return (
            <div key={row.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 border border-slate-200">
                    <Icon className="h-3.5 w-3.5 text-slate-700" />
                  </span>
                  <div className="text-sm font-medium text-slate-900">{row.name}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                  SSP {row.ssp.toLocaleString()}
                </div>
              </div>

              <div className="mt-2">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn("h-2 rounded-full", colorBar)}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {row.pct.toFixed(1)}% of revenue
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
