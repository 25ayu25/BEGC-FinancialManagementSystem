// client/src/context/date-filter-context.tsx
import * as React from "react";

export type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"   // NEW: pick any specific month (Jan..Dec of any year)
  | "custom";

type Ctx = {
  timeRange: TimeRange;

  /** Specific month selection (used when timeRange === "month-select") */
  selectedYear: number;  // 1..9999
  selectedMonth: number; // 1..12

  /** Custom range (used when timeRange === "custom") */
  customStartDate?: Date;
  customEndDate?: Date;

  /** Setters */
  setTimeRange: (range: TimeRange) => void;
  setSpecificMonth: (year: number, month1to12: number) => void;
  setCustomRange: (start?: Date, end?: Date) => void;

  /** Derived helpers for API calls and UI */
  startDate?: Date;
  endDate?: Date;
  periodLabel: string;
};

const DateFilterContext = React.createContext<Ctx | null>(null);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();

  const [timeRange, setTimeRangeState] = React.useState<TimeRange>("current-month");
  const [selectedYear, setSelectedYear] = React.useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(now.getMonth() + 1);
  const [customStartDate, setCustomStartDate] = React.useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>();

  /** Pick an explicit month (e.g., Jan 2024) */
  const setSpecificMonth = React.useCallback((year: number, month1to12: number) => {
    setSelectedYear(year);
    setSelectedMonth(month1to12);
    setTimeRangeState("month-select"); // <-- distinct mode for arbitrary month
  }, []);

  /** Quick ranges */
  const setTimeRange = React.useCallback((range: TimeRange) => {
    setTimeRangeState(range);
    const today = new Date();

    switch (range) {
      case "current-month":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;

      case "last-month": {
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        setSelectedYear(d.getFullYear());
        setSelectedMonth(d.getMonth() + 1);
        break;
      }

      case "last-3-months":
        // Anchor at "today" (used as the current month for the 3-month window)
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;

      case "year":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(1); // not used for year calc; keeps UI stable
        break;

      case "month-select":
        // keep current selectedYear/Month (user chooses via setSpecificMonth)
        break;

      case "custom":
        // keep customStartDate/customEndDate as-is
        break;
    }
  }, []);

  /** Custom period setter */
  const setCustomRange = React.useCallback((start?: Date, end?: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setTimeRangeState("custom");
  }, []);

  // ---- Derived dates for API queries ----
  const { startDate, endDate } = React.useMemo(() => {
    const y = selectedYear;
    const m = selectedMonth; // 1..12

    switch (timeRange) {
      case "current-month": {
        const start = new Date(y, m - 1, 1);
        const today = new Date();
        let end = new Date(y, m, 0); // default = full month

        // If we are looking at the real current month, show 1–today as the *logical* end
        if (
          today.getFullYear() === y &&
          today.getMonth() + 1 === m
        ) {
          end = new Date(y, m - 1, today.getDate());
        }

        return { startDate: start, endDate: end };
      }

      case "last-month": {
        // selectedYear/Month already point to last month
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        return { startDate: start, endDate: end };
      }

      case "last-3-months": {
        // Last 3 completed months before the "current" selected month
        // e.g. selectedMonth = 11 (Nov) → Aug 1 – Oct 31
        const start = new Date(y, m - 4, 1);
        const end = new Date(y, m - 1, 0);
        return { startDate: start, endDate: end };
      }

      case "year":
        return {
          startDate: new Date(y, 0, 1),
          endDate: new Date(y, 11, 31),
        };

      case "month-select":
        return {
          startDate: new Date(y, m - 1, 1),
          endDate: new Date(y, m, 0),
        };

      case "custom":
        return { startDate: customStartDate, endDate: customEndDate };

      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  const periodLabel = React.useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const formatRangeLabel = (start: Date, end: Date) => {
      const sYear = start.getFullYear();
      const eYear = end.getFullYear();
      const sMonthIdx = start.getMonth();
      const eMonthIdx = end.getMonth();
      const sDay = start.getDate();
      const eDay = end.getDate();

      const sameYear = sYear === eYear;
      const sameMonth = sameYear && sMonthIdx === eMonthIdx;

      if (sameYear && sameMonth) {
        const monthName = monthNames[sMonthIdx];
        if (sDay === eDay) {
          return `${monthName} ${sDay}, ${sYear}`;
        }
        return `${monthName} ${sDay}–${eDay}, ${sYear}`;
      }

      if (sameYear) {
        const sMonthName = monthNames[sMonthIdx];
        const eMonthName = monthNames[eMonthIdx];
        return `${sMonthName} ${sDay}–${eMonthName} ${eDay}, ${sYear}`;
      }

      const sMonthName = monthNames[sMonthIdx];
      const eMonthName = monthNames[eMonthIdx];
      return `${sMonthName} ${sDay}, ${sYear} – ${eMonthName} ${eDay}, ${eYear}`;
    };

    // Custom range: show explicit dates (Nov 1–29, 2025)
    if (timeRange === "custom" && startDate && endDate) {
      return formatRangeLabel(startDate, endDate);
    }

    // Explicit month selection (Nov 2025)
    if (timeRange === "month-select") {
      return `${monthNames[(selectedMonth - 1) % 12]} ${selectedYear}`;
    }

    // Current month: ALWAYS just Month Year (e.g., "Nov 2025")
    if (timeRange === "current-month") {
      return `${monthNames[(selectedMonth - 1) % 12]} ${selectedYear}`;
    }

    // Default labels for other quick ranges
    return (
      {
        "current-month": "Current month", // not used because handled above
        "last-month": "Last month",
        "last-3-months": "Last 3 months",
        year: "This year",
        "month-select": "", // handled above
        custom: "Custom period",
      } as const
    )[timeRange];
  }, [timeRange, selectedMonth, selectedYear, startDate, endDate]);

  const value: Ctx = {
    timeRange,
    selectedYear,
    selectedMonth,
    customStartDate,
    customEndDate,
    setTimeRange,
    setSpecificMonth,
    setCustomRange,
    startDate,
    endDate,
    periodLabel,
  };

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = React.useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used within DateFilterProvider");
  return ctx;
}
