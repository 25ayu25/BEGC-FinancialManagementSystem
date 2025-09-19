'use client';

import * as React from 'react';
import { useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { useDateFilter } from '@/context/date-filter-context';

/**
 * Helper: build a list of recent years.
 * Default: current year going back 6 years. Adjust as you need.
 */
function buildYearOptions(span = 7) {
  const thisYear = new Date().getFullYear();
  return Array.from({ length: span }, (_, i) => String(thisYear - i));
}

const MONTHS = [
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
];

export default function StickyPageHeader({
  className,
}: {
  className?: string;
}) {
  const {
    timeRange,
    setTimeRange,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
  } = useDateFilter();

  // year options for picker
  const yearOptions = useMemo(() => buildYearOptions(8), []);

  // Ensure defaults when switching modes
  useEffect(() => {
    const now = new Date();
    if (timeRange === 'year') {
      if (!selectedYear) setSelectedYear(now.getFullYear());
    }
    if (timeRange === 'month-select') {
      if (!selectedYear) setSelectedYear(now.getFullYear());
      if (!selectedMonth) setSelectedMonth(now.getMonth() + 1);
    }
  }, [timeRange, selectedYear, selectedMonth, setSelectedYear, setSelectedMonth]);

  return (
    <div
      className={cn(
        'sticky top-0 z-30 w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50',
        'border-b border-slate-200',
        className
      )}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center gap-3">

          {/* Range selector */}
          <Select
            value={timeRange}
            onValueChange={(v) => {
              // Reset month when leaving month-select
              if (v !== 'month-select') {
                // keep year (useful for switching year views)
              }
              setTimeRange(v as any);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              {/* year view */}
              <SelectItem value="year">This Year</SelectItem>

              {/* month-by-month view (needs year + month pickers) */}
              <SelectItem value="month-select">Select Month…</SelectItem>

              {/* keep your other quick ranges */}
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {/* Show YEAR picker for year & month-select modes */}
          {(timeRange === 'year' || timeRange === 'month-select') && (
            <Select
              value={String(selectedYear ?? '')}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Show MONTH picker only for month-select mode */}
          {timeRange === 'month-select' && (
            <Select
              value={String(selectedMonth ?? '')}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
