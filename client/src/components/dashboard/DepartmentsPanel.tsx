import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlaskConical,
  Activity,
  Pill,
  Scan,
  Stethoscope,
  MoreHorizontal,
} from "lucide-react";

type Dept = { id: string; code?: string; name: string };

interface Props {
  departments: Dept[];
  departmentBreakdown?: Record<string, number>; // { "Laboratory": 6158000, ... }
  totalSSP: number;
  hideChampion?: boolean; // default true (no "Top performer" pill)
}

const IconFor: Record<string, any> = {
  Laboratory: FlaskConical,
  Ultrasound: Activity,
  Pharmacy: Pill,
  "X-Ray": Scan,
  Consultation: Stethoscope,
  Other: MoreHorizontal,
};

export default function DepartmentsPanel({
  departments,
  departmentBreakdown = {},
  totalSSP,
  hideChampion = true,
}: Props) {
  const items = Object.entries(departmentBreakdown)
    .map(([label, value]) => {
      const pct = totalSSP > 0 ? (value / totalSSP) * 100 : 0;
      const Icon = IconFor[label] || MoreHorizontal;
      return { label, value, pct, Icon };
    })
    .sort((a, b) => b.value - a.value);

  if (!items.length) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500">No department data for this period.</div>
        </CardContent>
      </Card>
    );
  }

  const champion = items[0]?.label;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold text-slate-900">Departments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ label, value, pct, Icon }) => (
          <div key={label} className="rounded-md border border-slate-100 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <div className="font-medium text-slate-900">{label}</div>
                {!hideChampion && label === champion ? (
                  <span className="ml-2 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                    Top performer
                  </span>
                ) : null}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                SSP {value.toLocaleString()}
              </div>
            </div>

            <div className="mt-2">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-500"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {pct.toFixed(1)}% of revenue
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
