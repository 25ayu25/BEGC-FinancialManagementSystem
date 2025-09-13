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
    setTimeRangeState("month-select"); // <-- important: distinct mode for arbitrary month
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
        // Keep selectedYear/Month anchored at "today". Window is computed later.
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
      case "current-month":
        return { startDate: new Date(y, m - 1, 1), endDate: new Date(y, m, 0) };

      case "last-month": {
        const d = new Date(y, m - 2, 1);
        return { startDate: d, endDate: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
      }

      case "last-3-months": {
        const end = new Date(y, m, 0);
        const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
        return { startDate: start, endDate: end };
      }

      case "year":
        return { startDate: new Date(y, 0, 1), endDate: new Date(y, 11, 31) };

      case "month-select":
        return { startDate: new Date(y, m - 1, 1), endDate: new Date(y, m, 0) };

      case "custom":
        return { startDate: customStartDate, endDate: customEndDate };

      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [timeRange, selectedYear, selectedMonth, customStartDate, customEndDate]);

  const periodLabel = React.useMemo(() => {
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    if (timeRange === "custom" && startDate && endDate) {
      return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
    }

    if (timeRange === "month-select") {
      return `${monthNames[(selectedMonth - 1) % 12]} ${selectedYear}`;
    }

    return (
      {
        "current-month": "Current month",
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
