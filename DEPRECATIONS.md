# Deprecated Features

This document tracks features that have been deprecated or removed from the Bahr El Ghazal Clinic Financial Management System.

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
