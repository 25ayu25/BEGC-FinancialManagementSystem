'use client';

import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/queryClient";
import { BarChart3, Plus, AreaChartIcon, LineChartIcon, TrendingUp, TrendingDown, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/* ----------------------------- Types ----------------------------- */

type TimeRange =
  | "current-month"
  | "last-month"
  | "month-select"
  | "last-3-months"
  | "year"
  | "custom";

type Props = {
  timeRange: TimeRange;
  selectedYear: number; // e.g. 2025
  selectedMonth: number; // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
  isDarkMode?: boolean;
};

/* ------------------------ Number Formatters ---------------------- */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
// for SSP labels in millions
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* ----------------------------- Utils ----------------------------- */

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1..12
}
function normalizedRange(range: TimeRange) {
  return range === "month-select" ? "current-month" : range;
}

function computeWindow(
  range: TimeRange,
  year: number,
  month: number,
  customStart?: Date,
  customEnd?: Date
) {
  const endOfMonth = (y: number, m: number) => new Date(y, m, 0);
  const startOfMonth = (y: number, m: number) => new Date(y, m - 1, 1);

  if (range === "custom" && customStart && customEnd) {
    return { start: new Date(customStart), end: new Date(customEnd) };
  }
  if (range === "last-3-months") {
    const end = endOfMonth(year, month);
    const start = new Date(year, month - 3, 1);
    return { start, end };
  }
  if (range === "year") {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  }
  if (range === "last-month") {
    const d = new Date(year, month - 1, 1);
    const last = new Date(d.getFullYear(), d.getMonth(), 0);
    return { start: new Date(last.getFullYear(), last.getMonth(), 1), end: last };
  }
  return { start: startOfMonth(year, month), end: endOfMonth(year, month) };
}

function isWideRange(range: TimeRange, start?: Date, end?: Date) {
  if (range === "last-3-months" || range === "year") return true;
  if (range === "custom" && start && end) {
    const ms = end.getTime() - start.getTime();
    return ms / 86400000 > 45;
  }
  return false;
}

function inferISOFromLabel(label: string, start: Date, end: Date): string | undefined {
  const m = label?.match?.(/^([A-Za-z]{3,})\s+(\d{1,2})$/);
  if (!m) return undefined;
  const mon = m[1].toLowerCase();
  const day = parseInt(m[2], 10);
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mi = months.indexOf(mon.slice(0,3));
  if (mi < 0) return undefined;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    if (cursor.getMonth() === mi) {
      const candidate = new Date(cursor.getFullYear(), mi, day);
      if (candidate >= start && candidate <= end) return format(candidate, "yyyy-MM-dd");
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return undefined;
}

async function fetchIncomeTrendsDaily(
  year: number,
  month: number,
  range: TimeRange,
  start?: Date,
  end?: Date
) {
  let url = `/api/income-trends/${year}/${month}?range=${normalizedRange(range)}`;
  if (range === "custom" && start && end) {
    url += `&startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(end, "yyyy-MM-dd")}`;
  }
  const { data } = await api.get(url);
  return Array.isArray(data) ? data : [];
}

/* --------- Axis ticks (nice-looking dynamic Y scale values) ------ */
function niceStep(roughStep: number) {
  if (roughStep <= 0) return 1;
  const exp = Math.floor(Math.log10(roughStep));
  const base = Math.pow(10, exp);
  const frac = roughStep / base;
  let niceFrac: number;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}
function buildNiceTicks(dataMax: number) {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const step = niceStep(dataMax / 4);
  const max = step * 4;
  return { max, ticks: [0, step, step * 2, step * 3, max] };
}
function buildTicksPreferred(dataMax: number, preferredMax: number) {
  if (dataMax <= preferredMax) {
    const step = preferredMax / 4;
    return { max: preferredMax, ticks: [0, step, step * 2, step * 3, preferredMax] };
  }
  return buildNiceTicks(dataMax);
}

/* ---------------------- Mobile helper hook --------------------- */

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [breakpoint]);
  return isMobile;
}

/* ------------------------- Tooltip component --------------------- */

type RTProps = {
  active?: boolean;
  payload?: any[];
  year?: number;
  month?: number; // for daily
  currency: "SSP" | "USD";
  mode: "daily" | "monthly";
  avgDaySSP?: number;
  avgDayUSD?: number;
  totalSSP?: number;
  totalUSD?: number;
};

function RevenueTooltip({ active, payload, year, month, currency, mode, avgDaySSP, avgDayUSD, totalSSP, totalUSD }: RTProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload ?? {};
  let title = "";

  if (mode === "daily") {
    const d = p.day as number | undefined;
    title =
      typeof d === "number" && year && month
        ? format(new Date(year, month - 1, d), "MMM d, yyyy")
        : p.dateISO ?? "";
  } else {
    const key = p.label as string | undefined; // "YYYY-MM"
    if (key && /^\d{4}-\d{2}$/.test(key)) {
      const [y, m] = key.split("-").map((x: string) => parseInt(x, 10));
      title = format(new Date(y, m - 1, 1), "MMM yyyy");
    } else {
      title = String(p.label ?? "");
    }
  }

  const value = Number(p.value ?? 0);
  const formatValue = nf0.format(Math.round(value));
  
  // Calculate percentage of total
  const total = currency === "SSP" ? (totalSSP ?? 0) : (totalUSD ?? 0);
  const percentOfTotal = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
  
  // Compare to average
  const avg = currency === "SSP" ? (avgDaySSP ?? 0) : (avgDayUSD ?? 0);
  const diffFromAvg = avg > 0 ? ((value - avg) / avg) * 100 : 0;

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[220px]">
      <div className="font-semibold text-slate-900 mb-2">{title}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Amount:</span>
          <span className="font-mono font-semibold text-slate-900">
            {currency} {formatValue}
          </span>
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">% of Total:</span>
            <span className="font-mono text-teal-600">{percentOfTotal}%</span>
          </div>
        )}
        {mode === "daily" && avg > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">vs Average:</span>
            <span className={cn(
              "font-mono font-medium",
              diffFromAvg > 0 ? "text-emerald-600" : diffFromAvg < 0 ? "text-red-600" : "text-slate-500"
            )}>
              {diffFromAvg > 0 ? "+" : ""}{diffFromAvg.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Modal ---------------------------- */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Handle escape key to close modal
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      // Store original overflow value
      const originalOverflow = document.body.style.overflow;
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
      
      // Cleanup: restore original overflow
      return () => {
        document.body.classList.remove("modal-open");
        document.body.style.overflow = originalOverflow || "";
      };
    }
  }, [open]);

  // Handle backdrop click to close modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl p-6 mx-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
          <h4 id="modal-title" className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Maximize2 className="h-5 w-5 text-teal-500" />
            {title}
          </h4>
          <button
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-2 transition-colors"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------- Chart Type State ----------------------- */
type ChartType = "area" | "line" | "bar";

/* ----------------------- Animation Constants ----------------------- */
const CHART_ANIMATION_DURATION = 800;
const CHART_ANIMATION_EASING = "ease-out";

/* ----------------------- Helper: Average Reference Line ----------------------- */
function renderAverageReferenceLine(
  avgValue: number,
  color: string,
  label: string
) {
  if (avgValue <= 0) return null;
  return (
    <ReferenceLine
      y={avgValue}
      stroke={color}
      strokeWidth={2}
      strokeDasharray="4 4"
      label={{
        value: label,
        position: "insideTopRight",
        style: { fontSize: 11, fill: color, fontWeight: 600 },
      }}
    />
  );
}

/* ----------------------- Drilldown helpers ----------------------- */

function normalizeTxDate(t: any): string | undefined {
  const src =
    t?.date ??
    t?.transactionDate ??
    t?.txnDate ??
    t?.createdAt ??
    t?.postedAt;
  if (!src) return undefined;

  if (typeof src === "string") {
    const iso = src.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const md = src.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (md) {
      const y = parseInt(md[3], 10);
      const m = parseInt(md[1], 10) - 1;
      const d = parseInt(md[2], 10);
      return format(new Date(Date.UTC(y, m, d)), "yyyy-MM-dd");
    }
  }
  const d = new Date(src);
  return isNaN(d.getTime()) ? undefined : format(d, "yyyy-MM-dd");
}

function asUTCWindow(fromISO: string, toISO: string) {
  const startDateTime = `${fromISO}T00:00:00.000Z`;
  const endDateTime = `${toISO}T23:59:59.999Z`;
  return { startDateTime, endDateTime };
}

/* ------------------------- Bar Label renderers ------------------- */

// Render small text above bars; skip zeros and very tiny bars
const renderSSPLabel = (props: any) => {
  const { x, y, width, value } = props;
  const v = Number(value ?? 0);
  if (!isFinite(v) || v <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(width))
    return null;
  const cx = x + width / 2;
  const cy = y - 4; // 4px above bar
  const text = compact.format(v); // e.g., 40M, 50.2M
  return (
    <text
      x={cx}
      y={cy}
      fill="#64748b"
      fontSize={11}
      textAnchor="middle"
      pointerEvents="none"
    >
      {text}
    </text>
  );
};

const renderUSDLabel = (props: any) => {
  const { x, y, width, value } = props;
  const v = Number(value ?? 0);
  if (!isFinite(v) || v <= 0 || !isFinite(x) || !isFinite(y) || !isFinite(width))
    return null;
  const cx = x + width / 2;
  const cy = y - 4;
  const text = nf0.format(Math.round(v)); // e.g., 15,450
  return (
    <text
      x={cx}
      y={cy}
      fill="#64748b"
      fontSize={11}
      textAnchor="middle"
      pointerEvents="none"
    >
      {text}
    </text>
  );
};

/* ------------------------------- Main ---------------------------- */

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
  isDarkMode = false,
}: Props) {
  const year = selectedYear;
  const month = selectedMonth;

  // Generate unique IDs for gradients to avoid conflicts when multiple instances exist
  const componentId = useMemo(() => `rev-${Math.random().toString(36).substr(2, 9)}`, []);

  const { start, end } = computeWindow(
    timeRange,
    year,
    month,
    customStartDate,
    customEndDate
  );
  const wide = isWideRange(timeRange, start, end);

  // controls month tick labels
  const singleYear =
    !!(start && end && start.getFullYear() === end.getFullYear());

  const days = daysInMonth(year, month);
  const isMobile = useIsMobile(768);

  const chartHeight = isMobile ? 260 : 340;

  const desiredXTicks = isMobile ? 12 : days;
  const xInterval = Math.max(0, Math.ceil(days / desiredXTicks) - 1);

  const baseDays = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days]
  );

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      "exec-daily-income",
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () =>
      fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
  });

  /* ------------------------ reference data ----------------------- */

  // Departments (for SSP rows)
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/api/departments", {
        params: { page: 1, pageSize: 1000 },
      });
      return res.data?.departments ?? res.data ?? [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const deptMap = useMemo(() => {
    const m = new Map<string | number, string>();
    (departments ?? []).forEach((d: any) => {
      m.set(d.id, d.name);
      m.set(String(d.id), d.name);
    });
    return m;
  }, [departments]);

  // Insurance providers (for USD rows)
  const { data: providers } = useQuery({
    queryKey: ["insurance-providers"],
    queryFn: async () => {
      const res = await api.get("/api/insurance-providers");
      return res.data?.providers ?? res.data ?? [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const providerMap = useMemo(() => {
    const m = new Map<string | number, string>();
    (providers ?? []).forEach((p: any) => {
      m.set(p.id, p.name);
      m.set(String(p.id), p.name);
    });
    return m;
  }, [providers]);

  /* ------------------- Shape data for charts ------------------- */

  // daily arrays: ensure an entry for **every** day
  const sspDaily = baseDays.map((day) => ({ day, value: 0 }));
  const usdDaily = baseDays.map((day) => ({ day, value: 0 }));

  const sspMonthlyMap = new Map<string, number>();
  const usdMonthlyMap = new Map<string, number>();

  for (const r of raw as any[]) {
    const incomeSSP = Number(r.incomeSSP ?? 0);
    const incomeUSD = Number(r.incomeUSD ?? 0);

    let iso = (r as any).dateISO as string | undefined;
    if (!iso && typeof r.date === "string" && start && end) {
      iso = inferISOFromLabel(r.date, start, end);
    }

    if (!wide) {
      let d: number | undefined;
      if (iso) {
        const dt = new Date(iso + "T00:00:00");
        const y = dt.getFullYear();
        const m = dt.getMonth() + 1;
        if (y !== year || m !== month) continue;
        d = dt.getDate();
      } else if ((r as any).day) {
        d = Number((r as any).day);
      } else if (typeof r.date === "string") {
        const mm = r.date.match(/^\D+\s+(\d{1,2})$/);
        if (mm) d = parseInt(mm[1], 10);
      }

      if (typeof d === "number" && d >= 1 && d <= days) {
        sspDaily[d - 1].value += incomeSSP;
        usdDaily[d - 1].value += incomeUSD;
      }
    } else {
      let key: string | undefined;
      if (iso) key = iso.slice(0, 7);
      else if (typeof r.date === "string" && start && end) {
        const ii = inferISOFromLabel(r.date, start, end);
        if (ii) key = ii.slice(0, 7);
      }
      if (!key) continue;
      sspMonthlyMap.set(key, (sspMonthlyMap.get(key) ?? 0) + incomeSSP);
      usdMonthlyMap.set(key, (usdMonthlyMap.get(key) ?? 0) + incomeUSD);
    }
  }

  const monthlyKeys = Array.from(
    new Set([...sspMonthlyMap.keys(), ...usdMonthlyMap.keys()])
  ).sort();
  const sspMonthly = monthlyKeys.map((k) => ({
    label: k,
    value: sspMonthlyMap.get(k) ?? 0,
  }));
  const usdMonthly = monthlyKeys.map((k) => ({
    label: k,
    value: usdMonthlyMap.get(k) ?? 0,
  }));

  /* ------------------- Totals & Averages ------------------- */

  const totalSSP = (!wide ? sspDaily : sspMonthly).reduce(
    (s, r: any) => s + (r.value || 0),
    0
  );
  const totalUSD = (!wide ? usdDaily : usdMonthly).reduce(
    (s, r: any) => s + (r.value || 0),
    0
  );

  const activeDaysSSP = !wide
    ? sspDaily.filter((d) => d.value > 0).length || 0
    : 0;
  const activeDaysUSD = !wide
    ? usdDaily.filter((d) => d.value > 0).length || 0
    : 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  /* ------------------- Axis scaling ------------------- */

  const dataMaxSSP = Math.max(
    0,
    ...(!wide ? sspDaily.map((d) => d.value) : sspMonthly.map((d) => d.value))
  );
  const dataMaxUSD = Math.max(
    0,
    ...(!wide ? usdDaily.map((d) => d.value) : usdMonthly.map((d) => d.value))
  );

  // Daily: fixed baseline; Monthly/wide: dynamic
  const preferredSSPMax = 4_500_000; // <- requested baseline
  const preferredUSDMax = 1_250; // <- requested baseline

  const sspScale = !wide
    ? buildTicksPreferred(dataMaxSSP, preferredSSPMax)
    : buildNiceTicks(dataMaxSSP);

  const usdScale = !wide
    ? buildTicksPreferred(dataMaxUSD, preferredUSDMax)
    : buildNiceTicks(dataMaxUSD);

  const yMaxSSP = sspScale.max;
  const ticksSSP = sspScale.ticks;
  const yMaxUSD = usdScale.max;
  const ticksUSD = usdScale.ticks;

  const headerLabel = !wide
    ? format(new Date(year, month - 1, 1), "MMM yyyy")
    : timeRange === "year" && singleYear
    ? `${format(start, "MMM yyyy")} – ${format(end, "MMM yyyy")}`
    : `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;

  /* ------------------- Drilldown (click bars) ------------------- */

  const [open, setOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<{
    from?: string;
    to?: string;
    items: any[];
    currency?: "SSP" | "USD";
  }>({
    items: [],
  });

  // Chart type state
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [showAvgLine, setShowAvgLine] = useState(true);

  // Prefer department for SSP, provider for USD; fallbacks included.
  function displaySource(t: any) {
    const currency = String(t.currency || "").toUpperCase();

    const dept =
      t.departmentName ??
      t.department_name ??
      t.department?.name ??
      deptMap.get(t.departmentId) ??
      deptMap.get(t.department_id);

    const provider =
      t.insuranceProviderName ?? // from API join
      t.insurance_provider_name ?? // alt snake_case
      t.insuranceProvider?.name ?? // nested shape
      providerMap.get(t.insuranceProviderId) ?? // fallback by id
      providerMap.get(t.insurance_provider_id) ?? // alt id key
      undefined;

    // USD = insurance revenue ⇒ show provider; SSP ⇒ show department.
    if (currency === "USD") return provider ?? "-";
    return dept ?? provider ?? "-";
  }

  async function loadTransactionsByRange(
    fromISO: string,
    toISO: string,
    currency: "SSP" | "USD"
  ) {
    setOpen(true);
    setLoadingDetail(true);
    try {
      const { startDateTime, endDateTime } = asUTCWindow(fromISO, toISO);

      const attempts: Array<Record<string, string | number>> = [
        { page: 1, pageSize: 1000, startDate: fromISO, endDate: toISO },
        { page: 1, pageSize: 1000, fromDate: fromISO, toDate: toISO },
        { page: 1, pageSize: 1000, start: fromISO, end: toISO },
        { page: 1, pageSize: 1000, start_date: fromISO, end_date: toISO },
        { page: 1, pageSize: 1000, dateFrom: fromISO, dateTo: toISO },
        { page: 1, pageSize: 1000, rangeStart: fromISO, rangeEnd: toISO },
        { page: 1, pageSize: 1000, startDateTime, endDateTime }, // UTC window
        { page: 1, pageSize: 1000, date: fromISO }, // single date
      ];

      for (const params of attempts) {
        const res = await api.get("/api/transactions", { params });
        const raw =
          res.data?.transactions ??
          res.data?.items ??
          (Array.isArray(res.data) ? res.data : []);

        const filtered = raw.filter((t: any) => {
          const d = normalizeTxDate(t);
          const c = (t.currency || "").toUpperCase();
          const ty = (t.type || "").toLowerCase();
          const isIncome =
            ty === "income" || ty === "credit" || ty === "revenue";
          return d
            ? d >= fromISO && d <= toISO && c === currency && isIncome
            : false;
        });

        if (filtered.length > 0) {
          setDetail({ from: fromISO, to: toISO, items: filtered, currency });
          return;
        }
      }

      setDetail({ from: fromISO, to: toISO, items: [], currency });
    } finally {
      setLoadingDetail(false);
    }
  }

  const onClickDailySSP = (payload: any) => {
    const d = payload?.day as number | undefined;
    if (!d) return;
    const iso = format(new Date(year, month - 1, d), "yyyy-MM-dd");
    loadTransactionsByRange(iso, iso, "SSP");
  };
  const onClickDailyUSD = (payload: any) => {
    const d = payload?.day as number | undefined;
    if (!d) return;
    const iso = format(new Date(year, month - 1, d), "yyyy-MM-dd");
    loadTransactionsByRange(iso, iso, "USD");
  };
  const onClickMonthlySSP = (payload: any) => {
    const key = payload?.label as string | undefined;
    if (!key || !/^\d{4}-\d{2}$/.test(key)) return;
    const [y, m] = key.split("-").map((n: string) => parseInt(n, 10));
    const first = format(new Date(y, m - 1, 1), "yyyy-MM-dd");
    const last = format(new Date(y, m, 0), "yyyy-MM-dd");
    loadTransactionsByRange(first, last, "SSP");
  };
  const onClickMonthlyUSD = (payload: any) => {
    const key = payload?.label as string | undefined;
    if (!key || !/^\d{4}-\d{2}$/.test(key)) return;
    const [y, m] = key.split("-").map((n: string) => parseInt(n, 10));
    const first = format(new Date(y, m - 1, 1), "yyyy-MM-dd");
    const last = format(new Date(y, m, 0), "yyyy-MM-dd");
    loadTransactionsByRange(first, last, "USD");
  };

  /* ------------------------------- UI ---------------------------- */

  const showBarLabels = wide; // labels only in Monthly view to avoid clutter in Daily

  // Check if there's no data to display
  const hasNoData = totalSSP === 0 && totalUSD === 0;

  return (
    <Card className={cn(
      "shadow-md transition-all duration-300",
      isDarkMode
        ? "bg-white/3 border border-white/10 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        : "border border-slate-100 bg-white hover:shadow-lg"
    )}>
      {/* HEADER WITH INTEGRATED METRICS */}
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            <CardTitle className={cn(
              "text-base md:text-lg font-semibold",
              isDarkMode ? "text-white/95" : "text-slate-900"
            )}>
              Revenue Analytics
            </CardTitle>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex gap-1 p-1 rounded-lg",
              isDarkMode ? "bg-white/5" : "bg-slate-100"
            )}>
              <Button
                variant={chartType === "bar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("bar")}
                className={cn(
                  "h-8 px-2 transition-all duration-200",
                  chartType === "bar" 
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600"
                    : isDarkMode && "hover:bg-white/10 text-white/70"
                )}
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "line" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("line")}
                className={cn(
                  "h-8 px-2 transition-all duration-200",
                  chartType === "line" 
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600"
                    : isDarkMode && "hover:bg-white/10 text-white/70"
                )}
              >
                <LineChartIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "area" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("area")}
                className={cn(
                  "h-8 px-2 transition-all duration-200",
                  chartType === "area" 
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600"
                    : isDarkMode && "hover:bg-white/10 text-white/70"
                )}
              >
                <AreaChartIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Period Label and Inline Stats */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-white/80" : "text-slate-700"
            )}>{headerLabel}</span>
            {!hasNoData && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isDarkMode ? "text-white/65" : "text-slate-500"
              )}>
                <TrendingUp className="h-3 w-3 text-teal-500" />
                <span>Trending</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-8">
        {/* Empty State */}
        {hasNoData && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <BarChart3 className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No revenue data yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Revenue will appear here once transactions are recorded.
            </p>
            <Link href="/transactions">
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-pulse space-y-4 w-full">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-64 bg-slate-200 rounded"></div>
            </div>
          </div>
        ) : (
          <>
            {/* SSP Chart */}
            <section aria-label={`SSP ${wide ? "monthly" : "daily"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    isDarkMode ? "text-white/90" : "text-slate-700"
                  )}>
                    <span className="w-3 h-3 bg-teal-500 rounded-sm"></span>
                    SSP ({wide ? "Monthly" : "Daily"})
                  </p>
                  {!hasNoData && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold border",
                        isDarkMode
                          ? "bg-teal-500/15 text-teal-300 border-teal-400/30"
                          : "bg-teal-50 text-teal-700 border-teal-100"
                      )}>
                        TOTAL SSP {nf0.format(Math.round(totalSSP))}
                      </span>
                      {!wide && avgDaySSP > 0 && (
                        <>
                          <span className={cn(
                            isDarkMode ? "text-white/30" : "text-slate-300"
                          )}>|</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium border",
                            isDarkMode
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}>
                            AVG SSP / DAY {nf0.format(avgDaySSP)} ({activeDaysSSP} active days)
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {!wide && avgDaySSP > 0 && (
                  <button
                    onClick={() => setShowAvgLine(!showAvgLine)}
                    className={cn(
                      "text-xs transition-colors",
                      isDarkMode
                        ? "text-white/75 hover:text-teal-400"
                        : "text-slate-500 hover:text-teal-600"
                    )}
                  >
                    {showAvgLine ? "Hide" : "Show"} Average Line
                  </button>
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg border shadow-sm",
                  isDarkMode
                    ? "border-white/10 bg-transparent"
                    : "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
                )}
                style={{ height: chartHeight }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart
                      data={wide ? sspMonthly : sspDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                      barCategoryGap="26%"
                    >
                      <defs>
                        <linearGradient id={`barGradientSSP-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxSSP]}
                        ticks={ticksSSP}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="SSP"
                            mode={wide ? "monthly" : "daily"}
                            avgDaySSP={avgDaySSP}
                            totalSSP={totalSSP}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDaySSP,
                        "#14b8a6",
                        `Avg ${compact.format(avgDaySSP)}`
                      )}
                      <Bar
                        dataKey="value"
                        fill={`url(#barGradientSSP-${componentId})`}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                        onClick={(p: any) =>
                          wide
                            ? onClickMonthlySSP(p?.payload)
                            : onClickDailySSP(p?.payload)
                        }
                        style={{ cursor: "pointer" }}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      >
                        {showBarLabels && (
                          <LabelList dataKey="value" content={renderSSPLabel} />
                        )}
                      </Bar>
                    </BarChart>
                  ) : chartType === "line" ? (
                    <LineChart
                      data={wide ? sspMonthly : sspDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxSSP]}
                        ticks={ticksSSP}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="SSP"
                            mode={wide ? "monthly" : "daily"}
                            avgDaySSP={avgDaySSP}
                            totalSSP={totalSSP}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDaySSP,
                        "#14b8a6",
                        `Avg ${compact.format(avgDaySSP)}`
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#14b8a6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#14b8a6", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 6, fill: "#0d9488" }}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart
                      data={wide ? sspMonthly : sspDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                    >
                      <defs>
                        <linearGradient id={`areaGradientSSP-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxSSP]}
                        ticks={ticksSSP}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="SSP"
                            mode={wide ? "monthly" : "daily"}
                            avgDaySSP={avgDaySSP}
                            totalSSP={totalSSP}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDaySSP,
                        "#14b8a6",
                        `Avg ${compact.format(avgDaySSP)}`
                      )}
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        fill={`url(#areaGradientSSP-${componentId})`}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            {/* USD Chart */}
            <section aria-label={`USD ${wide ? "monthly" : "daily"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <p className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    isDarkMode ? "text-white/90" : "text-slate-700"
                  )}>
                    <span className="w-3 h-3 bg-sky-500 rounded-sm"></span>
                    USD ({wide ? "Monthly" : "Daily"})
                  </p>
                  {!hasNoData && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold border",
                        isDarkMode
                          ? "bg-sky-500/15 text-sky-300 border-sky-400/30"
                          : "bg-sky-50 text-sky-700 border-sky-100"
                      )}>
                        TOTAL USD {nf0.format(Math.round(totalUSD))}
                      </span>
                      {!wide && avgDayUSD > 0 && (
                        <>
                          <span className={cn(
                            isDarkMode ? "text-white/30" : "text-slate-300"
                          )}>|</span>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium border",
                            isDarkMode
                              ? "bg-blue-500/15 text-blue-300 border-blue-400/30"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          )}>
                            AVG USD / DAY {nf0.format(avgDayUSD)} ({activeDaysUSD} active days)
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {!wide && avgDayUSD > 0 && (
                  <button
                    onClick={() => setShowAvgLine(!showAvgLine)}
                    className={cn(
                      "text-xs transition-colors",
                      isDarkMode
                        ? "text-white/75 hover:text-sky-400"
                        : "text-slate-500 hover:text-sky-600"
                    )}
                  >
                    {showAvgLine ? "Hide" : "Show"} Average Line
                  </button>
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg border shadow-sm",
                  isDarkMode
                    ? "border-white/10 bg-transparent"
                    : "border-slate-200 bg-gradient-to-br from-slate-50 to-white"
                )}
                style={{ height: chartHeight }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart
                      data={wide ? usdMonthly : usdDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                      barCategoryGap="26%"
                    >
                      <defs>
                        <linearGradient id={`barGradientUSD-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#0284c7" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxUSD]}
                        ticks={ticksUSD}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="USD"
                            mode={wide ? "monthly" : "daily"}
                            avgDayUSD={avgDayUSD}
                            totalUSD={totalUSD}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDayUSD,
                        "#0ea5e9",
                        `Avg ${nf0.format(avgDayUSD)}`
                      )}
                      <Bar
                        dataKey="value"
                        fill={`url(#barGradientUSD-${componentId})`}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                        onClick={(p: any) =>
                          wide
                            ? onClickMonthlyUSD(p?.payload)
                            : onClickDailyUSD(p?.payload)
                        }
                        style={{ cursor: "pointer" }}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      >
                        {showBarLabels && (
                          <LabelList dataKey="value" content={renderUSDLabel} />
                        )}
                      </Bar>
                    </BarChart>
                  ) : chartType === "line" ? (
                    <LineChart
                      data={wide ? usdMonthly : usdDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxUSD]}
                        ticks={ticksUSD}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="USD"
                            mode={wide ? "monthly" : "daily"}
                            avgDayUSD={avgDayUSD}
                            totalUSD={totalUSD}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDayUSD,
                        "#0ea5e9",
                        `Avg ${nf0.format(avgDayUSD)}`
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0ea5e9"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 6, fill: "#0284c7" }}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart
                      data={wide ? usdMonthly : usdDaily}
                      margin={{ top: 20, right: 12, left: 12, bottom: 18 }}
                    >
                      <defs>
                        <linearGradient id={`areaGradientUSD-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      {!wide ? (
                        <XAxis
                          dataKey="day"
                          interval={xInterval}
                          minTickGap={2}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      ) : (
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickFormatter={(k: string) => {
                            if (/^\d{4}-\d{2}$/.test(k)) {
                              const y = parseInt(k.slice(0, 4), 10);
                              const m = parseInt(k.slice(5, 7), 10) - 1;
                              return format(
                                new Date(y, m, 1),
                                singleYear ? "MMM" : "MMM ''yy"
                              );
                            }
                            return k;
                          }}
                          interval="preserveStartEnd"
                          minTickGap={8}
                          tickMargin={8}
                          axisLine={false}
                          tickLine={false}
                        />
                      )}
                      <YAxis
                        domain={[0, yMaxUSD]}
                        ticks={ticksUSD}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => nf0.format(v as number)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(p: any) => (
                          <RevenueTooltip
                            {...p}
                            year={!wide ? year : undefined}
                            month={!wide ? month : undefined}
                            currency="USD"
                            mode={wide ? "monthly" : "daily"}
                            avgDayUSD={avgDayUSD}
                            totalUSD={totalUSD}
                          />
                        )}
                      />
                      {!wide && showAvgLine && renderAverageReferenceLine(
                        avgDayUSD,
                        "#0ea5e9",
                        `Avg ${nf0.format(avgDayUSD)}`
                      )}
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill={`url(#areaGradientUSD-${componentId})`}
                        animationDuration={CHART_ANIMATION_DURATION}
                        animationEasing={CHART_ANIMATION_EASING}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </CardContent>

      {/* Drilldown modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          detail.from && detail.to
            ? detail.from === detail.to
              ? `Transactions · ${format(new Date(detail.from), "MMM d, yyyy")} · ${detail.currency ?? ""}`
              : `Transactions · ${format(new Date(detail.from), "MMM d")} → ${format(new Date(detail.to), "MMM d, yyyy")} · ${
                  detail.currency ?? ""
                }`
            : "Transactions"
        }
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            <span className="ml-3 text-sm text-slate-600">Loading transactions...</span>
          </div>
        ) : detail.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-3">
              <BarChart3 className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No transactions found</p>
            <p className="text-sm text-slate-500 mt-1">There are no transactions for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-slate-600 uppercase text-xs tracking-wider">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Source</th>
                  <th className="py-3 px-4 font-semibold">Currency</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.items.map((t: any, idx: number) => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {String(
                        (
                          t.date ??
                          t.transactionDate ??
                          t.createdAt ??
                          t.postedAt
                        ) ?? ""
                      ).slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{displaySource(t)}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        t.currency === "SSP" ? "bg-teal-100 text-teal-700" : "bg-sky-100 text-sky-700"
                      )}>
                        {t.currency}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {nf0.format(Math.round(t.amount ?? 0))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        {t.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
              <span>Total: {detail.items.length} transaction{detail.items.length !== 1 ? "s" : ""}</span>
              <span className="font-mono font-semibold">
                Total Amount: {detail.currency} {nf0.format(detail.items.reduce((sum, t) => {
                  const amount = Number(t.amount) || 0;
                  return sum + amount;
                }, 0))}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
