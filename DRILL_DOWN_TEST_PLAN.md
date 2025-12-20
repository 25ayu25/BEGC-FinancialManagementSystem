# Claims Inventory Drill-Down Test Plan

## Test Scenarios

### 1. Total Claims Card Drill-Down
**Steps:**
1. Navigate to Claim Reconciliation page
2. Locate "Total Claims" card in Key Metrics Overview section
3. Note the count displayed on the card (e.g., "1,234")
4. Click the "Total Claims" card

**Expected Results:**
- URL changes to include `?inventoryStatus=all&inventoryYear=all&inventoryMonth=all`
- Claims Inventory section opens automatically
- Status filter shows "All"
- Year filter shows "All years"
- Month filter shows "All months"
- Claims table displays all claims
- Summary stats at top show: "Total Claims: 1,234" (matching the card count)

**Pass Criteria:**
✓ URL params are set correctly
✓ Claims Inventory opens
✓ Filters match expected values
✓ Count in inventory matches card count

---

### 2. Paid in Full Card Drill-Down
**Steps:**
1. Navigate to Claim Reconciliation page
2. Locate "Paid in Full" card in Key Metrics Overview section
3. Note the count displayed on the card (e.g., "856")
4. Click the "Paid in Full" card

**Expected Results:**
- URL changes to include `?inventoryStatus=matched&inventoryYear=all&inventoryMonth=all`
- Claims Inventory section opens automatically
- Status filter shows "Paid in full"
- Year filter shows "All years"
- Month filter shows "All months"
- Claims table displays only claims with status "Paid in full"
- Summary stats show: "Paid in full: 856" (matching the card count)
- All visible claims show green "Paid in full" badges

**Pass Criteria:**
✓ URL params are set correctly
✓ Only matched/paid-in-full claims are shown
✓ Count matches card count
✓ All claims have correct status badge

---

### 3. Follow-up Needed Card Drill-Down (Option B)
**Steps:**
1. Navigate to Claim Reconciliation page
2. Locate "Follow-up Needed" card in Key Metrics Overview section
3. Note the count displayed on the card (e.g., "278")
4. Click the "Follow-up Needed" card

**Expected Results:**
- URL changes to include `?inventoryStatus=partially_paid&inventoryYear=all&inventoryMonth=all`
- Claims Inventory section opens automatically
- Status filter shows "Paid partially"
- Year filter shows "All years"
- Month filter shows "All months"
- Claims table displays only claims with status "Paid partially"
- Summary stats show: "Paid partially: 278" (matching the card count)
- All visible claims show amber "Paid partially" badges

**IMPORTANT**: Per user choice B, the "Follow-up Needed" card drill-down shows ONLY "Paid partially" claims, even though the card count includes both "Paid partially" AND "Not paid" claims.

**Pass Criteria:**
✓ URL params show `inventoryStatus=partially_paid`
✓ Only partially paid claims are shown (NOT unpaid)
✓ Count matches the "Paid partially" subset
✓ All claims have amber "Paid partially" badges

---

### 4. Pending Remittance Card Drill-Down
**Steps:**
1. Navigate to Claim Reconciliation page
2. Locate "Pending Remittance" card in Key Metrics Overview section
3. Note the count displayed on the card (e.g., "100")
4. Click the "Pending Remittance" card

**Expected Results:**
- URL changes to include `?inventoryStatus=awaiting_remittance&inventoryYear=all&inventoryMonth=all`
- Claims Inventory section opens automatically
- Status filter shows "Pending remittance"
- Year filter shows "All years"
- Month filter shows "All months"
- Claims table displays only claims with status "Pending remittance"
- Summary stats show: "Pending remittance: 100" (matching the card count)
- All visible claims show sky-blue "Pending remittance" badges

**Pass Criteria:**
✓ URL params are set correctly
✓ Only awaiting_remittance claims are shown
✓ Count matches card count
✓ All claims have correct status badge

---

### 5. Default Behavior (No URL Params)
**Steps:**
1. Navigate to Claim Reconciliation page (fresh load, no query params)
2. Scroll down to Claims Inventory section
3. Click "View All Claims" button to open the inventory

**Expected Results:**
- URL has no query parameters
- Claims Inventory opens
- Year filter defaults to current year (e.g., "2025")
- Month filter defaults to current month (e.g., "December")
- Status filter shows "All"
- Claims table displays claims for current year + month only
- If no claims exist for current period, shows "No claims found"

**Pass Criteria:**
✓ Filters default to current year/month when no URL params present
✓ Default behavior is NOT affected by drill-down changes
✓ Opening inventory manually still works as before

---

### 6. Manual Filter Changes After Drill-Down
**Steps:**
1. Click "Paid in Full" card to drill down
2. Verify filtered view shows correctly
3. Manually change Year filter to "2024"
4. Manually change Month filter to "January"
5. Manually change Status filter to "All"

**Expected Results:**
- URL params remain in URL (optional: could update on filter change)
- Filters update immediately
- Claims table refreshes to show new filtered results
- Page resets to 1
- Summary stats update to reflect new filters
- `didUserTouchInventoryFilters` flag is set

**Pass Criteria:**
✓ Manual filter changes work after drill-down
✓ Table updates correctly
✓ No console errors
✓ User can override drill-down filters

---

### 7. Clear Filters Button
**Steps:**
1. Click "Follow-up Needed" card to drill down
2. Verify filtered view shows correctly
3. Click "Clear filters" button

**Expected Results:**
- URL params are removed from URL
- Year filter resets to "All years"
- Month filter resets to "All months"
- Status filter remains as-is (or optionally resets to "All")
- Claims table refreshes to show all claims
- Summary stats update
- Page resets to 1

**Pass Criteria:**
✓ URL params are cleared
✓ Filters reset correctly
✓ Table updates to show all data
✓ No console errors

---

### 8. Direct URL Access
**Steps:**
1. Manually enter URL: `/claim-reconciliation?inventoryStatus=matched&inventoryYear=all&inventoryMonth=all`
2. Press Enter to navigate

**Expected Results:**
- Page loads with Claims Inventory already open
- Filters are pre-set to match URL params
- Status = "Paid in full"
- Year = "All years"
- Month = "All months"
- Claims table shows filtered results immediately
- Scroll position may be at top (acceptable)

**Pass Criteria:**
✓ URL params are parsed and applied on page load
✓ Filters match URL params
✓ Claims Inventory opens automatically
✓ Correct data is displayed

---

### 9. Browser Back/Forward Buttons
**Steps:**
1. Start on Claim Reconciliation page (no params)
2. Click "Total Claims" card
3. Click browser Back button
4. Click browser Forward button

**Expected Results:**
- After step 2: URL has params, inventory shows all claims
- After step 3: URL params removed, inventory may close or reset
- After step 4: URL params restored, inventory shows all claims again
- State matches URL on each navigation

**Pass Criteria:**
✓ Browser back/forward work correctly
✓ URL and state stay in sync
✓ No console errors
✓ No data loss

---

### 10. Count Consistency Verification
**Steps:**
1. Note all card counts in Key Metrics Overview
2. Click each card one by one
3. For each drill-down, verify the filtered inventory count

**Expected Results:**
- Total Claims card count = All claims in inventory (status=all)
- Paid in Full card count = Matched claims in inventory
- Follow-up Needed card count = Partially paid claims in inventory (per Option B)
- Pending Remittance card count = Awaiting remittance claims in inventory

**Pass Criteria:**
✓ All counts are consistent
✓ No count mismatches
✓ Card counts reflect actual data in database

---

## Edge Cases

### E1. Zero Claims State
**Steps:**
1. Ensure a filter combination exists with 0 claims (e.g., delete all claims)
2. Click a card that would show 0 claims

**Expected Results:**
- Inventory opens
- Filters are set correctly
- Shows "No claims found" message with appropriate context
- No errors or crashes

**Pass Criteria:**
✓ Empty state handled gracefully
✓ User-friendly message shown

---

### E2. Rapid Card Clicks
**Steps:**
1. Rapidly click multiple cards in succession (e.g., Total Claims → Paid in Full → Pending Remittance)

**Expected Results:**
- Each click updates URL
- Final state matches last card clicked
- No race conditions
- No console errors
- No duplicate API calls

**Pass Criteria:**
✓ Final state is correct
✓ No errors in console
✓ Performance is acceptable

---

### E3. Invalid URL Params
**Steps:**
1. Navigate to `/claim-reconciliation?inventoryStatus=invalid&inventoryYear=abc&inventoryMonth=xyz`

**Expected Results:**
- Invalid params are ignored
- Filters fall back to safe defaults
- No console errors
- Page functions normally

**Pass Criteria:**
✓ Invalid params handled gracefully
✓ No crashes or errors
✓ Page remains functional

---

### E4. Partial URL Params
**Steps:**
1. Navigate to `/claim-reconciliation?inventoryStatus=matched` (missing year/month)

**Expected Results:**
- Status filter = "Paid in full"
- Year filter = defaults to current year
- Month filter = defaults to current month
- Claims Inventory opens
- Filtered results shown

**Pass Criteria:**
✓ Partial params are applied
✓ Missing params use defaults
✓ Page functions correctly

---

## Regression Testing

### R1. Reconciliation Logic Unchanged
**Steps:**
1. Upload claims file
2. Upload remittance file
3. Verify reconciliation runs
4. Check matched/partial/unpaid counts

**Expected Results:**
- Reconciliation matching logic works exactly as before
- Counts are accurate
- Matching algorithm unchanged
- No data corruption

**Pass Criteria:**
✓ Reconciliation works as before
✓ No regressions in matching logic
✓ All existing functionality preserved

---

### R2. Period Cards Still Work
**Steps:**
1. Click a period card (e.g., "January 2025")
2. Verify it sets the active period
3. Verify workflow section updates

**Expected Results:**
- Period selection works as before
- Active period updates
- Workflow section reflects selected period
- No interference from URL params

**Pass Criteria:**
✓ Period cards work normally
✓ Active period selection unchanged

---

### R3. File Upload Still Works
**Steps:**
1. Upload claims file
2. Upload remittance file
3. Verify files are processed

**Expected Results:**
- File upload works as before
- Processing completes successfully
- Reconciliation runs automatically
- Results appear in history

**Pass Criteria:**
✓ File upload unchanged
✓ Processing works correctly
✓ No regressions

---

## Performance Testing

### P1. Page Load Time
**Measure:**
- Time to load page without params
- Time to load page with params
- Compare before/after implementation

**Expected:**
- No significant performance degradation
- Page loads in < 2 seconds on average
- URL param parsing adds < 50ms

---

### P2. Filter Response Time
**Measure:**
- Time to apply filters after card click
- Time to update table after filter change
- API response time

**Expected:**
- Filters apply immediately (< 100ms)
- Table updates within 500ms
- No noticeable lag

---

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome (iOS/Android)
- [ ] Mobile Safari (iOS)

Expected: Works in all modern browsers with URLSearchParams support

---

## Accessibility Testing

- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Screen reader announces filter changes
- [ ] Focus management is correct
- [ ] No accessibility regressions

---

## Security Testing

### S1. XSS Prevention
**Test:**
1. Try malicious URL params: `?inventoryStatus=<script>alert('xss')</script>`

**Expected:**
- Params are sanitized/ignored
- No script execution
- No XSS vulnerability

---

### S2. Data Access Control
**Test:**
1. Ensure URL params don't bypass authentication
2. Verify backend still enforces access control

**Expected:**
- URL params only affect view, not data access
- Backend security unchanged
- No unauthorized data access

---

## Sign-off Checklist

- [ ] All core scenarios (1-10) pass
- [ ] All edge cases (E1-E4) handled
- [ ] No regressions (R1-R3)
- [ ] Performance acceptable (P1-P2)
- [ ] Cross-browser compatible
- [ ] Accessible
- [ ] Secure
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Ready for production

---

## Known Issues / Limitations

1. **Follow-up Needed Count Discrepancy**: The "Follow-up Needed" card shows the sum of partially_paid + unpaid claims, but clicking it shows only partially_paid claims per user choice B. This is intentional but may be confusing to users. Consider adding a tooltip to the card explaining this.

2. **URL Params Don't Update on Manual Filter Change**: When a user manually changes filters after drill-down, the URL params remain unchanged. This is acceptable but could be enhanced to keep URL in sync with state.

3. **No URL Param Validation UI**: Invalid URL params are silently ignored. Consider adding a toast notification if invalid params are detected.

## Recommendations for Future Enhancement

1. Add tooltip to "Follow-up Needed" card explaining that drill-down shows only "Paid partially" claims
2. Update URL params when user manually changes filters (optional)
3. Add toast notification for invalid URL params (optional)
4. Consider adding more drill-down cards (e.g., "Not Paid" separate from "Follow-up")
5. Add analytics tracking for card clicks to understand user behavior
