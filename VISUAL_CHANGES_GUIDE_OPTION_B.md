# Visual Changes Guide - Option B Implementation

## UI Terminology Changes

### Before and After Examples

#### 1. Status Labels
**Before:**
- "Pending remittance"
- "Awaiting remittance"

**After:**
- "Pending payment statement" (used consistently everywhere)

---

#### 2. File Upload Section
**Before:**
```
Label: "Remittance File"
Description: "Upload payment statement/remittance advice from insurance"
Button: "💰 Upload Remittance File"
```

**After:**
```
Label: "Payment Statement File"  
Description: "Upload payment statement file from insurance"
Button: "💰 Upload Payment Statement File"
```

---

#### 3. Dropdown Menu Items
**Before:**
- "Replace remittance file"
- "Clear remittances"
- "Delete remittances"

**After:**
- "Replace payment statement file"
- "Clear payment statements"
- "Delete payment statements"

---

## Reconciliation History Table

### Column Name Change
**Before:** "Payment statements" (confusing - was counting rows)
**After:** "Statement lines" with info icon tooltip

**Tooltip Text:** "Number of rows in the uploaded payment statement file"

### Explanatory Note (NEW)
A blue info box now appears above the History table:

```
ℹ️ Note: A payment statement can include multiple months. 
Each upload is matched against all outstanding claims.
```

### Column Tooltips (NEW)
Each result column now has an explanatory tooltip:

**Paid in full:**
"Claims found in the uploaded payment statement with full payment. Can include claims from any month."

**Partial:**
"Claims found in the uploaded payment statement with partial payment. Can include claims from any month."

**Not paid:**
"Claims found in the uploaded payment statement with $0 paid. Can include claims from any month."

---

## KPI Dashboard

### First KPI - Enhanced
**Before:**
```
Title: "Payment Statements Uploaded"
Value: 15
Subtitle: "statements processed"
Footer: "Latest: Jan 2025"
```

**After:**
```
Title: "Payment Statement Uploads"
Value: 15
Subtitle: "files processed"
Footer 1: "Latest: Jan 2025"
Footer 2: "(Each file can cover multiple months)"
```

### Second KPI - NEW
```
Icon: Calculator (purple)
Title: "Claim Months Uploaded"
Value: 8
Subtitle: "periods"
Footer: "Unique provider+month combinations"
```

**Purpose:** Shows the number of unique claim periods uploaded, explaining why the upload count differs from period count.

---

## Claims Inventory Section

### Filter Tabs
**Before:**
- Tab: "Pending remittance"
- Export option: "Pending remittance"
- Summary stat: "Pending remittance"

**After:**
- Tab: "Pending payment statement"
- Export option: "Pending payment statement"
- Summary stat: "Pending payment statement"

---

## Toast Notifications

### Success Messages
**Before:**
```
"${count} claims uploaded – awaiting remittance"
```

**After:**
```
"${count} claims uploaded – pending payment statement"
```

### Deletion Messages
**Before:**
```
"Remittances deleted"
"All remittances for the period were removed."
```

**After:**
```
"Payment statements deleted"
"All payment statements for the period were removed."
```

---

## Error Messages

### File Selection Errors
**Before:**
```
"Please select a remittance file."
"Please select both the claims and remittance files."
```

**After:**
```
"Please select a payment statement file."
"Please select both the claims and payment statement files."
```

### Deletion Errors
**Before:**
```
"Failed to delete remittances"
```

**After:**
```
"Failed to delete payment statements"
```

---

## Help Text & Descriptions

### Context-Aware Help
**Before:**
```
"Claims are ready! Upload the remittance file to reconcile."
"Upload your claims file to store them while waiting for remittance"
```

**After:**
```
"Claims are ready! Upload the payment statement file to reconcile."
"Upload your claims file to store them while waiting for payment statement"
```

---

## Tooltips Throughout UI

### Metrics and Percentages
**Before:**
```
"Seen in remittance"
Tooltip: "Percent of claims that appear in a remittance"
Formula: "((Total - Pending remittance) ÷ Total claims) × 100"
```

**After:**
```
"Seen in payment statement"
Tooltip: "Percent of claims that appear in a payment statement"
Formula: "((Total - Pending payment statement) ÷ Total claims) × 100"
```

---

## Status Badges

### Period Card Badges
**Before:**
```
Badge: "Pending remittance" (light blue)
Text: "X pending remittance"
```

**After:**
```
Badge: "Pending payment statement" (light blue)
Text: "X pending payment statement"
```

---

## Key Visual Improvements

### 1. Consistency
- All terminology now uses "payment statement" consistently
- No more mixing of "remittance" and "payment statement" terms

### 2. Clarity
- Column headers are now descriptive
- Tooltips explain what numbers represent
- Notes explain cross-month matching behavior

### 3. Information Architecture
- Two KPIs clearly show different metrics
- Explanatory text prevents confusion
- Visual hierarchy guides users

### 4. User Guidance
- Blue info box prominently explains key concept
- Tooltips provide context without cluttering UI
- Help text adapts to current state

---

## Backend Status Logic (Not Visible but Important)

### Status Determination Rules
The backend now strictly enforces these rules:

1. **Claim matched AND paid = billed**
   - Status: `matched` / `paid`
   - Label: "Paid in full"

2. **Claim matched AND 0 < paid < billed**
   - Status: `partially_paid`
   - Label: "Paid partially"

3. **Claim matched AND paid = 0**
   - Status: `unpaid`
   - Label: "Not paid (0 paid)"

4. **Claim NOT matched**
   - Status: `awaiting_remittance`
   - Label: "Pending payment statement"
   - **Critical:** Claims without a matching payment line remain in awaiting status

### Why This Matters
- Prevents false "unpaid" classifications
- Accurately tracks claims through their lifecycle
- Supports delayed and mixed-month payment statements
- Maintains data integrity across reconciliation runs

---

## Summary

All visual elements now use consistent, clear terminology:
- ✅ "Payment statement" instead of "remittance"
- ✅ Clear tooltips and explanations
- ✅ Self-documenting interface
- ✅ Accurate status tracking

The UI now clearly communicates:
- What payment statements are
- How cross-month matching works
- Why different metrics show different counts
- What each status means for claims
