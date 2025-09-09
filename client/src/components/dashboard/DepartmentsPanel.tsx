import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FlaskConical,
  Waves,
  Radiation,
  Pill as PillIcon,
  MessageSquare,
  Ellipsis,
} from "lucide-react";

type Dept = { id: string; name: string };
type Breakdown = Record<string, number | string> | undefined;

interface DepartmentsPanelProps {
  departments: Dept[];                       // array from /api/departments
  departmentBreakdown: Breakdown;            // map: deptId -> amount SSP
  totalSSP: number;                          // period total revenue (SSP)
}

const DEPT_ICON: Record<string, React.ComponentType<any>> = {
  Laboratory: FlaskConical,
  Ultrasound: Waves,
  "X-Ray": Radiation,
  Pharmacy: PillIcon,
  Consultation: MessageSquare,
  Other: Ellipsis,
};

const rankBarClass = (i: number) =>
  i === 0
    ? "bg-teal-500"
    : i === 1
    ? "bg-sky-500"
    : i === 2
    ? "bg-violet-500"
    : "bg-slate-400";

const rankBadgeClass = (i: number) =>
  i === 0
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-slate-50 text-slate-600 border-slate-200";

export default function DepartmentsPanel({
  departments,
  departmentBreakdown,
  totalSSP,
}: DepartmentsPanelProps) {
  const [expanded, setExpanded] = React.useState(false);

  const rows = React.useMemo(() => {
    const list = (departments ?? []).map((d) => {
      const raw = departmentBreakdown?.[d.id];
      const amount = Number(raw ?? 0) || 0;
      const percentage = totalSSP > 0 ? (amount / totalSSP) * 100 : 0;
      return { id: d.id, name: d.name, amount, percentage };
    });
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [departments, departmentBreakdown, totalSSP]);

  const maxAmount = React.useMemo(
    () => Math.max(0, ...rows.map((r) => r.amount)),
    [rows]
  );

  const visible = expanded ? rows : rows.slice(0, 6);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold text-slate-900">
          Departments
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {visible.length > 0 ? (
          visible.map((r, index) => {
            const Icon = DEPT_ICON[r.name] || Ellipsis;
            const width =
              maxAmount > 0 ? Math.min(100, Math.max(0, (r.amount / maxAmount) * 100)) : 0;
            const isZero = r.amount <= 0;
            return (
              <div
                key={r.id}
                className={[
                  "group relative flex items-center justify-between rounded-xl border p-4",
                  "bg-white/80 border-slate-100 hover:bg-white hover:shadow-md transition",
                  isZero ? "opacity-60" : "",
                ].join(" ")}
              >
                {/* Left: icon + name + badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full grid place-items-center bg-slate-100 group-hover:bg-slate-200 transition">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 truncate">{r.name}</span>
                    {index === 0 && (
                      <span
                        className={[
                          "px-2 py-0.5 text-[10px] font-medium rounded-full border",
                          rankBadgeClass(index),
                        ].join(" ")}
                        title="Highest revenue department in this period"
                      >
                        Top performer
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: amounts & progress */}
                <div className="min-w-[180px] text-right">
                  <div className="font-mono tabular-nums font-semibold text-slate-900">
                    SSP {Math.round(r.amount).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.percentage.toFixed(1)}% of revenue
                  </div>
                  {!isZero && (
                    <div className="mt-1 h-2 rounded-full bg-slate-100 shadow-inner overflow-hidden">
                      <div
                        className={["h-full rounded-full", rankBarClass(index)].join(" ")}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border p-4 text-sm text-slate-500">
            No departments for this period.
          </div>
        )}

        {rows.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show less" : `View all departments (${rows.length} total)`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
