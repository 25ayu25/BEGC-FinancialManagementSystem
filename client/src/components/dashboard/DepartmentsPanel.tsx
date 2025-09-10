// client/src/components/dashboard/DepartmentsPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlaskConical,
  Waves,
  Pill,
  Scan,
  Stethoscope,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DepartmentsPanelProps = {
  className?: string;
  departments: Array<{ id: string; code: string; name: string }>;
  departmentBreakdown?: Record<string, number>; // id -> SSP total
  totalSSP: number;
};

// --- Base keys we support visually ---
type BaseKey = "LAB" | "ULT" | "PHM" | "XRY" | "CON" | "OTH";

// icon by *base key* (consistent style with your existing design)
const ICON_BY_BASE: Record<BaseKey, LucideIcon> = {
  LAB: FlaskConical,
  ULT: Waves,
  PHM: Pill,
  XRY: Scan,
  CON: Stethoscope,
  OTH: MoreHorizontal,
};

// color by *base key* (kept your colors)
const BAR_BY_BASE: Record<BaseKey, string> = {
  LAB: "bg-emerald-500",
  ULT: "bg-sky-500",
  PHM: "bg-violet-500",
  XRY: "bg-cyan-600",
  CON: "bg-orange-500",
  OTH: "bg-slate-400",
};

// map common code aliases to a base key
const CODE_ALIASES: Record<string, BaseKey> = {
  // your originals
  LAB: "LAB",
  ULT: "ULT",
  PHM: "PHM",
  XRY: "XRY",
  CON: "CON",

  // extras / common alternates
  // Laboratory
  LABS: "LAB",
  LBR: "LAB",

  // Ultrasound
  US: "ULT",
  ULS: "ULT",
  ULTRA: "ULT",

  // Pharmacy
  PHARM: "PHM",
  PHR: "PHM",

  // X-Ray / Radiology
  XR: "XRY",
  XRA: "XRY",
  RAD: "XRY",
  RADIO: "XRY",

  // Consultation / OPD
  CONS: "CON",
  CNS: "CON",
  OPD: "CON",

  // Other
  OTH: "OTH",
  OTHER: "OTH",
  OTR: "OTH",
  OT: "OTH",
};

// name-based fallback if code doesn’t match anything
function baseKeyFromName(name: string): BaseKey {
  const n = name.toLowerCase();
  if (n.includes("lab")) return "LAB";
  if (n.includes("ultra")) return "ULT";
  if (n.includes("x-ray") || n.includes("xray") || n.includes("radiolog"))
    return "XRY";
  if (n.includes("pharm") || n.includes("drug") || n.includes("medicine"))
    return "PHM";
  if (n.includes("consult") || n.includes("opd")) return "CON";
  return "OTH";
}

function toBaseKey(code: string, name: string): BaseKey {
  const c = (code || "").toUpperCase().trim();
  if (c && CODE_ALIASES[c]) return CODE_ALIASES[c];
  // try loose matching on code too (e.g., "XR-01")
  if (c.includes("LAB")) return "LAB";
  if (c.includes("ULT") || c.includes("US")) return "ULT";
  if (c.includes("PHM") || c.includes("PHAR")) return "PHM";
  if (c.includes("XR") || c.includes("RAD")) return "XRY";
  if (c.includes("CON") || c.includes("OPD")) return "CON";
  if (c.includes("OTH")) return "OTH";
  // final fallback by name
  return baseKeyFromName(name);
}

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
      const base = toBaseKey(d.code, d.name);
      return { ...d, ssp, pct, base };
    })
    .sort((a, b) => b.ssp - a.ssp);

  return (
    <Card className={cn("border border-slate-200 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-slate-900">
          Departments
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {rows.length === 0 && (
          <div className="text-sm text-slate-500">
            No department data for this period.
          </div>
        )}

        {rows.map((row) => {
          const Icon = ICON_BY_BASE[row.base];
          const colorBar = BAR_BY_BASE[row.base];

          return (
            <div key={row.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 border border-slate-200">
                    <Icon className="h-3.5 w-3.5 text-slate-700" />
                  </span>
                  <div className="text-sm font-medium text-slate-900">
                    {row.name}
                  </div>
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
