import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FlaskConical,
  Waves,
  Pill,
  Scan,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";

type Department = {
  id: string;
  code?: string;
  name: string;
};

type Props = {
  departments: Department[];
  departmentBreakdown?: Record<string, number | string>; // keyed by dept.id
  totalSSP: number; // used for %
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const iconFor = (codeOrName?: string) => {
  const key = (codeOrName || "").toLowerCase();
  if (key.includes("lab")) return { Icon: FlaskConical, tint: "text-emerald-600 bg-emerald-50" };
  if (key.includes("ultra")) return { Icon: Waves, tint: "text-sky-600 bg-sky-50" };
  if (key.includes("x-ray") || key.includes("xray")) return { Icon: Scan, tint: "text-slate-600 bg-slate-100" };
  if (key.includes("pharm")) return { Icon: Pill, tint: "text-violet-600 bg-violet-50" };
  if (key.includes("consult")) return { Icon: MessageSquare, tint: "text-orange-600 bg-orange-50" };
  return { Icon: MoreHorizontal, tint: "text-slate-500 bg-slate-100" };
};

export default function DepartmentsPanel({ departments, departmentBreakdown = {}, totalSSP }: Props) {
  // Normalize items: ensure we show name, not id
  const rows = departments
    .map((d) => {
      const amountRaw = departmentBreakdown[d.id];
      const amount = typeof amountRaw === "string" ? parseFloat(amountRaw) : Number(amountRaw || 0);
      return {
        id: d.id,
        name: d.name || d.code || d.id,
        code: d.code,
        amount,
        pct: totalSSP > 0 ? (amount / totalSSP) * 100 : 0,
      };
    })
    .filter((r) => r.amount > 0) // hide empty
    .sort((a, b) => b.amount - a.amount);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-slate-900">
          Departments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500">No department revenue for this period.</div>
        ) : (
          rows.map((r, idx) => {
            const { Icon, tint } = iconFor(r.code || r.name);
            const bar =
              idx === 0
                ? "bg-emerald-500"
                : idx === 1
                ? "bg-sky-500"
                : idx === 2
                ? "bg-violet-500"
                : idx === 3
                ? "bg-orange-500"
                : "bg-slate-400";

            return (
              <div
                key={r.id}
                className="w-full rounded-lg border bg-white border-slate-100 p-3"
                data-testid={`row-department-${r.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${tint}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-slate-800 truncate">{r.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.pct.toFixed(1)}% of revenue
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-900 font-mono tabular-nums">
                      SSP {nf0.format(Math.round(r.amount))}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <Progress
                    value={r.pct}
                    className="h-1.5 bg-slate-100"
                    indicatorClassName={`${bar}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
