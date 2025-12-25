// client/src/components/dashboard/DepartmentsPanel.tsx
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DepartmentsPanelProps = {
  className?: string;
  departments: Array<{ id: string; code: string; name: string }>;
  departmentBreakdown?: Record<string, number>; // id -> SSP total
  totalSSP: number;

  /** Optional tuning (defaults chosen to be compact by default) */
  compact?: boolean;        // tighter paddings/typography
  maxVisible?: number;      // top N to show when collapsed
  collapsible?: boolean;    // show "Show all" / "Show less" toggle
  maxHeight?: number;       // px cap when expanded (scroll inside)
  isDarkMode?: boolean;     // dark mode support
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

// Border colors for left border visual hierarchy
const BORDER_BY_BASE: Record<BaseKey, string> = {
  LAB: "border-l-emerald-500",
  ULT: "border-l-sky-500",
  PHM: "border-l-violet-500",
  XRY: "border-l-cyan-600",
  CON: "border-l-orange-500",
  OTH: "border-l-slate-400",
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
  LABS: "LAB",
  LBR: "LAB",
  US: "ULT",
  ULS: "ULT",
  ULTRA: "ULT",
  PHARM: "PHM",
  PHR: "PHM",
  XR: "XRY",
  XRA: "XRY",
  RAD: "XRY",
  RADIO: "XRY",
  CONS: "CON",
  CNS: "CON",
  OPD: "CON",
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
  if (n.includes("x-ray") || n.includes("xray") || n.includes("radiolog")) return "XRY";
  if (n.includes("pharm") || n.includes("drug") || n.includes("medicine")) return "PHM";
  if (n.includes("consult") || n.includes("opd")) return "CON";
  return "OTH";
}

function toBaseKey(code: string, name: string): BaseKey {
  const c = (code || "").toUpperCase().trim();
  if (c && CODE_ALIASES[c]) return CODE_ALIASES[c];
  // loose matching on code too (e.g., "XR-01")
  if (c.includes("LAB")) return "LAB";
  if (c.includes("ULT") || c.includes("US")) return "ULT";
  if (c.includes("PHM") || c.includes("PHAR")) return "PHM";
  if (c.includes("XR") || c.includes("RAD")) return "XRY";
  if (c.includes("CON") || c.includes("OPD")) return "CON";
  if (c.includes("OTH")) return "OTH";
  return baseKeyFromName(name);
}

export default function DepartmentsPanel({
  className,
  departments = [],
  departmentBreakdown = {},
  totalSSP = 0,

  // compact by default so Insurance fits under it
  compact = true,
  maxVisible = 6,
  collapsible = true,
  maxHeight = 420,
  isDarkMode = false,
}: DepartmentsPanelProps) {
  // Filter out 'OTHER' department before processing
  const filtered = departments.filter(d => d.code !== 'OTHER');
  
  // Map + sort by amount desc
  const rows = filtered
    .map((d) => {
      const ssp = Number(departmentBreakdown[d.id] || 0);
      const pct = totalSSP > 0 ? (ssp / totalSSP) * 100 : 0;
      const base = toBaseKey(d.code, d.name);
      return { ...d, ssp, pct, base };
    })
    .sort((a, b) => b.ssp - a.ssp);

  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? rows : rows.slice(0, maxVisible);

  const nameCls = compact ? "text-sm font-medium text-slate-700" : "text-base font-medium text-slate-700";

  return (
    <Card className={cn("border border-slate-200 shadow-sm", className)}>
      <CardHeader className={cn(compact ? "pb-2.5" : "pb-3")}>
        <CardTitle className={cn("font-semibold text-slate-900", compact ? "text-lg" : "text-xl")}>
          Departments
        </CardTitle>
      </CardHeader>

      <CardContent className={cn(compact ? "pt-0" : "pt-1")}>
        {rows.length === 0 && (
          <div className="text-sm text-slate-500">No department data for this period.</div>
        )}

        {/* Enhanced department rows with visual hierarchy */}
        <div className={cn("space-y-2", expanded && "overflow-y-auto pr-1", expanded && `max-h-[${maxHeight}px]`)}>
          {visible.map((row) => {
            const Icon = ICON_BY_BASE[row.base];
            const colorBar = BAR_BY_BASE[row.base];
            const borderColor = BORDER_BY_BASE[row.base];
            return (
              <div 
                key={row.id} 
                className={cn(
                  "p-3 rounded-lg hover:bg-slate-50 transition-colors border-l-4",
                  borderColor
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 border border-slate-200">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                    </span>
                    <span className={nameCls}>{row.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      SSP {row.ssp.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {row.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Thicker progress bar with animation */}
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-2.5 rounded-full transition-all duration-500 ease-out", colorBar)}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand / collapse */}
        {collapsible && rows.length > maxVisible && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `Show all (${rows.length})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
