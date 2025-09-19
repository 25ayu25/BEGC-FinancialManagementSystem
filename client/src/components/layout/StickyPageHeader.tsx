'use client';

import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";

// uses your shared date filter context
import { useDateFilter } from "../../context/date-filter-context";

/**
 * Right-side date range control with direct month / year selection.
 * - When Range = "This Year", show only the Year dropdown
 * - When Range = "Select Month…", show Year + Month dropdowns
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

  const now = new Date();
  const thisYear = now.getFullYear();

  // Last 5 years (tweak as you like)
  const years = React.useMemo(
    () => Array.from({ length: 5 }, (_, i) => thisYear - i),
    [thisYear]
  );

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
    if (!Number.isNaN(y)) {
      // Keep current month selection; month is ignored when range === 'year'
      setSpecificMonth(y, selectedMonth || 1);
    }
  };

  const onMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = Number(e.target.value);
    if (!Number.isNaN(m)) setSpecificMonth(selectedYear || thisYear, m);
  };

  const showYearPicker =
    timeRange === "year" || timeRange === "month-select";

  return (
    <div className="flex items-center gap-3">
      {/* Quick range */}
      <div className="flex items-center gap-2 min-w-0">
        <label className="text-sm text-slate-600 shrink-0">Range</label>
        <select
          value={timeRange}
          onChange={onQuickChange}
          aria-label="Select date range"
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

      {/* Year picker when viewing a full year OR selecting a month */}
      {showYearPicker && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Year</label>
          <select
            value={selectedYear}
            onChange={onYearChange}
            aria-label="Select year"
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Month appears only when explicitly selecting a month */}
          {timeRange === "month-select" && (
            <>
              <label className="text-sm text-slate-600">Month</label>
              <select
                value={selectedMonth}
                onChange={onMonthChange}
                aria-label="Select month"
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* Current period label (hide on very small screens) */}
      <div className="hidden sm:block text-sm text-slate-500 pl-1">
        {periodLabel}
      </div>
    </div>
  );
}

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Show or hide the right-side date filter control. */
  showDateFilter?: boolean;
};

/**
 * Sticky page header with auto-height spacer.
 * - md+: children (left) + date filter (right)
 * - <md: children first, date filter below
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          {/* Desktop row */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">{children}</div>
            {showDateFilter && (
              <div className="relative z-50">
                <DateRangeControl />
              </div>
            )}
          </div>

          {/* Mobile stack */}
          <div className="md:hidden">
            <div className="min-w-0">{children}</div>
            {showDateFilter && (
              <div className="mt-3 relative z-50 overflow-visible">
                <div className="overflow-x-auto no-scrollbar">
                  <div className="inline-flex">
                    <DateRangeControl />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
