import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

// IMPORTANT: adjust the relative import if your folder layout differs
import { useDateFilter } from "../../context/date-filter-context";

/**
 * Right-side date range control with direct month selection.
 * Uses the shared date filter context.
 */
function DateRangeControl() {
  const {
    timeRange,
    setTimeRange,
    selectedYear,
    selectedMonth,
    setSpecificMonth,
    periodLabel,
  } = useDateFilter();

  // Build year choices: current year and previous year (expand if you need more)
  const now = new Date();
  const thisYear = now.getFullYear();
  const years = React.useMemo(() => {
    // Add more history if needed, e.g., [...Array(6)].map((_,i)=>thisYear-i)
    return [thisYear, thisYear - 1];
  }, [thisYear]);

  const months = [
    { label: "January", value: 1 },
    { label: "February", value: 2 },
    { label: "March", value: 3 },
    { label: "April", value: 4 },
    { label: "May", value: 5 },
    { label: "June", value: 6 },
    { label: "July", value: 7 },
    { label: "August", value: 8 },
    { label: "September", value: 9 },
    { label: "October", value: 10 },
    { label: "November", value: 11 },
    { label: "December", value: 12 },
  ];

  const onQuickChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as
      | "current-month"
      | "last-month"
      | "last-3-months"
      | "year"
      | "month-select"
      | "custom";
    setTimeRange(v);
  };

  const onYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = Number(e.target.value);
    if (!Number.isNaN(y)) setSpecificMonth(y, selectedMonth || 1);
  };

  const onMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = Number(e.target.value);
    if (!Number.isNaN(m)) setSpecificMonth(selectedYear || thisYear, m);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Quick range */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Range</label>
        <select
          value={timeRange}
          onChange={onQuickChange}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="current-month">Current Month</option>
          <option value="last-month">Last Month</option>
          <option value="last-3-months">Last 3 Months</option>
          <option value="year">This Year</option>
          <option value="month-select">Select Month…</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Month selection (only when "Select Month…" is active) */}
      {timeRange === "month-select" && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Month</label>
          <select
            value={selectedYear}
            onChange={onYearChange}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={onMonthChange}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current label */}
      <div className="hidden sm:block text-sm text-slate-500 pl-1">
        {periodLabel}
      </div>
    </div>
  );
}

type Props = {
  children: React.ReactNode;
  className?: string;
  /**
   * Show or hide the right-side date filter control.
   * Defaults to true for convenience.
   */
  showDateFilter?: boolean;
};

/**
 * Fixed page header that stays put while the page scrolls.
 * It renders a spacer with the header's measured height so content
 * below doesn't jump.
 *
 * Original sticky container preserved and extended with a right-side
 * date filter control for quick ranges + direct month selection.
 */
export default function StickyPageHeader({
  children,
  className = "",
  showDateFilter = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(64);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setH(el.offsetHeight || 64);

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      {/* spacer to offset fixed header height */}
      <div style={{ height: h }} aria-hidden="true" />
      <div
        ref={ref}
        className={
          "fixed inset-x-0 top-0 z-30 border-b border-slate-200 " +
          "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 " +
          className
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: caller-provided header content (title, breadcrumbs, buttons) */}
            <div className="min-w-0 flex-1">{children}</div>

            {/* Right: date range control */}
            {showDateFilter && <DateRangeControl />}
          </div>
        </div>
      </div>
    </>
  );
}
