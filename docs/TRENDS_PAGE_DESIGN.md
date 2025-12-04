# Trends & Comparisons Page Design

This document describes the design, implementation, and performance considerations for the **Trends & Comparisons** page (`client/src/pages/dashboard.tsx`).

## Overview

The Trends & Comparisons page provides historical analysis and comparative insights:

- **Revenue Trend Chart**: Multi-month revenue visualization with SSP/USD toggle
- **Month vs Month Comparison**: Last two complete months side-by-side
- **Department Growth**: Growth rates by department
- **Expenses Breakdown**: Aggregated expenses for the selected period
- **Key Insights Card**: AI-generated summary of revenue trends

## Filter Options

The page supports the following filter options:

| Filter | Label | Description |
|--------|-------|-------------|
| `last-month` | Last Month | Shows data for the last complete month only |
| `last-quarter` | Last Quarter | Shows data for the last 3 complete months |
| `last-6-months` | Last 6 Months | Shows data for the last 6 complete months |
| `last-12-months` | Last 12 Months | Shows data for the last 12 complete months |
| `this-year` | This Year | Shows data from January to the last complete month |
| `last-year` | Last Year | Shows data for all 12 months of the previous year |

### Date Handling

- **Last Complete Month**: The page always uses the last complete month (not the current partial month) as the anchor point for calculations. This ensures all comparisons are between full months.
- **Filter Window**: Each filter option computes a `filterStartDate` and `filterEndDate` based on the last complete month.

## Data Sources

### Revenue Trend (Batched Endpoint)

**Endpoint**: `GET /api/trends/monthly-revenue`

**Query Parameters**:
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format

**Response**: Array of monthly data:
```typescript
interface MonthlyTrendItem {
  month: string;           // Short label: "Nov"
  fullMonth: string;       // Full label: "November 2025"
  year: number;
  monthNum: number;        // 1-12
  revenue: number;         // SSP income total
  revenueUSD: number;      // USD insurance income
  departmentBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
  totalExpenses: number;
}
```

**Performance**: This endpoint fetches all transactions in a single DB query and groups by month server-side, replacing the previous N-per-month sequential calls.

### Month vs Month Comparison

The Month vs Month card compares the **last two complete months**. This is independent of the selected filter to ensure meaningful comparisons.

**Data Sources**:
- `GET /api/dashboard?year=Y&month=M&range=current-month` for each month
- `GET /api/patient-volume/period/Y/M?range=current-month` for patient counts

### Expenses Breakdown

Expenses are **aggregated** across all months in the selected filter window:
1. Each month's `expenseBreakdown` is retrieved from the batched trend endpoint
2. Categories are summed across all months
3. The total and breakdown are displayed together

## Statistics Calculations

### YoY Growth

Year-over-Year growth is calculated by comparing:
1. The most recent complete month's revenue
2. The same month from the previous year (if present in the trend data)

If YoY comparison data is not available, the system falls back to comparing the first and last months in the trend window (period growth).

### Best Month

The month with the highest revenue (SSP or USD, depending on the selected tab) within the filter window.

### Monthly Average

Simple arithmetic mean of all months in the filter window.

## Component Hierarchy

```
Dashboard (page)
├── Key Insight Banner (conditional)
├── Revenue Trend Card
│   ├── SSP Tab → AreaChart
│   └── USD Tab → AreaChart
├── Grid Layout
│   ├── Month vs Month Card
│   │   ├── Revenue comparison
│   │   ├── Expenses comparison
│   │   ├── Net Income comparison
│   │   └── Patient Volume comparison
│   └── Department Growth Card
│       └── Growth bars per department
└── SimpleExpenseBreakdown Component
```

## Performance Considerations

### Before (Sequential Requests)
```
For each month in the filter (N months):
  → HTTP GET /api/dashboard?year=Y&month=M
Total: N sequential requests, N database queries
```

### After (Batched Request)
```
Single request:
  → HTTP GET /api/trends/monthly-revenue?startDate=...&endDate=...
Total: 1 request, 1 database query
```

**Impact**:
- For a 12-month filter: **12x fewer HTTP requests**
- Database: Single query instead of N queries
- Network latency: Significantly reduced due to single round-trip
- Server load: Reduced connection overhead

### Caching

The batched endpoint uses a 5-minute cache (`staleTime: 5 * 60 * 1000`) since trend data doesn't change frequently.

## UI/UX Guidelines

### Date Labels
All cards clearly indicate the date range being displayed:
- Revenue Trend: "January 2025 – November 2025 (Last 12 Months)"
- Month vs Month: "November 2025 vs October 2025 (Last two complete months)"
- Department Growth: Same as Month vs Month
- Expenses Breakdown: Period label matching the filter

### Loading States
- Full-page skeleton during initial load
- Individual card loading indicators for partial refreshes

### Empty States
- Clear messages when no data is available for the selected period
- Guidance on how to add transactions

### Responsive Design
- Single column layout on mobile
- Two-column grid for Month vs Month and Department Growth on desktop
- Charts resize appropriately for all viewports

## API Backward Compatibility

The new `/api/trends/monthly-revenue` endpoint was added without modifying existing endpoints. All other analytics components continue to work as before.
