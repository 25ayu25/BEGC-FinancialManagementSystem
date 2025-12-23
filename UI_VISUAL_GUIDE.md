# UI Changes - Visual Guide

## 1. "How Matching Works" Info Card

Located at the top of the Claim Reconciliation page, this collapsible card explains the matching strategy:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⓘ  How Matching Works                    Understanding automatic... │ ▼
├─────────────────────────────────────────────────────────────────────┤
│ Claims are matched automatically using two methods for maximum      │
│ accuracy:                                                            │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ ✓  1. Invoice Match                      [Highest Confidence]   ││
│ │    Member number + Invoice/Bill number. This is the most        ││
│ │    reliable matching method.                                     ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ ≡  2. Date & Amount Match                [Verified Match]       ││
│ │    Member number + exact service date + exact billed amount.    ││
│ │    Only matched when there's a unique 1-to-1 match (no          ││
│ │    ambiguity).                                                   ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ Note: Not matched items require manual review. If multiple claims  │
│ could match the same payment (or vice versa), no automatic match   │
│ is made to prevent errors.                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Design Details:**
- Light blue background (#EFF6FF)
- Blue border (#BFDBFE)
- Info icon in blue (#3B82F6)
- Collapsible with smooth animation
- Initially collapsed to save space

## 2. Match Method Column

Added to both Claims Inventory and Claims Details tables:

```
Claims Inventory Table
┌──────────┬────────────┬──────────────┬────────────┬──────────────┬────────────┬─────────────┬────────────────┐
│ Member # │ Patient    │ Service Date │ Period     │ Billed       │ Amount     │ Status      │ Match Method   │
│          │ Name       │              │            │ Amount       │ Paid       │             │                │
├──────────┼────────────┼──────────────┼────────────┼──────────────┼────────────┼─────────────┼────────────────┤
│ CS012160 │ John Doe   │ 2024-03-15   │ Mar 2024   │ USD 100.00   │ USD 100.00 │ ✓ Paid in   │ ✓ Invoice      │
│          │            │              │            │              │            │   full      │   (tooltip)    │
├──────────┼────────────┼──────────────┼────────────┼──────────────┼────────────┼─────────────┼────────────────┤
│ CS012160 │ Jane Smith │ 2024-03-20   │ Mar 2024   │ USD 150.00   │ USD 150.00 │ ✓ Paid in   │ ≡ Date+Amount  │
│          │            │              │            │              │            │   full      │   (tooltip)    │
├──────────┼────────────┼──────────────┼────────────┼──────────────┼────────────┼─────────────┼────────────────┤
│ CS012161 │ Bob Wilson │ 2024-03-25   │ Mar 2024   │ USD 200.00   │ USD 0.00   │ ⏰ Pending  │ · Not Matched  │
│          │            │              │            │              │            │   remittance│   (tooltip)    │
└──────────┴────────────┴──────────────┴────────────┴──────────────┴────────────┴─────────────┴────────────────┘
```

## 3. Match Method Badges

Four badge types with distinct colors and icons:

### Invoice Match (Green)
```
┌─────────────────┐
│ ✓ Invoice       │  ← Green background (#10B981)
└─────────────────┘     White text
                        CheckCircle2 icon
```
**Tooltip:** "Automatically matched using member number + invoice/bill number (highest confidence)"

### Date+Amount Match (Blue)
```
┌─────────────────┐
│ ≡ Date+Amount   │  ← Blue background (#3B82F6)
└─────────────────┘     White text
                        Calculator icon
```
**Tooltip:** "Automatically matched using member number + exact service date + exact amount (verified 1-to-1 match)"

### Manual Match (Orange)
```
┌─────────────────┐
│ ✓ Manual        │  ← Orange background (#F97316)
└─────────────────┘     White text
                        UserCheck icon
```
**Tooltip:** "Manually matched by staff"

### Not Matched (Gray)
```
┌─────────────────┐
│ Not Matched     │  ← Gray background (#CBD5E1)
└─────────────────┘     Dark gray text (#334155)
                        No icon
```
**Tooltip:** "This claim has not been matched to a payment statement yet"

## 4. Complete Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Claim Reconciliation                                           [Help Guide] │
│ Match payments to claims instantly                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⓘ  How Matching Works                              Understanding auto...  ▼│
│ (COLLAPSED - Click to expand)                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ KEY METRICS OVERVIEW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Remittance Uploads]  [Total Claims]  [Awaiting Payment]                   │
│ [Paid in Full]        [Follow-up]     [Claims Submitted]                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CLAIMS INVENTORY                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status: [All ▼]  Year: [All ▼]  Month: [All ▼]                             │
│                                                                              │
│ ┌─ Claims Table with Match Method Column ────────────────────────────────┐ │
│ │ (Shows color-coded badges for each claim's match method)               │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. User Interactions

### Hovering over Match Method Badge
```
   ┌──────────────────────────────────────────────────┐
   │ ✓ Invoice                                        │
   │                                                  │
   │ Automatically matched using member number +     │
   │ invoice/bill number (highest confidence)        │
   └──────────────────────────────────────────────────┘
        ▲
        │
   [✓ Invoice]  ← User hovers here
```

### Expanding Info Card
```
Before (Collapsed):
┌─────────────────────────────────────────────┐
│ ⓘ  How Matching Works              ▼       │
└─────────────────────────────────────────────┘

After (Expanded):
┌─────────────────────────────────────────────┐
│ ⓘ  How Matching Works              ▲       │
├─────────────────────────────────────────────┤
│ (Full content with explanations)            │
│ - Invoice Match                              │
│ - Date & Amount Match                        │
│ - Note about manual review                   │
└─────────────────────────────────────────────┘
```

## 6. Responsive Behavior

- **Desktop**: Full table with all columns visible
- **Tablet**: Table scrolls horizontally, Match Method column always visible
- **Mobile**: Card-based layout with badges stacked

## 7. Accessibility Features

- ✅ Tooltips are keyboard-accessible (Tab to focus, Space/Enter to open)
- ✅ Color is not the only indicator (icons + text labels)
- ✅ ARIA labels for screen readers
- ✅ Sufficient color contrast (WCAG AA compliant)
- ✅ Focus indicators on interactive elements

## Color Palette

| Element          | Color     | Hex       | Usage                    |
|------------------|-----------|-----------|--------------------------|
| Invoice Badge    | Green     | #10B981   | Highest confidence match |
| Date+Amt Badge   | Blue      | #3B82F6   | Verified secondary match |
| Manual Badge     | Orange    | #F97316   | Staff intervention       |
| Not Matched Badge| Gray      | #CBD5E1   | No match found           |
| Info Card BG     | Light Blue| #EFF6FF   | Information display      |
| Info Card Border | Blue      | #BFDBFE   | Visual boundary          |

## Implementation Notes

- All badges use shadow-sm for subtle depth
- Smooth transitions (200ms) on hover states
- Badges are inline-flex for proper icon alignment
- Tooltips use Radix UI for consistency
- Info card uses Radix Collapsible for animation
