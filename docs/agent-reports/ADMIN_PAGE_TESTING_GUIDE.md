# Admin Page Responsive Testing Guide

**Purpose:** Step-by-step instructions to verify responsive behavior across devices  
**Duration:** ~30 minutes for full manual test  
**Tools Needed:** Chrome DevTools, test login credentials

---

## Pre-Test Setup

### 1. Start Dev Server
```bash
npm run dev
# Should be running on http://localhost:3000
```

### 2. Login & Navigate to Admin
```
URL: http://localhost:3000/admin
Login: Use valid admin credentials
Expected: Admin dashboard loads with sidebar and main content
```

### 3. Open Chrome DevTools
```
Windows/Linux: Ctrl+Shift+I
macOS: Cmd+Option+I
Click: Toggle device toolbar (Ctrl+Shift+M)
```

---

## Test Suite 1: MOBILE (320px - 430px)

### Device Presets
- iPhone SE (375px × 812px)
- iPhone 12 (390px × 844px)
- Galaxy S21 (360px × 800px)
- Custom: 320px × 800px (smallest target)

### Test Sequence

#### A. Navigation & Header
```
[ ] 1. Hamburger menu appears in top-left
      Expected: ☰ icon visible, not full sidebar

[ ] 2. Click hamburger to open menu
      Expected: Sidebar slides in from left with ~280px width
      Expected: Dark overlay appears behind sidebar
      Expected: Navigation items readable (Faculty, Clinical, etc.)

[ ] 3. Click navigation item (e.g., "Residents")
      Expected: View changes to Residents section
      Expected: Sidebar closes automatically
      Expected: No visual jump or layout shift

[ ] 4. Hamburger closes sidebar
      Expected: Clicking hamburger again toggles closed
      Expected: Overlay disappears
      Expected: Top bar stays visible

[ ] 5. Top bar logo display
      Expected: Only logo shows (no "Dependable Care" text)
      Expected: Logo centered in available space
      Expected: Date not visible (saves space)

[ ] 6. Bell icon (notifications)
      Expected: Bell icon visible and tappable
      Expected: Min 36px touch target

[ ] 7. User menu
      Expected: User avatar and logout NOT visible (hidden on mobile)
      Expected: Space preserved for hamburger
```

**Result:** _____ PASS / FAIL

#### B. Dashboard Section - Stat Cards
```
[ ] 1. Scroll dashboard into view
      Expected: Stat cards visible at top

[ ] 2. Verify stat cards layout
      Expected: Cards stacked vertically (1 column)
      Expected: Each card spans full content width
      Expected: NO horizontal scroll

[ ] 3. Verify stat card content
      Expected: Label readable (e.g., "Active Residents")
      Expected: Number large and clear (28px font)
      Expected: Sub-text visible (e.g., "Current census")
      Expected: All text fits without truncation

[ ] 4. Stat card styling
      Expected: Colored top border (navy, blue, red, etc.)
      Expected: Consistent padding and spacing
      Expected: Readable contrast
```

**Card Example - Should Show:**
```
┌─────────────────────┐
│ ■ ACTIVE RESIDENTS  │  ← colored border
│                     │
│      12             │  ← large number
│                     │
│ Current census      │  ← sub-text
└─────────────────────┘
```

**Result:** _____ PASS / FAIL

#### C. Dashboard Section - Quick Links
```
[ ] 1. Scroll down to quick link cards
      Expected: Cards visible below stat cards

[ ] 2. Verify layout
      Expected: Quick links stacked vertically (1 column)
      Expected: Each link spans full width
      Expected: NO horizontal scroll

[ ] 3. Verify each card content
      Expected: Icon visible and large (18px)
      Expected: Title readable (e.g., "Residents")
      Expected: Description visible (e.g., "View and manage...")
      Expected: All text readable

[ ] 4. Click quick link
      Expected: Navigates to corresponding section
      Expected: No layout shift
      Expected: New section loads
```

**Result:** _____ PASS / FAIL

#### D. Residents Section
```
[ ] 1. Navigate to Residents (sidebar or quick link)
      Expected: Residents page loads

[ ] 2. Verify resident cards layout
      Expected: Cards stacked vertically (1 column)
      Expected: Each card spans full width
      Expected: NO horizontal scroll

[ ] 3. Verify card content
      Expected: Avatar visible (initials in circle)
      Expected: Name readable
      Expected: Diagnosis readable
      Expected: Gender, status readable
      Expected: Adequate spacing

[ ] 4. Stat cards on Residents page
      Expected: Also in 1-column layout
      Expected: Readable and uncrramped

[ ] 5. Click "Admit Resident" button
      Expected: Button visible and tappable
      Expected: Min 36px height
      Expected: Click navigates correctly
```

**Result:** _____ PASS / FAIL

#### E. Staff Section
```
[ ] 1. Navigate to "Staff Directory" from sidebar
      Expected: Staff page loads

[ ] 2. Verify staff table
      Expected: Table visible and scrollable horizontally
      Expected: Only Name column and Action button visible
      Expected: NO vertical scroll on table itself
      Expected: Smooth horizontal scroll with touch

[ ] 3. Click "View All" button
      Expected: Staff detail view opens (modal or expanded row)
      Expected: Detail view readable on 320px
      Expected: Scrollable if needed

[ ] 4. Detail view content
      Expected: Contact section (email, phone)
      Expected: Employment section (hire date, shift)
      Expected: Single column layout
      Expected: No side-by-side cramped sections

[ ] 5. Close detail view
      Expected: Back to table view
      Expected: Position preserved (scroll position)
```

**Result:** _____ PASS / FAIL

#### F. Face Sheets Section
```
[ ] 1. Navigate to "Face Sheets"
      Expected: Resident selection cards visible

[ ] 2. Verify resident card layout
      Expected: Cards in 1 column layout
      Expected: Each card spans full width
      Expected: NO horizontal scroll

[ ] 3. Select a resident
      Expected: Face sheet detail opens
      Expected: Detail scrolls vertically (expected)
      Expected: NO horizontal scroll on detail

[ ] 4. Verify detail grids
      Expected: Demographics grid in 1 column
      Expected: Clinical Summary grid in 1 column
      Expected: Consent & Rights grid in 1 column
      Expected: All fields readable

[ ] 5. Field layout
      Expected: Label above field
      Expected: Field spans full width
      Expected: Multiple fields stack vertically
```

**Result:** _____ PASS / FAIL

#### G. Touch Interactions
```
[ ] 1. Touch hamburger to toggle menu
      Expected: Responsive, no delay (< 200ms)
      Expected: Visual feedback (icon animates)

[ ] 2. Touch navigation items
      Expected: Highlight on touch
      Expected: Color change indicates selection
      Expected: View changes on release

[ ] 3. Touch buttons
      Expected: All buttons respond to touch
      Expected: No "sticky" or doubled taps needed

[ ] 4. Scroll gestures
      Expected: Main content scrolls smoothly
      Expected: Table horizontal scroll works with swipe
      Expected: Modal scrolls if needed

[ ] 5. Tap dropdowns/selects
      Expected: Opens menu
      Expected: Options visible
      Expected: Selectable with touch
```

**Result:** _____ PASS / FAIL

---

## Test Suite 2: TABLET (768px - 1024px)

### Device Presets
- iPad (768px × 1024px)
- iPad Mini (768px × 1024px)
- Tablet (820px × 1180px)

### Quick Spot Checks (Not Full Re-Test)

#### A. Navigation
```
[ ] Hamburger hidden (sidebar visible as permanent column)
[ ] Sidebar shows at ~215px width
[ ] Sidebar takes up ~17% of screen
[ ] Main content gets remaining 83%
```

#### B. Stat Cards
```
[ ] Stat cards in 2-column layout
[ ] Cards readable with adequate spacing
[ ] No horizontal scroll
[ ] Padding appropriate for larger screen
```

#### C. Quick Links
```
[ ] Quick links in 2-column layout
[ ] Cards well-proportioned
[ ] Text readable
```

#### D. Resident/Staff Cards
```
[ ] Resident cards in 2-column layout
[ ] Staff table shows more columns: Name, Role, Status, Action
[ ] All readable without horizontal scroll
```

#### E. Face Sheet Grids
```
[ ] Demographics grid in 2 columns
[ ] Clinical Summary grid in 2 columns
[ ] Detail view more spacious than mobile
```

**Result:** _____ PASS / FAIL

---

## Test Suite 3: DESKTOP (1280px+)

### Device Presets
- Desktop 1280px
- Desktop 1920px (wide)

### Quick Spot Checks

#### A. Full Layout
```
[ ] Sidebar visible at 215px (permanent)
[ ] Main content takes up remaining width
[ ] Top bar spans full width
[ ] Proportions look balanced
```

#### B. Stat Cards
```
[ ] Stat cards in 3-column layout
[ ] 6 cards = 2 rows × 3 columns
[ ] Spacing optimal
```

#### C. Quick Links
```
[ ] Quick links in 3-column layout
[ ] 6 items = 2 rows × 3 columns
[ ] Cards well-proportioned
```

#### D. All Sections
```
[ ] Resident cards: 3 columns
[ ] Staff table: All columns visible
[ ] Face sheet grids: Full multi-column layout
[ ] No layout issues at extreme widths (1920px)
```

**Result:** _____ PASS / FAIL

---

## Test Suite 4: ACCESSIBILITY

### Keyboard Navigation (All Breakpoints)

```
[ ] 1. Tab through navigation
      Expected: Tab moves through nav items in order
      Expected: Focus ring visible around each item
      Expected: Enter/Space triggers selection

[ ] 2. Tab through buttons
      Expected: All buttons accessible
      Expected: Focus style visible (background change)

[ ] 3. Tab into modal
      Expected: Focus moves to modal
      Expected: Can tab through modal fields
      Expected: Close button accessible

[ ] 4. Tab order logical
      Expected: Top-to-bottom, left-to-right
      Expected: No jumping around screen
```

**Result:** _____ PASS / FAIL

### Screen Reader Testing (Optional - Need Screen Reader)

```
[ ] Page title announced ("Admin Dashboard")
[ ] Navigation labeled ("Admin navigation")
[ ] Current page announced on nav items
[ ] Form fields have labels
[ ] Buttons have descriptive names
[ ] Status badges announced
```

**Result:** _____ PASS / FAIL

### Color Contrast

```
[ ] Navy text on white: ✅ WCAG AAA (18:1)
[ ] Blue text on white: ✅ WCAG AA (7.5:1)
[ ] Muted gray on white: ✅ WCAG AA (4.5:1)
[ ] No color-only information (always has text)
```

**Result:** _____ PASS / FAIL

---

## Test Suite 5: MODALS & SPECIAL VIEWS

### Modal at Mobile (320px)

```
[ ] 1. Trigger admission review modal (Pending Admissions)
      Expected: Modal appears centered
      Expected: Modal width responsive (min 500px, 95vw max)
      Expected: On 320px: Modal = ~304px width (320 × 0.95)

[ ] 2. Modal content
      Expected: Header visible (navy bar with title)
      Expected: Close button (✕) visible and tappable
      Expected: Content scrollable vertically if needed
      Expected: NO horizontal scroll in modal

[ ] 3. Modal fields
      Expected: Form fields full width
      Expected: Text areas readable
      Expected: Dropdowns functional

[ ] 4. Close modal
      Expected: Click close button or outside overlay
      Expected: Modal closes smoothly
      Expected: Returns to previous view
```

**Result:** _____ PASS / FAIL

### Modal at Tablet (768px)

```
[ ] Modal width appropriate for tablet
[ ] Content area spacious
[ ] All fields visible without excessive scrolling
```

**Result:** _____ PASS / FAIL

### Modal at Desktop (1280px)

```
[ ] Modal centered on screen
[ ] Width appropriate (680px max)
[ ] Lots of white space (not cramped)
```

**Result:** _____ PASS / FAIL

---

## Test Suite 6: PERFORMANCE

### Mobile (320px)
```
[ ] Initial page load: < 3 seconds
[ ] Navigation click: Instant (< 500ms)
[ ] Menu open: Smooth animation (300ms)
[ ] Scroll: Smooth (no jank)
[ ] No lag when hovering buttons (300ms transition)
```

**Result:** _____ PASS / FAIL

### Desktop (1280px)
```
[ ] All above expectations met
[ ] No layout thrashing on resize
[ ] Sidebar toggle smooth
```

**Result:** _____ PASS / FAIL

---

## Common Issues Checklist

During testing, watch for these problems:

```
[ ] Content pushed off-screen (horizontal scroll on main area)
[ ] Text truncation (words cut off)
[ ] Overlapping elements (buttons over text)
[ ] Touch targets too small (< 36px)
[ ] Colors hard to read (low contrast)
[ ] Modal can't be closed (close button off-screen)
[ ] Sidebar doesn't close after selection
[ ] Headers too large for screen
[ ] Tables unreadable (too many cramped columns)
[ ] Form fields too narrow (< 150px)
[ ] Buttons not responding to touch
[ ] Focus ring not visible (keyboard nav broken)
```

---

## Test Results Summary

### Mobile (320-430px)
- Stat Cards: _____ (1 col expected)
- Quick Links: _____ (1 col expected)
- Resident Cards: _____ (1 col expected)
- Staff Table: _____ (Name + Action only expected)
- Face Sheet Grids: _____ (1 col expected)
- Touch: _____
- Overall: _____ PASS / FAIL

### Tablet (768-1024px)
- Stat Cards: _____ (2 cols expected)
- Quick Links: _____ (2 cols expected)
- Resident Cards: _____ (2 cols expected)
- Staff Table: _____ (Name, Role, Status, Action expected)
- Face Sheet Grids: _____ (2 cols expected)
- Overall: _____ PASS / FAIL

### Desktop (1280px+)
- All Components: _____ (3 cols, full layout expected)
- Overall: _____ PASS / FAIL

### Accessibility
- Keyboard: _____ PASS / FAIL
- Focus: _____ PASS / FAIL
- Contrast: _____ PASS / FAIL

### Overall Admin Page Status
```
RESULT: _____________________
ISSUES FOUND: _____ (count)
BLOCKERS: _____ (count)
RECOMMENDATION: ____________
TESTER: _____ DATE: _____
```

---

## Known Issues (As of 2026-05-16)

These are EXPECTED to fail before responsive fixes:

```
✗ Stat cards show 6 columns on mobile (cramped)
✗ Quick links show 3 columns on mobile (cramped)
✗ Resident cards show 3 columns on mobile (cramped)
✗ Staff table shows all columns on mobile (horizontal scroll needed)
✗ Staff detail shows Contact/Employment side-by-side on mobile
✗ Face sheet grids show 3-4 columns on mobile (cramped)
✗ Modal min width 680px (too wide for 375px phones)
```

After responsive fixes applied, all above should show correct column counts per breakpoint.

---

## Browser Testing Checklist

```
[ ] Chrome (latest)
[ ] Chrome Mobile (DevTools)
[ ] Firefox (latest)
[ ] Safari (latest)
[ ] Safari Mobile (iOS) - if available
[ ] Edge (latest)
```

---

## Sign-Off

Test completed by: _________________  
Date: _________________  
Status: ☐ PASS   ☐ FAIL   ☐ PASS WITH MINOR ISSUES  

Notes:
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

Approved by: _________________  
Date: _________________
