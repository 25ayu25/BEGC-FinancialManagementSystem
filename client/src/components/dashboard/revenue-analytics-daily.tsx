'use client';

import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "@/lib/queryClient";

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
  selectedYear: number;   // e.g. 2025
  selectedMonth: number;  // 1..12
  customStartDate?: Date;
  customEndDate?: Date;
};

/* ------------------------ Number Formatters ---------------------- */

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
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

/* ------------------------ Mobile helper hook --------------------- */

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
};

function RevenueTooltip({ active, payload, year, month, currency, mode }: RTProps) {
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

  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg min-w-[180px]">
      <div className="font-semibold text-slate-900 mb-1">{title}</div>
      <div className="text-sm text-slate-700 font-mono">
        {currency} {formatValue}
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <button className="text-slate-500 hover:text-slate-700 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto">{children}</div>
      </div>
    </div>
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

/* ------------------------------- Main ---------------------------- */

export default function RevenueAnalyticsDaily({
  timeRange,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
}: Props) {
  const year = selectedYear;
  const month = selectedMonth;

  const { start, end } = computeWindow(timeRange, year, month, customStartDate, customEndDate);
  const wide = isWideRange(timeRange, start, end);

  const days = daysInMonth(year, month);
  const isMobile = useIsMobile(768);

  const chartHeight = isMobile ? 260 : 340;

  const desiredXTicks = isMobile ? 12 : days;
  const xInterval = Math.max(0, Math.ceil(days / desiredXTicks) - 1);

  const baseDays = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);

  const { data: raw = [], isLoading } = useQuery({
    queryKey: [
      "exec-daily-income",
      year,
      month,
      normalizedRange(timeRange),
      customStartDate?.toISOString(),
      customEndDate?.toISOString(),
    ],
    queryFn: () => fetchIncomeTrendsDaily(year, month, timeRange, customStartDate, customEndDate),
  });

  /* ------------------------ reference data ----------------------- */

  // Departments (for SSP rows)
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/api/departments", { params: { page: 1, pageSize: 1000 } });
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

  const monthlyKeys = Array.from(new Set([...sspMonthlyMap.keys(), ...usdMonthlyMap.keys()])).sort();
  const sspMonthly = monthlyKeys.map((k) => ({ label: k, value: sspMonthlyMap.get(k) ?? 0 }));
  const usdMonthly = monthlyKeys.map((k) => ({ label: k, value: usdMonthlyMap.get(k) ?? 0 }));

  /* ------------------- Totals & Averages ------------------- */

  const totalSSP = (!wide ? sspDaily : sspMonthly).reduce((s, r: any) => s + (r.value || 0), 0);
  const totalUSD = (!wide ? usdDaily : usdMonthly).reduce((s, r: any) => s + (r.value || 0), 0);

  const activeDaysSSP = !wide ? sspDaily.filter((d) => d.value > 0).length || 0 : 0;
  const activeDaysUSD = !wide ? usdDaily.filter((d) => d.value > 0).length || 0 : 0;
  const avgDaySSP = activeDaysSSP ? Math.round(totalSSP / activeDaysSSP) : 0;
  const avgDayUSD = activeDaysUSD ? Math.round(totalUSD / activeDaysUSD) : 0;

  /* ------------------- Axis scaling ------------------- */

  const dataMaxSSP = Math.max(0, ...(!wide ? sspDaily.map((d) => d.value) : sspMonthly.map((d) => d.value)));
  const dataMaxUSD = Math.max(0, ...(!wide ? usdDaily.map((d) => d.value) : usdMonthly.map((d) => d.value)));

  // Daily: fixed baseline; Monthly/wide: dynamic
  const preferredSSPMax = 4_500_000; // <- requested baseline
  const preferredUSDMax = 1_250;     // <- requested baseline

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
    : `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;

  /* ------------------- Drilldown (click bars) ------------------- */

  const [open, setOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<{ from?: string; to?: string; items: any[]; currency?: "SSP"|"USD" }>({
    items: [],
  });

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
      t.insuranceProviderName ??                 // from API join
      t.insurance_provider_name ??               // alt snake_case
      t.insuranceProvider?.name ??               // nested shape
      providerMap.get(t.insuranceProviderId) ??  // fallback by id
      providerMap.get(t.insurance_provider_id) ?? // alt id key
      undefined;

    // USD = insurance revenue ⇒ show provider; SSP ⇒ show department.
    if (currency === "USD") return provider ?? "-";
    return dept ?? provider ?? "-";
  }

  async function loadTransactionsByRange(fromISO: string, toISO: string, currency: "SSP" | "USD") {
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
        { page: 1, pageSize: 1000, date: fromISO },             // single date
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
          const isIncome = ty === "income" || ty === "credit" || ty === "revenue";
          return d ? d >= fromISO && d <= toISO && c === currency && isIncome : false;
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

  return (
    <Card className="border-0 shadow-md bg-white">
      <CardHeader className="pb-0">
        <CardTitle className="text-base md:text-lg font-semibold text-slate-900">
          Revenue Analytics
        </CardTitle>
        <div className="mt-1 text-sm text-slate-600">
          {headerLabel} · SSP {nf0.format(totalSSP)} · USD {nf0.format(totalUSD)}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* SSP */}
        <section aria-label={`SSP ${wide ? "monthly" : "daily"}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">SSP ({wide ? "Monthly" : "Daily"})</p>
            {!wide ? (
              <span className="text-xs text-slate-500">
                Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
                <span className="mx-2">•</span>
                Avg/day: <span className="font-semibold">SSP {nf0.format(avgDaySSP)}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Total: <span className="font-semibold">SSP {nf0.format(totalSSP)}</span>
              </span>
            )}
          </div>
          <div className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={wide ? sspMonthly : sspDaily}
                margin={{ top: 8, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="26%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
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
                    tickFormatter={(k: string) =>
                      /^\d{4}-\d{2}$/.test(k)
                        ? format(new Date(parseInt(k.slice(0, 4)), parseInt(k.slice(5, 7)) - 1, 1), "MMM yyyy")
                        : k
                    }
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
                    />
                  )}
                />
                <Bar
                  dataKey="value"
                  name="SSP"
                  fill="#14b8a6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  onClick={(p: any) => (wide ? onClickMonthlySSP(p?.payload) : onClickDailySSP(p?.payload))}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* USD */}
        <section aria-label={`USD ${wide ? "monthly" : "daily"}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">USD ({wide ? "Monthly" : "Daily"})</p>
            {!wide ? (
              <span className="text-xs text-slate-500">
                Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
                <span className="mx-2">•</span>
                Avg/day: <span className="font-semibold">USD {nf0.format(avgDayUSD)}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Total: <span className="font-semibold">USD {nf0.format(totalUSD)}</span>
              </span>
            )}
          </div>
          <div className="rounded-lg border border-slate-200" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={wide ? usdMonthly : usdDaily}
                margin={{ top: 8, right: 12, left: 12, bottom: 18 }}
                barCategoryGap="26%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
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
                    tickFormatter={(k: string) =>
                      /^\d{4}-\d{2}$/.test(k)
                        ? format(new Date(parseInt(k.slice(0, 4)), parseInt(k.slice(5, 7)) - 1, 1), "MMM yyyy")
                        : k
                    }
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
                    />
                  )}
                />
                <Bar
                  dataKey="value"
                  name="USD"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  onClick={(p: any) => (wide ? onClickMonthlyUSD(p?.payload) : onClickDailyUSD(p?.payload))}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {isLoading && (
          <div className="text-center text-slate-500 text-sm">
            Loading revenue…
          </div>
        )}
      </CardContent>

      {/* Drilldown modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          detail.from && detail.to
            ? detail.from === detail.to
              ? `Transactions · ${detail.from} · ${detail.currency ?? ""}`
              : `Transactions · ${detail.from} → ${detail.to} · ${detail.currency ?? ""}`
            : "Transactions"
        }
      >
        {loadingDetail ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : detail.items.length === 0 ? (
          <div className="text-sm text-slate-600">No transactions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Dept / Provider</th>
                <th className="py-2">Currency</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((t: any) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-2">
                    {String((t.date ?? t.transactionDate ?? t.createdAt ?? t.postedAt) ?? "").slice(0, 10)}
                  </td>
                  <td className="py-2">{displaySource(t)}</td>
                  <td className="py-2">{t.currency}</td>
                  <td className="py-2">{nf0.format(Math.round(t.amount ?? 0))}</td>
                  <td className="py-2">{t.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </Card>
  );
}
