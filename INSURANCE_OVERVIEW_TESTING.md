# Insurance Overview Testing Guide

This document provides step-by-step instructions for testing the Insurance Overview dashboard implementation.

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL database is running with insurance tables
2. **Authentication**: Have valid user credentials ready
3. **Sample Data**: Run the seed script to populate test data

## Seed Sample Data

```bash
# Connect to your database and run the seed script
psql -U your_username -d your_database_name -f migrations/seed-insurance-sample.sql

# Or if using environment variable
psql $DATABASE_URL -f migrations/seed-insurance-sample.sql
```

This creates:
- ~9 insurance claims across 3 providers (last 90 days)
- Payments linked to those claims
- ~60 daily payments for the last 30 days (for daily chart)
- All amounts in USD

## Test Cases

### 1. Smoke Test - Basic Page Load

**Objective**: Verify page loads without errors

**Steps**:
1. Start the application: `npm run dev`
2. Log in with valid credentials
3. Navigate to `/insurance-overview`

**Expected**:
- ✅ Page loads without React errors
- ✅ No console errors (401s are OK if not logged in)
- ✅ Page shows at minimum: header, filters, and charts
- ✅ HTTP 200 responses for API calls:
  - `/api/insurance-providers`
  - `/api/insurance-claims`
  - `/api/insurance-payments`

### 2. ErrorBoundary Test

**Objective**: Verify ErrorBoundary prevents app crash

**Steps**:
1. Open browser console
2. Temporarily modify insurance-overview page to throw an error:
   ```javascript
   // Add near top of component
   throw new Error('Test error boundary');
   ```
3. Reload page

**Expected**:
- ✅ Error boundary catches error
- ✅ Shows user-friendly error message
- ✅ Shows "Something went wrong" heading
- ✅ "Try Again" and "Go Home" buttons appear
- ✅ In dev mode, shows error details
- ✅ App doesn't crash completely

### 3. ProviderDailyTimeline Component

**Objective**: Verify daily timeline chart renders and functions

**Steps**:
1. Navigate to `/insurance-overview`
2. Locate "Daily Payment Timeline (USD)" chart
3. Verify chart displays stacked bars
4. Test date presets:
   - Click "Last 7 Days"
   - Click "Last 30 Days" 
   - Click "Last 90 Days"
   - Click "Custom Range" and enter dates
5. Test provider filters:
   - Click individual provider buttons
   - Click "Select All" / "Deselect All"
6. Hover over chart bars

**Expected**:
- ✅ Chart renders with Recharts library
- ✅ Bars are stacked by provider
- ✅ X-axis shows dates (angled labels)
- ✅ Y-axis shows USD amounts (formatted)
- ✅ Date presets change date range
- ✅ Custom date inputs appear when "Custom Range" selected
- ✅ Provider filters toggle bar visibility
- ✅ Tooltip shows on hover with:
  - Date
  - Provider amounts
  - Total for that day
- ✅ Summary stats show:
  - Days with Data
  - Total Amount
  - Avg Daily
- ✅ All amounts formatted as USD ($X,XXX.XX)

### 4. Empty State

**Objective**: Verify empty state displays when no data

**Steps**:
1. Set date range to future dates (e.g., 2026)
2. Or use provider filter with no matching data

**Expected**:
- ✅ Shows "No payment data for selected date range" message
- ✅ Shows icon/illustration
- ✅ No error thrown

### 5. Loading State

**Objective**: Verify loading indicator appears

**Steps**:
1. Open Network tab in DevTools
2. Throttle network to "Slow 3G"
3. Navigate to `/insurance-overview`
4. Observe loading state

**Expected**:
- ✅ Loading spinner appears
- ✅ "Loading data..." text shown
- ✅ Page doesn't flash or show partial data

### 6. Error State

**Objective**: Verify error handling for API failures

**Steps**:
1. Open Network tab in DevTools
2. Block `/api/insurance-payments` requests
3. Navigate to `/insurance-overview`

**Expected**:
- ✅ Error message displayed
- ✅ "⚠️ Error loading data" shown
- ✅ Error details displayed
- ✅ Page doesn't crash

### 7. USD-Only Enforcement

**Objective**: Verify only USD data is displayed

**Steps**:
1. Check API calls in Network tab
2. Verify no `currency=USD` query parameter sent
3. Inspect data displayed in charts and tables

**Expected**:
- ✅ No `currency` query param in API calls (client-side filtering)
- ✅ All amounts show USD format: $X,XXX.XX
- ✅ Chart title shows "(USD)"
- ✅ Only USD records appear in tables

### 8. Integration with Existing Features

**Objective**: Verify new code doesn't break existing pages

**Steps**:
1. Navigate to `/insurance` (old insurance page)
2. Test basic functionality
3. Navigate back to `/insurance-overview`

**Expected**:
- ✅ `/insurance` page loads normally
- ✅ No JavaScript errors
- ✅ Can switch between pages without issues
- ✅ Both pages work independently

### 9. Executive Dashboard KPIs

**Objective**: Verify KPI cards display correct data

**Steps**:
1. Navigate to `/insurance-overview`
2. Locate KPI cards at top (Total Billed, Total Collected, Outstanding, etc.)
3. Verify values match summary stats

**Expected**:
- ✅ KPI cards render
- ✅ Values are numeric and formatted
- ✅ USD currency shown
- ✅ Values update when filters change

### 10. Provider Comparison Chart

**Objective**: Verify provider comparison bars

**Steps**:
1. Locate "Provider Comparison" chart
2. Verify horizontal bars for each provider

**Expected**:
- ✅ Chart displays providers
- ✅ Bars show relative amounts
- ✅ Hover shows exact values

### 11. Aging Analysis

**Objective**: Verify aging buckets display

**Steps**:
1. Locate "Aging Analysis" chart
2. Verify buckets: 0-30, 31-60, 61-90, 90+ days

**Expected**:
- ✅ Buckets shown with counts and amounts
- ✅ Outstanding claims categorized correctly

### 12. Smart Tables

**Objective**: Verify claims and payments tables

**Steps**:
1. Scroll to "Claims" table
2. Test sorting by clicking column headers
3. Test pagination
4. Scroll to "Payments" table
5. Repeat sorting and pagination tests

**Expected**:
- ✅ Tables render with data
- ✅ Columns sortable
- ✅ Pagination works
- ✅ Amounts formatted as USD
- ✅ Dates formatted consistently

### 13. Add Claim Modal

**Objective**: Verify claim creation modal

**Steps**:
1. Click "New Claim" button
2. Fill in form:
   - Select provider
   - Enter period start/end dates
   - Enter amount (USD)
   - Add notes
3. Submit

**Expected**:
- ✅ Modal opens
- ✅ Form validates required fields
- ✅ Provider dropdown populated
- ✅ Amount field accepts decimals
- ✅ Currency fixed to USD
- ✅ Submits to `/api/insurance-claims`
- ✅ Modal closes on success
- ✅ Data refreshes automatically

### 14. Record Payment Modal

**Objective**: Verify payment creation modal

**Steps**:
1. Click "Record Payment" button
2. Fill in form:
   - Select provider
   - Enter payment date
   - Enter amount (USD)
   - Add reference
3. Submit

**Expected**:
- ✅ Modal opens
- ✅ Form validates required fields
- ✅ Amount field accepts decimals
- ✅ Currency fixed to USD
- ✅ Submits to `/api/insurance-payments`
- ✅ Modal closes on success
- ✅ Data refreshes automatically

### 15. Export Functionality

**Objective**: Verify data export

**Steps**:
1. Click "Export" button
2. Check downloaded file

**Expected**:
- ✅ CSV file downloads
- ✅ Filename includes date
- ✅ Contains claims data
- ✅ Properly formatted

### 16. Refresh Functionality

**Objective**: Verify manual refresh

**Steps**:
1. Click "Refresh" button
2. Observe data reload

**Expected**:
- ✅ Loading state briefly appears
- ✅ Data fetched from API
- ✅ Charts and tables update

### 17. Authentication

**Objective**: Verify authentication handling

**Steps**:
1. Log out
2. Navigate to `/insurance-overview` directly
3. Or clear session and reload page

**Expected**:
- ✅ 401 error handled gracefully
- ✅ Shows "Authentication Required" message
- ✅ "Go to Login" button present
- ✅ Redirects to login when clicked

## Regression Tests

### Existing Insurance Page

1. Navigate to `/insurance` (old page)
2. Verify all functionality works
3. No console errors
4. No visual regressions

**Expected**:
- ✅ Page loads normally
- ✅ All features work as before
- ✅ No impact from new code

### Other Pages

Test basic navigation to ensure no global impacts:
- Dashboard: `/`
- Transactions: `/transactions`
- Reports: `/reports`
- Settings: `/settings`

**Expected**:
- ✅ All pages load
- ✅ No console errors
- ✅ ErrorBoundary doesn't affect other pages

## Performance Tests

### Client-Side Aggregation

**Objective**: Verify performance with moderate data

**Steps**:
1. Seed large dataset (~5,000 payment records)
2. Navigate to `/insurance-overview`
3. Apply various filters
4. Monitor browser performance

**Expected**:
- ✅ Page loads in < 3 seconds
- ✅ Filtering is responsive
- ✅ No UI freezing
- ✅ Aggregation completes quickly

## Browser Compatibility

Test in multiple browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari (if available)

**Expected**:
- ✅ Charts render correctly
- ✅ Styles consistent
- ✅ Interactions work
- ✅ No browser-specific errors

## Mobile Responsiveness

Test on mobile viewport:
1. Resize browser to mobile width (375px)
2. Test all interactions

**Expected**:
- ✅ Page is scrollable
- ✅ Charts resize appropriately
- ✅ Filters usable
- ✅ Tables horizontal scroll if needed
- ✅ Modals fit screen

## Cleanup

After testing, you can clean up sample data:

```sql
-- Remove sample data
DELETE FROM insurance_payments WHERE notes LIKE '%Sample%payment%';
DELETE FROM insurance_claims WHERE notes LIKE '%Sample claim for testing%';
```

## Issue Reporting

If you find issues, report with:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Console errors
- Screenshots

## Success Criteria

All tests should pass for production deployment:
- ✅ No React errors or crashes
- ✅ ErrorBoundary catches component errors
- ✅ USD-only enforcement (no invalid currency params)
- ✅ All charts and tables render
- ✅ Filters and interactions work
- ✅ Empty/loading/error states display
- ✅ Authentication handled
- ✅ No impact on existing `/insurance` page
- ✅ Performance acceptable
- ✅ Mobile responsive
