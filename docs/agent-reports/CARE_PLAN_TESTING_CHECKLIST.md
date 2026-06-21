# Care Plan Refactoring - Testing Checklist

## Automated Tests
- [ ] Run `npm test -- src/__tests__/care-plan/care-plan-refactor.test.js`
  - Verify all API integration tests pass
  - Verify workflow validation tests pass
  - Verify field mapping tests pass
  - Check error handling scenarios

## Manual Testing - Resident Search

### Search Functionality
- [ ] Type 1 character in search box
  - Expected: Shows message "Type at least 2 characters to search"
  - Result: ______
  
- [ ] Type 2+ characters (e.g., "Thompson")
  - Expected: Shows "Searching..." state
  - Expected: API call completes and shows results
  - Result: ______
  
- [ ] Clear search and type different name
  - Expected: Results update
  - Result: ______
  
- [ ] Search with no results
  - Expected: Shows "No residents found" message
  - Result: ______

### Error Handling
- [ ] Simulate API failure (disconnect network)
  - Expected: Shows error message "Failed to search residents"
  - Expected: Can clear and retry
  - Result: ______

## Manual Testing - Resident Selection & Data Loading

### Select Resident
- [ ] Click on a resident from search results
  - Expected: Search dropdown closes
  - Expected: Resident card appears below search box with:
    - Resident name
    - Diagnosis
    - Intake date
    - "✓ Resident selected" checkmark
  - Result: ______

### Care Plan Data Loading
- [ ] Select a resident with existing care plan
  - Expected: "Loading existing care plan data..." message appears briefly
  - Expected: Form fields pre-populate with existing data
  - Expected: loadingExisting state goes from true → false
  - Result: ______

- [ ] Select a resident with NO existing care plan
  - Expected: No error message
  - Expected: Form starts empty (all fields editable)
  - Expected: existingData is null
  - Result: ______

### Clear Resident Selection
- [ ] Click "✕ Clear" button
  - Expected: Resident card disappears
  - Expected: Search input becomes enabled
  - Expected: Form resets
  - Expected: existingData is cleared
  - Result: ______

## Manual Testing - Readonly Fields (Step 1)

### Pre-populated Fields
- [ ] Select resident with existing care plan
  - Check: repLastName field
    - Expected: Input shows value (if exists in plan)
    - Expected: Background color is grayed (#f0f5ff)
    - Expected: readOnly={true} prevents editing
    - Attempt edit: Should not allow changes
  - Result: ______

- [ ] Check other pre-populated fields:
  - [ ] repFirstName: readOnly if data exists
  - [ ] repPhone: readOnly if data exists
  - [ ] repEmail: readOnly if data exists
  - [ ] repContactTimes: readOnly if data exists
  - [ ] repAddress: readOnly if data exists
  - [ ] repCityStateZip: readOnly if data exists

### Empty/Editable Fields
- [ ] Fields without existing data should be:
  - [ ] editable (readOnly={false})
  - [ ] normal white background
  - [ ] allow user input
  - Result: ______

## Manual Testing - Resident Details Display

### Auto-Populated Fields (Step 1)
- [ ] Full Name
  - Expected: Shows as "{first_name} {last_name}"
  - Expected: Has AUTO badge (blue background)
  - Expected: Not editable
  - Result: ______

- [ ] Medicaid ID
  - Expected: Shows resident's medicaid_id from API
  - Expected: Has AUTO badge
  - Result: ______

- [ ] Primary Diagnosis
  - Expected: Shows resident's primary_diagnosis from API
  - Expected: Has AUTO badge
  - Result: ______

- [ ] Date of Admission
  - Expected: Shows resident's intake_date (formatted as YYYY-MM-DD)
  - Expected: Has AUTO badge
  - Result: ______

- [ ] Status
  - Expected: Shows resident's status (Admitted, Pending, etc.)
  - Expected: Has AUTO badge
  - Result: ______

## Manual Testing - Form Validation & Saving

### Step Navigation
- [ ] Complete Step 1 fields:
  - [ ] planType: Select "Initial Care Plan" or "Annual Update"
  - [ ] effectiveDate: Enter date
  - [ ] reviewSchedule: Select frequency
  - [ ] Any rep_* fields as needed
  - Result: ______

- [ ] Click "Save & Continue →" button
  - Expected: Button shows "Saving..." state
  - Expected: API call to `/api/v1/care-plans-wizard` succeeds
  - Expected: Progress to Step 2
  - Expected: Sidebar shows Step 1 as completed (✓ checkmark)
  - Result: ______

### Draft Saving
- [ ] Fill in partial form data
  - [ ] Click "Save Draft" button
  - Expected: Shows "Draft Saved" notification
  - Expected: Data persists if page is refreshed
  - Result: ______

## Manual Testing - All Steps Data Pre-population

### Step 2: Care Planning Team
- [ ] Select resident with existing care plan
  - [ ] Check cmhpLast, cmhpOrg fields
  - Expected: Values pre-populate if they exist in plan
  - Expected: readOnly=true if data exists
  - Result: ______

### Step 3: Core Assessment
- [ ] Verify selectedDomains are pre-checked if exist
  - Expected: Checkboxes match existing data
  - Expected: Message shows "Existing domains are pre-selected"
  - Result: ______

### Step 4: Recovery Goals
- [ ] Verify goal1_statement, goal2_statement, goal3_statement pre-populate
  - Expected: Goal text appears in Goal blocks
  - Expected: Message shows "Goals from previous care plan are below"
  - Result: ______

### Step 5: Safety & Risk Plan
- [ ] Verify crisis_warning_signs, suicide_protocol pre-populate
  - Expected: Values appear in textareas
  - Expected: Message shows "Safety protocols from previous care plan are pre-populated"
  - Result: ______

### Step 6: Community & Discharge
- [ ] Verify discharge_housing, discharge_target_date pre-populate
  - Expected: Values appear in form fields
  - Expected: Message shows "Discharge planning from previous care plan is pre-populated"
  - Result: ______

### Step 7: Legal & Signatures
- [ ] Verify guardianship, advanced_directive pre-populate
  - Expected: Values appear in form fields
  - Expected: Message shows "Legal information from previous care plan is pre-populated"
  - Result: ______

## Edge Cases

### Network Issues
- [ ] Simulate slow network
  - Expected: Loading indicators appear
  - Expected: UI remains responsive
  - Result: ______

- [ ] Simulate network failure
  - Expected: Error messages display
  - Expected: User can retry or clear selection
  - Result: ______

### Data Edge Cases
- [ ] Search with special characters
  - Expected: API handles safely (XSS protected)
  - Result: ______

- [ ] Resident with null/undefined fields
  - Expected: Component handles gracefully (no crashes)
  - Expected: Shows "N/A" or empty string appropriately
  - Result: ______

- [ ] Empty care plan (all null fields)
  - Expected: All form fields remain editable
  - Expected: No errors in console
  - Result: ______

- [ ] Very large text in existing data
  - Expected: Textarea and input fields display correctly
  - Expected: No layout breaking
  - Result: ______

## Browser Compatibility
- [ ] Test on Chrome/Chromium
  - Result: ______
  
- [ ] Test on Firefox
  - Result: ______
  
- [ ] Test on Safari
  - Result: ______

## Mobile Responsiveness
- [ ] Test on mobile view (< 480px)
  - [ ] Search dropdown opens correctly
  - [ ] Resident card displays properly
  - [ ] Form fields are accessible
  - [ ] Buttons are clickable
  - Result: ______

- [ ] Test on tablet view (480px - 768px)
  - [ ] Layout adjusts appropriately
  - [ ] All elements visible without horizontal scroll
  - Result: ______

## Accessibility
- [ ] Navigate using Tab key
  - Expected: Focus moves through all interactive elements
  - Result: ______

- [ ] Use screen reader
  - Expected: All labels are announced
  - Expected: Field status (readonly) is conveyed
  - Expected: Loading states are announced
  - Result: ______

## Performance
- [ ] Search for resident
  - Expected: Results return within 1-2 seconds
  - Result: ______

- [ ] Select resident and load care plan
  - Expected: Pre-population completes within 1-2 seconds
  - Result: ______

- [ ] Scroll through long form
  - Expected: Smooth scrolling (no jank)
  - Result: ______

## Console & Debugging
- [ ] Open browser DevTools console
  - Expected: No error messages
  - Expected: No warnings (except expected warnings)
  - Result: ______

- [ ] Check Network tab
  - Expected: API calls go to correct endpoints
  - Expected: Requests include proper auth headers
  - Expected: Response status is 200 OK
  - Result: ______

## Sign-off

- **Tested By**: ________________
- **Date**: ________________
- **Overall Status**: ☐ PASS ☐ FAIL
- **Comments**: ________________________________________________________________

---

## Quick Test Script (for developer)

```javascript
// Paste in browser console while on care-plan page to verify key functionality

// 1. Check PatientSearch API integration
const testSearch = async () => {
  const response = await fetch('/api/v1/admin/residents?search=Thompson&limit=50');
  console.log('Search API Response:', await response.json());
};

// 2. Check Care Plan Loading
const testCarePlanLoad = async (residentId) => {
  const response = await fetch(`/api/v1/residents/${residentId}/care-plans`);
  console.log('Care Plan API Response:', await response.json());
};

// 3. Verify form data pre-population
const checkFormState = () => {
  console.log('Form State:', {
    existingData: window._existingData, // Not directly accessible, but can be checked via React DevTools
    formData: window._formData // Not directly accessible, but can be checked via React DevTools
  });
};

// Run tests
testSearch();
```
