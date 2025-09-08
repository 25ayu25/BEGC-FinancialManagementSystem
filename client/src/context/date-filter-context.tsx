// client/src/context/date-filter-context.tsx
import * as React from "react";

export type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "custom";

type Ctx = {
  timeRange: TimeRange;
  selectedYear: number;
  selectedMonth: number; // 1-12
  customStartDate?: Date;
  customEndDate?: Date;
  setTimeRange: (range: TimeRange) => void;
  setSpecificMonth: (year: number, month1to12: number) => void;
  setCustomRange: (start?: Date, end?: Date) => void;
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

  const setSpecificMonth = React.useCallback((year: number, month1to12: number) => {
    setSelectedYear(year);
    setSelectedMonth(month1to12);
    setTimeRangeState("current-month");
  }, []);

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
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;
      case "year":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(1);
        break;
      case "custom":
        // keep customStartDate/customEndDate as-is
        break;
    }
  }, []);

  const setCustomRange = React.useCallback((start?: Date, end?: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setTimeRangeState("custom");
  }, []);

  const periodLabel = React.useMemo(() => {
    if (timeRange === "current-month") return "Current month";
    if (timeRange === "last-month") return "Last month";
    if (timeRange === "last-3-months") return "Last 3 months";
    if (timeRange === "year") return "This year";
    if (timeRange === "custom" && customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString()} to ${customEndDate.toLocaleDateString()}`;
    }
    if (timeRange === "custom") return "Custom period";
    return "Period";
  }, [timeRange, customStartDate, customEndDate]);

  const value: Ctx = {
    timeRange,
    selectedYear,
    selectedMonth,
    customStartDate,
    customEndDate,
    setTimeRange,
    setSpecificMonth,
    setCustomRange,
    periodLabel,
  };

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = React.useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used within DateFilterProvider");
  return ctx;
}
