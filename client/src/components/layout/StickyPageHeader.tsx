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

/** Build a small list of recent years (current year going back 7). */
function buildYearOptions(span = 8) {
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

export default function StickyPageHeader({ className }: { className?: string }) {
  const {
    timeRange,            // 'year' | 'month-select' | 'last-month' | 'last-3-months' | 'current-month' | 'custom'
    setTimeRange,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
  } = useDateFilter();

  const yearOptions = useMemo(() => buildYearOptions(8), []);

  // Ensure defaults when switching modes
  useEffect(() => {
    const now = new Date();
    if (timeRange === 'year') {
      if (!selectedYear) setSelectedYear(now.getFullYear());
    } else if (timeRange === 'month-select') {
      if (!selectedYear) setSelectedYear(now.getFullYear());
      if (!selectedMonth) setSelectedMonth(now.getMonth() + 1);
    }
  }, [timeRange, selectedYear, selectedMonth, setSelectedYear, setSelectedMonth]);

  const showYear = timeRange === 'year' || timeRange === 'month-select';
  const showMonth = timeRange === 'month-select';

  return (
    <div
      className={cn(
        'sticky top-0 z-30 w-full bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50',
        'border-b border-slate-200',
        className
      )}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-3">
        {/* IMPORTANT: flex-wrap + gaps; the min-widths keep controls visible */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Range selector */}
          <Select
            value={timeRange}
            onValueChange={(v) => {
              setTimeRange(v as any);
            }}
          >
            <SelectTrigger className="w-[180px] min-w-[180px]" data-testid="df-range">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="month-select">Select Month…</SelectItem>
              <SelectItem value="current-month">Current Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {/* YEAR — show for This Year OR Select Month… */}
          {showYear && (
            <Select
              value={String(selectedYear ?? '')}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[128px] min-w-[128px]" data-testid="df-year">
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

          {/* MONTH — only for Select Month… */}
          {showMonth && (
            <Select
              value={String(selectedMonth ?? '')}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px] min-w-[140px]" data-testid="df-month">
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
