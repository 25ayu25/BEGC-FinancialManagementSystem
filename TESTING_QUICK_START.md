# Quick Start Guide: Testing Claims Inventory Drill-Down

## What Was Fixed?

Previously, clicking Key Metrics Overview cards would navigate to Claims Inventory, but the default "current year + current month" filters would override the drill-down intent, showing 0 rows instead of the expected data.

Now, clicking a card sets explicit URL parameters that take precedence over default filters, ensuring you see the exact data the card represents.

## How to Test (5 Minutes)

### Prerequisites
1. Have some claim data in the system (any provider, any period)
2. Navigate to the Claim Reconciliation page
3. You should see the "Key Metrics Overview" section at the top

### Quick Test Steps

#### Test 1: Total Claims (30 seconds)
1. Look at the "Total Claims" card - note the number (e.g., "1,234")
2. Click the "Total Claims" card
3. ✅ **Expected**: 
   - Claims Inventory section opens below
   - URL shows `?inventoryStatus=all&inventoryYear=all&inventoryMonth=all`
   - Status filter = "All"
   - Year filter = "All years"
   - Month filter = "All months"
   - Summary shows "Total Claims: 1,234" (matching the card)
   - Table shows all claims

#### Test 2: Paid in Full (30 seconds)
1. Look at the "Paid in Full" card - note the number (e.g., "856")
2. Click the "Paid in Full" card
3. ✅ **Expected**:
   - Claims Inventory section opens
   - URL shows `?inventoryStatus=matched&inventoryYear=all&inventoryMonth=all`
   - Status filter = "Paid in full"
   - Summary shows "Paid in full: 856" (matching the card)
   - All claims shown have green "Paid in full" badges

#### Test 3: Follow-up Needed (30 seconds)
1. Look at the "Follow-up Needed" card - note the number
2. Click the "Follow-up Needed" card
3. ✅ **Expected**:
   - Claims Inventory opens
   - URL shows `?inventoryStatus=partially_paid&inventoryYear=all&inventoryMonth=all`
   - Status filter = "Paid partially"
   - Summary shows "Paid partially: XXX"
   - All claims have amber "Paid partially" badges

**Note**: The card shows partially_paid + unpaid counts, but drill-down shows only partially_paid per user choice B.

#### Test 4: Pending Remittance (30 seconds)
1. Look at the "Pending Remittance" card - note the number
2. Click the "Pending Remittance" card
3. ✅ **Expected**:
   - Claims Inventory opens
   - URL shows `?inventoryStatus=awaiting_remittance&inventoryYear=all&inventoryMonth=all`
   - Status filter = "Pending remittance"
   - Summary shows "Pending remittance: XXX"
   - All claims have blue "Pending remittance" badges

#### Test 5: Default Behavior Still Works (1 minute)
1. Clear your browser URL (remove query params)
2. Navigate to Claim Reconciliation page fresh
3. Click "View All Claims" button to open Claims Inventory
4. ✅ **Expected**:
   - Year filter defaults to current year (e.g., "2025")
   - Month filter defaults to current month (e.g., "December")
   - Shows claims for current period only
   - No URL params in URL

#### Test 6: Clear Filters Button (30 seconds)
1. Click any Key Metrics card to drill down
2. Verify filtered view shows
3. Click the "Clear filters" button (next to Year/Month dropdowns)
4. ✅ **Expected**:
   - URL params are removed
   - Year filter resets to "All years"
   - Month filter resets to "All months"
   - Table updates to show all data

#### Test 7: Manual Filter Changes (30 seconds)
1. Click any Key Metrics card to drill down
2. Manually change the Year dropdown to a specific year
3. Manually change the Month dropdown to a specific month
4. ✅ **Expected**:
   - Filters apply immediately
   - Table updates to show filtered results
   - You can override the drill-down filters

## Common Issues & Solutions

### Issue: Card shows 100 claims, but inventory shows 0
**Likely Cause**: Period filters are defaulting to current year/month which has no data.

**Check**: 
- Look at the URL - does it have `inventoryYear=all&inventoryMonth=all`?
- Look at the Year/Month dropdowns - are they set to "All years" and "All months"?

**Solution**: If URL params are missing or filters aren't set to "All", the fix didn't work. Report this issue.

### Issue: Follow-up Needed card shows 100, but inventory shows 75
**This is Expected**: Per user choice B, the Follow-up Needed card shows partially_paid + unpaid counts, but the drill-down shows only partially_paid claims. The numbers will differ if there are unpaid claims.

### Issue: Clicking a card doesn't open the inventory
**Solution**: Refresh the page and try again. If it persists, check browser console for errors.

### Issue: URL params don't appear when clicking a card
**Solution**: Check that you're on the latest code version. The fix uses URL params, so they should always appear.

## Success Criteria

✅ All 4 cards drill down correctly
✅ Counts match between cards and filtered inventory
✅ URL params are set correctly for each card
✅ Default behavior works when opening inventory manually
✅ Clear filters button works
✅ Manual filter changes work after drill-down

## Screenshots to Take (Optional)

For verification, take screenshots of:
1. Key Metrics Overview cards with counts visible
2. Claims Inventory after clicking "Total Claims" showing all claims
3. Claims Inventory after clicking "Paid in Full" showing only matched claims
4. URL bar showing query parameters

## What If Tests Fail?

1. **Clear browser cache** and try again
2. **Check browser console** for JavaScript errors
3. **Verify you're on the latest code** (git pull and rebuild)
4. **Report the specific test that failed** with:
   - Which card you clicked
   - What you expected to see
   - What you actually saw
   - Screenshot of the URL and filters

## Advanced Testing (Optional)

### Test Browser Back/Forward
1. Click "Total Claims" card
2. Click browser Back button
3. Click browser Forward button
4. ✅ Filters and data should match URL on each navigation

### Test Direct URL Access
1. Copy this URL: `/claim-reconciliation?inventoryStatus=matched&inventoryYear=all&inventoryMonth=all`
2. Paste in browser and navigate
3. ✅ Claims Inventory should open automatically with filters applied

### Test Multiple Rapid Clicks
1. Rapidly click: Total Claims → Paid in Full → Pending Remittance
2. ✅ Final state should match last card clicked

## Estimated Test Time

- **Quick test (Tests 1-7)**: 5 minutes
- **Full test with screenshots**: 10 minutes
- **Advanced testing**: +5 minutes

## Questions?

Refer to:
- `DRILL_DOWN_IMPLEMENTATION.md` for technical details
- `DRILL_DOWN_TEST_PLAN.md` for comprehensive test scenarios

## Sign-Off

After testing, please confirm:
- [ ] All 4 card drill-downs work correctly
- [ ] Counts match between cards and inventory
- [ ] Default behavior unchanged
- [ ] No console errors
- [ ] No visual glitches

**Tester**: _______________
**Date**: _______________
**Status**: ☐ Pass ☐ Fail ☐ Needs Review

If **Fail**, describe issues:
_________________________________
_________________________________
_________________________________
