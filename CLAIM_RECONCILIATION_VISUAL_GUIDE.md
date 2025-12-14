# Claim Reconciliation UX - Visual Guide

## UI States and Behavior

### 1. Initial State (No Files Selected)

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🔵  No data for this period                               │
│     No claims have been uploaded for this provider and     │
│     period yet.                                             │
└────────────────────────────────────────────────────────────┘
```

**File Upload Zones:**
```
┌─────────────────────────┐  ┌─────────────────────────┐
│  📄 Claims submitted    │  │  💰 Remittance advice   │
│                         │  │                         │
│  [Click to upload]      │  │  [Click to upload]      │
│  or drag & drop         │  │  or drag & drop         │
│  Excel files            │  │  Excel files            │
└─────────────────────────┘  └─────────────────────────┘
   Blue tinted border         Green tinted border
```

**Action Button:**
```
┌────────────────────────────────────────────────────────────┐
│                 Select files to continue                   │
│                      (Disabled - Gray)                      │
└────────────────────────────────────────────────────────────┘
```

**Help Text:**
"Upload your claims file to store them while waiting for remittance, or upload both files to reconcile immediately."

---

### 2. Claims File Only Selected

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🔵  No data for this period                               │
│     No claims have been uploaded for this provider and     │
│     period yet.                                             │
└────────────────────────────────────────────────────────────┘
```

**File Upload Zones:**
```
┌─────────────────────────┐  ┌─────────────────────────┐
│  📄 Claims submitted    │  │  💰 Remittance advice   │
│  ✓ claims_dec2024.xlsx  │  │                         │
│    125.3 KB         [X] │  │  [Click to upload]      │
└─────────────────────────┘  └─────────────────────────┘
   File selected - Blue       Empty - Green tint
```

**Action Button:**
```
┌────────────────────────────────────────────────────────────┐
│  📄  Store Claims (Awaiting Remittance)                    │
│                  (Enabled - Blue)                           │
└────────────────────────────────────────────────────────────┘
```

**Help Text:**
"Upload your claims file to store them while waiting for remittance."

---

### 3. Remittance File Only Selected (WITH Existing Claims)

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🟡  42 claims awaiting remittance                         │
│     Claims have been stored. Upload the remittance file   │
│     to reconcile.                                           │
└────────────────────────────────────────────────────────────┘
```

**File Upload Zones:**
```
┌─────────────────────────┐  ┌─────────────────────────┐
│  📄 Claims submitted    │  │  💰 Remittance advice   │
│                         │  │  ✓ remittance_dec.xlsx  │
│  [Click to upload]      │  │    89.7 KB          [X] │
└─────────────────────────┘  └─────────────────────────┘
   Empty - Blue tint          File selected - Green
```

**Action Button:**
```
┌────────────────────────────────────────────────────────────┐
│  ✓  Reconcile Against Stored Claims                        │
│                 (Enabled - Green)                           │
└────────────────────────────────────────────────────────────┘
```

**Help Text:**
"Upload remittance to reconcile against stored claims for this period."

---

### 4. Remittance File Only Selected (WITHOUT Claims) ⚠️

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🔵  No data for this period                               │
│     No claims have been uploaded for this provider and     │
│     period yet.                                             │
└────────────────────────────────────────────────────────────┘
```

**Inline Warning:**
```
┌────────────────────────────────────────────────────────────┐
│ ⚠️  No claims found for CIC - December 2024              │
│     Please upload claims first or select a different       │
│     period.                                                 │
└────────────────────────────────────────────────────────────┘
   Orange warning banner
```

**Action Button:**
```
┌────────────────────────────────────────────────────────────┐
│  ✓  Reconcile Against Stored Claims                        │
│                 (Enabled - Green)                           │
└────────────────────────────────────────────────────────────┘
```

**Help Text:**
"⚠️ No claims found for this period. Please upload claims first or select a different period."

**Note:** Button will still submit but backend will return 400 error. The inline warning prepares the user for this.

---

### 5. Both Files Selected

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🔵  No data for this period                               │
│     No claims have been uploaded for this provider and     │
│     period yet.                                             │
└────────────────────────────────────────────────────────────┘
```

**File Upload Zones:**
```
┌─────────────────────────┐  ┌─────────────────────────┐
│  📄 Claims submitted    │  │  💰 Remittance advice   │
│  ✓ claims_dec2024.xlsx  │  │  ✓ remittance_dec.xlsx  │
│    125.3 KB         [X] │  │    89.7 KB          [X] │
└─────────────────────────┘  └─────────────────────────┘
   Blue with file             Green with file
```

**Action Button:**
```
┌────────────────────────────────────────────────────────────┐
│  ⬆  Upload & Reconcile                                     │
│         (Enabled - Orange Gradient)                         │
└────────────────────────────────────────────────────────────┘
```

**Help Text:**
"Both files ready - click to upload and reconcile immediately."

---

### 6. After Claims Uploaded (Awaiting Remittance)

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🟡  42 claims awaiting remittance                         │
│     Claims have been stored. Upload the remittance file   │
│     to reconcile.                                           │
└────────────────────────────────────────────────────────────┘
```

**Success Toast:**
```
✓ Claims uploaded
  42 claims uploaded – awaiting remittance
```

---

### 7. After Full Reconciliation

**Period Status Indicator:**
```
┌────────────────────────────────────────────────────────────┐
│ 🟢  Reconciled (35 matched, 5 partial, 2 unpaid)         │
│     This period has 42 claims and 40 remittances.         │
└────────────────────────────────────────────────────────────┘
```

**Success Toast:**
```
✓ Reconciliation complete
  42 claims, 35 matched, 5 partial, 2 unpaid
```

---

## Color Scheme

### Button Colors
- **Blue** (`bg-blue-500`) - Claims-only operations
- **Green** (`bg-green-500`) - Remittance/reconciliation operations
- **Orange Gradient** (`from-orange-500 to-amber-500`) - Both files operations
- **Gray** (`bg-slate-300`) - Disabled state

### Status Indicators
- **🔵 Blue** - No data / initial state
- **🟡 Yellow** - Claims awaiting remittance (pending)
- **🟢 Green** - Reconciled / complete

### File Upload Zones
- **Blue tint** - Claims file zone
- **Green tint** - Remittance file zone

### Warning/Error
- **Orange** - Inline validation warnings

---

## Loading States

### Period Status Loading
```
┌────────────────────────────────────────────────────────────┐
│  ⏳  Loading period status...                             │
└────────────────────────────────────────────────────────────┘
```

### Button Processing
```
┌────────────────────────────────────────────────────────────┐
│  ⏳  Processing…                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Interaction Flow

```
User arrives at page
         ↓
Selects Provider/Year/Month
         ↓
Period status loads automatically ← [Shows 🔵/🟡/🟢 indicator]
         ↓
User drops/selects files
         ↓
Button adapts automatically ← [Blue/Green/Orange based on files]
         ↓
Help text updates ← [Contextual guidance]
         ↓
Inline warning shows (if needed) ← [Prevents errors]
         ↓
User clicks single action button
         ↓
Correct endpoint called automatically
         ↓
Success toast shows
         ↓
Period status refreshes
         ↓
Files cleared from dropzones
```

---

## Keyboard Accessibility

- All dropzones are keyboard accessible via tab navigation
- File selection can be triggered with Enter/Space
- Dropdowns are fully keyboard navigable
- Button can be activated with Enter/Space

---

## Responsive Behavior

### Desktop (≥768px)
- Form fields in 6-column grid (3 columns × 2 rows)
- File zones side by side
- Full button width

### Mobile (<768px)
- Form fields stack vertically
- File zones stack vertically
- Full-width button
- Compact period status

---

## Animation & Transitions

1. **Button color transitions** - Smooth color change when files added/removed
2. **Period status loading** - Spinner animation
3. **File zone hover** - Gradient border effect on hover
4. **Warning appearance** - Fade in when condition met
5. **Success toasts** - Slide in from top-right

---

## Accessibility Features

- ✅ ARIA labels on all interactive elements
- ✅ Color contrast ratio meets WCAG AA standards
- ✅ Icons paired with text labels
- ✅ Loading states announced to screen readers
- ✅ Error messages associated with form fields
- ✅ Keyboard navigation fully supported
