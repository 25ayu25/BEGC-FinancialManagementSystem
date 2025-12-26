import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import IncomeChart, { Row as ChartRow } from "./income-chart"; // your patched chart
import { useDateFilter } from "@/context/date-filter-context";
import { format } from "date-fns";

/** Try to infer YYYY-MM-DD from a label like "Sep 4" within a known range. */
function inferISOFromLabel(label: string, start: Date, end: Date): string | undefined {
  // label formats your API returns daily: "Sep 4", "Oct 12" (no year)
  const m = label.match(/^([A-Za-z]{3,})\s+(\d{1,2})$/);
  if (!m) return undefined;
  const monthName = m[1].toLowerCase();
  const day = parseInt(m[2], 10);
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mi = months.indexOf(monthName.slice(0,3));
  if (mi < 0) return undefined;

  // Find the year+month inside [start..end] window that matches this month index.
  // Works for last-3-months/year windows; prefers the earliest match in range.
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    if (cursor.getMonth() === mi) {
      const candidate = new Date(cursor.getFullYear(), mi, day);
      if (candidate >= start && candidate <= end) {
        return format(candidate, "yyyy-MM-dd");
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return undefined;
}

function isWideRange(start?: Date, end?: Date) {
  if (!start || !end) return false;
  const ms = end.getTime() - start.getTime();
  return ms / (1000 * 60 * 60 * 24) > 45; // > ~1.5 months
}

export default function RevenueAnalyticsCard() {
  const { startDate, endDate, timeRange, selectedYear, selectedMonth, periodLabel } = useDateFilter();

  // Map our timeRange to the backend "range" param the existing route expects.
  // Keep names aligned with your server (current-month/last-month/last-3-months/year/custom).
  const rangeParam = timeRange;

  // We call the existing income-trends route that already supports a :year/:month + ?range setup.
  const baseYear = selectedYear || new Date().getFullYear();
  const baseMonth = selectedMonth || (new Date().getMonth() + 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["income-trends", baseYear, baseMonth, rangeParam],
    queryFn: async () => {
      // If your server also supports /api/income-trends (no params), you can switch here.
      const res = await api.get(`/api/income-trends/${baseYear}/${baseMonth}`, {
        params: { range: rangeParam },
      });
      return res.data as Array<{ date: string; incomeSSP?: number; incomeUSD?: number }>;
    },
    enabled: !!baseYear && !!baseMonth,
  });

  const wide = isWideRange(startDate, endDate);

  const chartData: ChartRow[] = React.useMemo(() => {
    if (!data) return [];
    // For wide ranges, we’ll use string labels (multi-month safe).
    // For single-month, we try to extract day number if your data has "Sep 4" style labels.
    return data.map((r) => {
      const label = r.date; // e.g. "Sep 4"
      let day: number | undefined;
      if (!wide) {
        const m = label.match(/^\D+\s+(\d{1,2})$/);
        if (m) day = parseInt(m[1], 10);
      }
      const dateISO =
        startDate && endDate ? inferISOFromLabel(label, startDate, endDate) : undefined;

      return {
        label,           // used by the chart when wide === true
        day,             // used by the chart when wide === false
        dateISO,         // enables daily drill-down
        amountSSP: r.incomeSSP ?? 0,
        amountUSD: r.incomeUSD ?? 0,
      };
    });
  }, [data, wide, startDate, endDate]);

  // Drill-down state
  const [open, setOpen] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [detail, setDetail] = React.useState<{ from?: string; to?: string; items: any[] }>({ items: [] });

  // Lock body scroll when modal is open and ensure modal is visible
  React.useEffect(() => {
    if (open) {
      // CRITICAL: Store scroll position FIRST before any DOM changes
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Store original style values
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      // Scroll to top AFTER storing position
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
      });
      
      // Lock body scroll
      document.body.classList.add("modal-open");
      document.documentElement.classList.add("modal-open");
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = "0";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.documentElement.style.overflow = "hidden";
      
      // Cleanup: restore original values and scroll position
      return () => {
        document.body.classList.remove("modal-open");
        document.documentElement.classList.remove("modal-open");
        document.body.style.overflow = originalOverflow || "";
        document.body.style.position = originalPosition || "";
        document.body.style.top = originalTop || "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = originalWidth || "";
        document.documentElement.style.overflow = originalHtmlOverflow || "";
        
        // Restore scroll position
        window.scrollTo({
          top: scrollY,
          left: scrollX,
          behavior: 'instant'
        });
      };
    }
  }, [open]);

  const handleBarClick = async (row: ChartRow) => {
    // If we inferred an ISO day, drill into that date; otherwise, fall back to label-only dialog.
    if (!row.dateISO) {
      setDetail({ items: [], from: undefined, to: undefined });
      setOpen(true);
      return;
    }
    setLoadingDetail(true);
    setOpen(true);
    try {
      // Your /api/transactions endpoint already accepts date filters; use from=to= the same day.
      const res = await api.get("/api/transactions", {
        params: { page: 1, pageSize: 100, startDate: row.dateISO, endDate: row.dateISO },
      });
      setDetail({ from: row.dateISO, to: row.dateISO, items: res.data?.transactions ?? [] });
    } finally {
      setLoadingDetail(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-slate-600">Loading revenue analytics…</div>;
  }
  if (error) {
    return <div className="p-4 text-sm text-red-600">Failed to load revenue analytics.</div>;
  }

  const totalSSP = chartData.reduce((s, r) => s + (r.amountSSP || 0), 0);
  const totalUSD = chartData.reduce((s, r) => s + (r.amountUSD || 0), 0);
  const days = chartData.length || 1;
  const avgLineSSP = Math.round(totalSSP / days);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-slate-900">Revenue Analytics</h3>
        <span className="text-xs text-slate-500">{periodLabel}</span>
      </div>

      <div style={{ height: 280 }} className="w-full">
        <IncomeChart data={chartData} avgLineSSP={avgLineSSP} onBarClick={handleBarClick} />
      </div>

      {/* Simple drilldown dialog (no extra UI libs needed) */}
      {open && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          data-modal-backdrop="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
            data-modal-content="true"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {detail.from ? `Details for ${detail.from}` : "Details"}
              </h4>
              <button
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {loadingDetail ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">Loading…</div>
            ) : detail.items.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">No transactions found.</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="py-2">Date</th>
                      <th className="py-2">Dept</th>
                      <th className="py-2">Currency</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((t: any) => (
                      <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-2 text-slate-700 dark:text-slate-300">{t.date}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{t.departmentName || "-"}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{t.currency}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{(t.amount ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{t.type}</td>
                        <td className="py-2 text-slate-700 dark:text-slate-300">{t.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
