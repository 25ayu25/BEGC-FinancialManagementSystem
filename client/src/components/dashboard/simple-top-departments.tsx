import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FlaskConical, Waves, Radiation, Pill, Stethoscope, Ellipsis } from "lucide-react";

type Dept = { id: string; name: string; code?: string };

type Props = {
  /** keyed by departmentId -> amount in SSP */
  data: Record<string, number> | undefined;
  /** list of departments from API */
  departments: Dept[];
  /** optional max items to display */
  limit?: number;
};

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;

/** Pick an icon by normalized name */
const iconFor = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("lab")) return FlaskConical;
  if (n.includes("ultra")) return Waves;
  if (n.includes("x-ray") || n.includes("xray") || n.includes("radiology")) return Radiation;
  if (n.includes("pharm")) return Pill;
  if (n.includes("consult")) return Stethoscope;
  return Ellipsis;
};

/** Nice color per rank */
const colorFor = (i: number) =>
  [
    "text-emerald-600 bg-emerald-50",
    "text-sky-600 bg-sky-50",
    "text-violet-600 bg-violet-50",
    "text-orange-600 bg-orange-50",
    "text-slate-600 bg-slate-50",
  ][Math.min(i, 4)];

export default function SimpleTopDepartments({ data, departments, limit = 5 }: Props) {
  const pairs =
    departments?.map((d) => ({
      id: d.id,
      name: d.name,
      amount: Number(data?.[d.id] ?? 0),
    })) ?? [];

  // Sort by amount desc & slice
  const sorted = pairs.sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, limit);
  const total = sorted.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(...top.map((t) => t.amount), 1);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900">Departments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No department data</div>
        ) : (
          top.map((row, i) => {
            const Icon = iconFor(row.name);
            const pctOfTotal = total > 0 ? (row.amount / total) * 100 : 0;
            const barWidth = max > 0 ? Math.max(4, (row.amount / max) * 100) : 0;

            return (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5"
              >
                <div
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-slate-200",
                    colorFor(i)
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate font-medium text-slate-800">{row.name}</div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                        SSP {nf0.format(Math.round(row.amount))}
                      </div>
                      <div className="text-[11px] text-slate-500">{pct(pctOfTotal)}</div>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-orange-500", "bg-slate-500"][Math.min(i, 4)]
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
