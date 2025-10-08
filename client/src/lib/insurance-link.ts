import { format } from "date-fns";

export type TimeRange =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "year"
  | "month-select"
  | "custom";

export function buildInsuranceLink(opts: {
  timeRange: TimeRange;
  selectedYear: number;
  selectedMonth: number;
  customStartDate?: Date;
  customEndDate?: Date;
  basePath?: string; // "/insurance" or "/insurance-providers"
}) {
  const {
    timeRange, selectedYear, selectedMonth, customStartDate, customEndDate,
    basePath = "/insurance-providers",
  } = opts;

  if (timeRange === "custom" && customStartDate && customEndDate) {
    return `${basePath}?range=custom&startDate=${format(customStartDate, "yyyy-MM-dd")}&endDate=${format(customEndDate, "yyyy-MM-dd")}`;
  }

  let rangeParam = timeRange;
  let year = selectedYear;
  let month = selectedMonth;

  if (timeRange === "last-month" || timeRange === "month-select") {
    rangeParam = "current-month"; // treat explicit month as single-month
  }
  if (timeRange === "year") {
    month = 1; // harmless placeholder so page initializes
  }

  const qs = new URLSearchParams({ range: rangeParam, year: String(year), month: String(month) });
  return `${basePath}?${qs.toString()}`;
}
