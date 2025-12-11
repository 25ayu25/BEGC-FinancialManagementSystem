# Testing Guide: Insurance Overview Date Filter Fix

## Overview
This guide provides step-by-step instructions for testing the Insurance Overview date filter fix to verify that the December-anchored date range bugs have been resolved.

## Prerequisites
- Access to the application UI
- Ability to view Insurance Overview, Trends, and Department Analytics pages
- Current date should be noted (e.g., November 2025 for comparison with screenshots)

## Test Scenarios

### Scenario 1: "This Year" Filter

**Expected Behavior:**
- Start date: January 1 of current year
- End date: Last day of the last complete month
- Should NOT start in December of previous year

**Test Steps:**
1. Navigate to Insurance Overview page
2. Click on the date filter dropdown
3. Select "This Year"
4. Observe the date range displayed and the data shown

**Expected Results (testing in November 2025):**
- Date range: January 2025 - October 2025
- Data should include transactions from Jan 1, 2025 to Oct 31, 2025
- Should show 10 months of data
- Should NOT show December 2024 data

**Verification:**
- [ ] Date range starts in January (not December)
- [ ] Date range ends at last complete month (not current incomplete month)
- [ ] Revenue totals exclude current month if incomplete

### Scenario 2: "Last Year" Filter

**Expected Behavior:**
- Start date: January 1 of previous year
- End date: December 31 of previous year
- Full calendar year only

**Test Steps:**
1. On Insurance Overview page
2. Select "Last Year" from filter dropdown
3. Observe the date range and data

**Expected Results (testing in 2025):**
- Date range: January 2024 - December 2024
- Data should include full year 2024
- Should show 12 months of data
- Should NOT include December 2023 or January 2025

**Verification:**
- [ ] Date range starts on January 1 of previous year
- [ ] Date range ends on December 31 of previous year
- [ ] Exactly 12 months of data shown
- [ ] No data from current year or year before previous

### Scenario 3: "Last 6 Months" Filter

**Expected Behavior:**
- Rolling 6-month window of complete months
- Counts backward from last complete month

**Test Steps:**
1. On Insurance Overview page
2. Select "Last 6 Months" from filter dropdown
3. Observe the date range

**Expected Results (testing in November 2025):**
- Date range: May 2025 - October 2025
- Should show exactly 6 complete months
- Should NOT include current incomplete month (November)

**Verification:**
- [ ] Exactly 6 complete months shown
- [ ] Current incomplete month excluded
- [ ] Range ends at last complete month

### Scenario 4: "Last 12 Months" Filter

**Expected Behavior:**
- Rolling 12-month window of complete months
- May span across year boundary

**Test Steps:**
1. On Insurance Overview page
2. Select "Last 12 Months" from filter dropdown
3. Observe the date range

**Expected Results (testing in November 2025):**
- Date range: November 2024 - October 2025
- Should show exactly 12 complete months
- Spans across year boundary (2024-2025)

**Verification:**
- [ ] Exactly 12 complete months shown
- [ ] Correctly spans year boundary
- [ ] Current incomplete month excluded

### Scenario 5: "Last Month" Filter

**Expected Behavior:**
- Shows the last complete calendar month
- Not the current month

**Test Steps:**
1. On Insurance Overview page
2. Select "Last Month" from filter dropdown
3. Observe the date range

**Expected Results (testing in November 2025):**
- Date range: October 1, 2025 - October 31, 2025
- Should show exactly 1 complete month
- Should be the month immediately before current month

**Verification:**
- [ ] Shows last complete month (not current month)
- [ ] Full month from 1st to last day
- [ ] Data matches transactions from that month only

### Scenario 6: "Last Quarter" Filter

**Expected Behavior:**
- Shows last 3 complete calendar months
- Counts backward from last complete month

**Test Steps:**
1. On Insurance Overview page
2. Select "Last Quarter" from filter dropdown
3. Observe the date range

**Expected Results (testing in November 2025):**
- Date range: August 2025 - October 2025
- Should show exactly 3 complete months
- Should NOT include current month

**Verification:**
- [ ] Shows exactly 3 complete months
- [ ] Ends at last complete month
- [ ] Current incomplete month excluded

### Scenario 7: Consistency Across Pages

**Expected Behavior:**
- Insurance Overview should show same date ranges as Trends and Department Analytics for same filters

**Test Steps:**
1. Select "This Year" on Insurance Overview, note the date range
2. Navigate to Trends page, note the date range
3. Navigate to Department Analytics page, note the date range
4. Repeat for "Last Year" and "Last 6 Months"

**Expected Results:**
- All three pages show identical date ranges for same filter
- Data should be consistent (allowing for different metrics)

**Verification:**
- [ ] Insurance Overview "This Year" matches Trends "This Year"
- [ ] Insurance Overview "Last Year" matches Trends "Last Year"
- [ ] Insurance Overview "Last 6 Months" matches Trends "Last 6 Months"
- [ ] Insurance Overview "Last 12 Months" matches Trends "Last 12 Months"

### Scenario 8: Year Boundary Testing (December/January)

**Expected Behavior:**
- Filters should handle year boundaries correctly
- No off-by-one errors at year change

**Test Steps (if testing in December or January):**
1. Test "This Year" filter during December
2. Test "Last Year" filter during January
3. Test "Last 12 Months" during year transition

**Expected Results:**
For testing in December 2025:
- "This Year": January 2025 - November 2025 (current month incomplete)
- "Last Year": January 2024 - December 2024
- "Last 12 Months": December 2024 - November 2025

For testing in January 2026:
- "This Year": January 2026 - December 2025 (only December 2025 complete)
- "Last Year": January 2025 - December 2025
- "Last 12 Months": January 2025 - December 2025

**Verification:**
- [ ] Year boundaries handled correctly
- [ ] No December-anchored ranges
- [ ] Last complete month logic works at year change

### Scenario 9: Custom Date Range

**Expected Behavior:**
- Custom date range picker should still work
- Dates should be handled correctly

**Test Steps:**
1. Select "Custom Range" from filter dropdown
2. Pick a start date (e.g., March 1, 2025)
3. Pick an end date (e.g., August 31, 2025)
4. Apply the filter

**Expected Results:**
- Data should show for exactly the selected date range
- Custom range should work independently of preset filters

**Verification:**
- [ ] Custom date picker opens
- [ ] Selected dates are applied correctly
- [ ] Data matches custom date range

## Comparison with Screenshots

Compare your test results with the user-reported issue screenshots:

**Before Fix (Bug):**
- "This Year" showed December 2024 - November 2025 ❌
- "Year to Date" showed December 2024 - November 2025 ❌
- "Last Year" showed December 2023 - December 2024 ❌
- "Last 6 Months" showed May 2025 - November 2025 ❌

**After Fix (Correct):**
- "This Year" should show January 2025 - October 2025 ✅
- "Last Year" should show January 2024 - December 2024 ✅
- "Last 6 Months" should show May 2025 - October 2025 ✅

## Regression Testing

Test that existing functionality still works:

- [ ] Revenue overview cards display correctly
- [ ] Provider share chart renders
- [ ] Provider performance cards show data
- [ ] Trend charts display for selected range
- [ ] Export to CSV/PDF still works
- [ ] Refresh button updates data
- [ ] Mobile responsive layout works
- [ ] No JavaScript console errors

## Performance Testing

- [ ] Page loads in reasonable time (<3 seconds)
- [ ] Filter changes are responsive
- [ ] Data fetching doesn't hang
- [ ] No memory leaks on filter changes

## Edge Cases

Test with edge case data:

- [ ] Empty date range (no data)
- [ ] Very large date range (multiple years)
- [ ] Single transaction in a month
- [ ] Testing on the 1st day of a month
- [ ] Testing on the last day of a month

## Browser Compatibility

Test in multiple browsers:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers

## Sign-Off Checklist

After completing all tests:

- [ ] All preset filters show correct date ranges
- [ ] Date ranges match Trends and Department Analytics
- [ ] No December-anchored bugs observed
- [ ] Year boundaries handled correctly
- [ ] Custom date ranges work
- [ ] No regressions in other features
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Works across browsers

## Reporting Issues

If any tests fail, report with:
1. Which scenario failed
2. Expected vs actual behavior
3. Screenshots if applicable
4. Browser and version
5. Current date when testing
6. Any console errors

## Notes

- When testing, note your current date as it affects expected results
- Last complete month varies based on when you test
- Screenshots in this guide assume testing in November 2025
- Adjust expected results based on your test date
