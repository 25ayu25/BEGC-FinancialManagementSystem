# Deprecated Features

This document tracks features that have been deprecated or removed from the Bahr El Ghazal Clinic Financial Management System.

## Insurance Providers Analytics Page (Removed)

**Status:** Removed completely from the application  
**Date:** December 2025  
**Reason:** Simplified user experience - analytics consolidated into Executive Dashboard

### Background

The Insurance Providers analytics page (`/insurance-providers`) was a dedicated page that provided detailed breakdowns of insurance revenue by provider. After careful consideration, the decision was made to remove this separate page and keep the high-level insurance KPI information visible on the Executive Dashboard without navigation.

### Impact

- **Frontend:** Removed `/insurance-providers` route, page component (`insurance-providers.tsx`), and related navigation links
- **Navigation:** Insurance KPI card on Executive Dashboard is now display-only (no longer clickable)
- **Backend:** The `/api/insurance-providers` API endpoint remains active as it's used by other features (Insurance Balance page, Transactions page, etc.)

### What Remains

The Insurance KPI section continues to be visible on the Executive Dashboard, showing:
- Total insurance revenue in USD
- Provider count
- Percentage change comparisons
- Breakdown by provider in the Insurance Providers card

Users can still access detailed insurance management through:
- **Insurance Balance** (`/insurance`) - Shows detailed claim and payment tracking for insurance providers
- **Transactions** (`/transactions`) - Allows filtering and viewing individual insurance transactions
- **Department Analytics** (`/department-analytics`) - Offers department-level breakdowns including insurance data

### Files Archived

The Insurance Providers page implementation has been moved to `archive/insurance-providers-v1/`:
- `insurance-providers.tsx` - The main page component

### Future Considerations

If detailed insurance provider analytics are needed in the future, they can be reintroduced as:
- A redesigned analytics page with improved UX
- An expanded section within the existing Insurance Balance page
- A modal/drawer from the Executive Dashboard

---

## Insurance Overview v1 (Removed)

**Status:** Removed completely from the application  
**Date:** December 2025  
**Reason:** Persistent data correctness issues with date filtering

### Background

Insurance Overview v1 was an analytics page that provided aggregate views of insurance-related financial data. Despite more than 15 pull requests attempting to fix date filter behavior (particularly for presets like "This Year"), the page remained unreliable and caused repeated regressions.

**Technical Issues:**
- **Timezone handling inconsistencies:** UTC vs local time calculations causing off-by-one month errors
- **December-anchoring bug:** "This Year" filter incorrectly starting in December of previous year instead of January
- **Rolling window edge cases:** Last N months calculations failing at year boundaries
- **Database query date leakage:** GROUP BY operations returning months outside requested date range
- **Frontend-backend misalignment:** Different date calculation logic between client and server
- **State management complexity:** Multiple sources of truth for date filtering causing synchronization issues

After 15+ fix attempts addressing various aspects of the problem, the fundamental architecture proved too fragile for reliable date filtering.

### Impact

- **Frontend:** Removed `/insurance-overview` route, page component, and all related UI components
- **Backend:** Removed `/api/insurance-overview` API endpoints
- **Navigation:** Removed "Insurance Overview" menu item from the sidebar

### Alternatives

Users should rely on the following pages for insurance-related analytics:

1. **Trends & Comparisons** (`/simple`) - Provides monthly revenue trends including insurance data with reliable date filtering
2. **Department Analytics** (`/department-analytics`) - Offers department-level breakdowns with insurance provider analysis
3. **Insurance Balance** (`/insurance`) - Shows detailed claim and payment tracking for insurance providers

### Documentation Archive

All Insurance Overview v1 implementation documentation has been moved to the `archive/` directory:
- `INSURANCE_OVERVIEW_IMPLEMENTATION.md`
- `INSURANCE_OVERVIEW_FIX_SUMMARY.md`
- `INSURANCE_OVERVIEW_FIX_FINAL.md`
- `INSURANCE_OVERVIEW_TIMEZONE_FIX.md`
- `INSURANCE_DATE_FILTER_FIX.md`
- And other related documents

### Future Plans

Insurance Overview v2 may be reintroduced in the future with:
- A cleanly designed architecture from the ground up
- Comprehensive test coverage including edge cases
- Rigorous validation before deployment
- Clear separation of concerns between date filtering and data aggregation

Until then, the removal reduces the surface area for regressions and improves overall system reliability.

---

**Note:** This is a temporary removal driven by data quality concerns, not a permanent product decision. The underlying insurance data and APIs remain intact and continue to power the alternative analytics pages.
