# Form Review Modals - Testing Checklist

## Setup
- Dev server running on `http://localhost:3000`
- Database populated with test data (run: `npm run db:seed`)
- PostgreSQL running
- Redis running

## Test Credentials
After running `npm run db:seed`, use:
- **Email**: `admin@example.com`
- **Password**: `AdminPass123!`
- **Role**: Admin (can review forms)

---

## Test Scenario 1: View Form Review Queue

### Steps
1. ✅ Navigate to `http://localhost:3000/admin`
2. ✅ Login with admin credentials
3. ✅ Scroll down to "Form Review & Approvals" section
4. ✅ You should see 4 tabs:
   - Incident Reports
   - Drug Disposal
   - Evacuation Drills
   - Progress Notes

### Expected Results
- [x] At least one pending form visible (with "pending" status badge in orange/amber)
- [x] Form table shows: Date | Resident / Details | Submitted By | Status | Action
- [x] "Review" button visible for each pending form
- [x] Approved/Rejected forms show appropriate status badges (green/red)

### Issues to Watch
- ⚠️ If no forms show: Database needs data (run `npm run db:seed`)
- ⚠️ If "Review" button doesn't appear: Check form status in database

---

## Test Scenario 2: Open Review Modal

### Steps
1. ✅ Click "Review" button on any pending form
2. ✅ Modal should open with title "Review [Form Type]"

### Expected Results
- [x] Modal opens with dark overlay background
- [x] Modal header is dark navy with white text
- [x] Close button (✕) in top-right corner
- [x] Form title shows form type (e.g., "Review Incident Report")

### Issues to Watch
- ⚠️ Modal doesn't open: Check browser console for errors
- ⚠️ Modal appears off-screen: Browser zoom/resolution issue

---

## Test Scenario 3: Verify Form Fields Display

### Steps
1. ✅ With modal open, examine displayed fields
2. ✅ Fields should be **read-only** (grayed out)
3. ✅ Check form type specific fields:

#### For Incident Report:
- [x] Date
- [x] Incident Types
- [x] Body Areas Injured
- [x] Witnesses
- [x] Follow-up Plan
- [x] Submitted By (auto-filled)
- [x] Resident (auto-filled)

#### For Drug Disposal:
- [x] Date
- [x] Medication Name
- [x] Disposal Method
- [x] Controlled Substance
- [x] Submitted By (auto-filled)
- [x] Resident (auto-filled)

#### For Evacuation Drill:
- [x] Drill Date
- [x] Time
- [x] Time Taken (minutes)
- [x] Residents Present
- [x] Issues Encountered
- [x] Submitted By (auto-filled)
- [x] Resident (auto-filled)

#### For Progress Note:
- [x] Date
- [x] Shift
- [x] Resident Name
- [x] Note
- [x] Submitted By (auto-filled)
- [x] Resident (auto-filled)

### Expected Results
- [x] All fields display with values
- [x] Fields are read-only (cannot edit)
- [x] Values appear in light blue background
- [x] Missing values show "—"

### Issues to Watch
- ⚠️ Fields showing "undefined" or "[object Object]": Data format issue in API
- ⚠️ Fields editable: readOnly prop not applied
- ⚠️ Submitted By is empty: User data not fetched

---

## Test Scenario 4: Review Notes & Submission

### Steps
1. ✅ Scroll to "Review Notes (Optional)" textarea
2. ✅ Type test notes (e.g., "Looks good - approved pending compliance check")
3. ✅ Click "Approve" button
4. ✅ Wait for "Processing..." state
5. ✅ Verify modal closes

### Expected Results
- [x] Notes textarea visible and editable
- [x] Approve button text changes to "Processing..." during submit
- [x] Modal closes after success
- [x] Form list updates, form status changes to "approved" (green badge)
- [x] No error messages appear

### Issues to Watch
- ⚠️ "Processing..." stuck forever: API endpoint not responding
- ⚠️ Error message appears: Check browser console for error details
- ⚠️ Modal doesn't close: Response handling issue
- ⚠️ List doesn't refresh: State update issue

---

## Test Scenario 5: Rejection Flow

### Steps
1. ✅ Click "Review" on another pending form
2. ✅ Type rejection notes (e.g., "Missing witness signature - resubmit")
3. ✅ Click "Reject" button (red button)
4. ✅ Verify modal closes

### Expected Results
- [x] Reject button is red
- [x] After submit, modal closes
- [x] Form status changes to "rejected" (red badge)
- [x] Form no longer shows "Review" button (only approved/pending forms have action buttons)

### Issues to Watch
- ⚠️ Reject button doesn't appear: Check button styling
- ⚠️ Status doesn't change: Database update issue

---

## Test Scenario 6: Error Handling

### Steps
1. ✅ Click "Review" on a pending form
2. ✅ Click "Approve" WITHOUT typing any notes (notes are optional)
3. ✅ Modal should close normally (notes are optional field)

### Expected Results
- [x] Approval succeeds even with no notes
- [x] review_notes field stored as NULL in database

### Issues to Watch
- ⚠️ Error message "Notes required": Schema validation is too strict

---

## Test Scenario 7: Modal Close Button

### Steps
1. ✅ Open any review modal
2. ✅ Click Cancel button
3. ✅ Modal closes WITHOUT submitting

### Expected Results
- [x] Modal closes immediately
- [x] No API call sent
- [x] No status change on form

### Alternative Close Method
1. ✅ Open modal
2. ✅ Click X button in top-right
3. ✅ Modal closes

### Issues to Watch
- ⚠️ Cancel button disabled: Check isLoading prop
- ⚠️ Modal doesn't close: onClose handler issue

---

## Test Scenario 8: Tab Switching

### Steps
1. ✅ On "Form Review & Approvals" section, click "Drug Disposal" tab
2. ✅ Wait for forms list to update
3. ✅ Verify drug disposal forms display
4. ✅ Switch back to "Incident Reports" tab

### Expected Results
- [x] Tab highlights in blue when selected
- [x] Forms list updates when tab changes
- [x] Each tab shows appropriate form type
- [x] Review buttons work on forms in each tab

### Issues to Watch
- ⚠️ Forms don't load: API endpoint not called
- ⚠️ Wrong forms display: Tab logic issue

---

## Browser Developer Tools Checklist

### Network Tab
- [x] PATCH request sent to `/api/v1/[form-type]/[id]/review`
- [x] Request body contains: `{ status: "approved|rejected", notes: "..." }`
- [x] Response status is 200 (success) or appropriate error code
- [x] Response body: `{ status: "approved|rejected", message: "..." }`

### Console Tab
- [x] No red error messages
- [x] No "handleApprove undefined" errors
- [x] No "FORM_SCHEMAS undefined" errors
- [x] No network 404 errors

### React DevTools (if installed)
- [x] ReportsSection component shows correct state
- [x] selectedForm prop properly set when modal opens
- [x] modalError state updates on API errors
- [x] isSubmittingReview toggles during submission

---

## Success Criteria

✅ **Form Review Modals are WORKING if:**
1. Admin can navigate to Form Review section
2. Pending forms display in table
3. Clicking "Review" opens modal with form-type-specific fields
4. Approve/Reject buttons send PATCH requests
5. Modal closes on success
6. Form status updates in the list
7. No errors appear in browser console
8. Database records updated (review_status, reviewed_by, review_notes)

---

## Troubleshooting

### "No forms visible"
```bash
# Seed the database with test data
npm run db:seed

# Verify database has pending forms
psql dependable_care -U dcllc -c "SELECT id, review_status FROM care.incident_reports LIMIT 5;"
```

### "Modal doesn't open"
1. Check browser console (F12 → Console tab)
2. Look for errors in Network tab (F12 → Network)
3. Verify form.id exists in the form object

### "Approve/Reject fails"
1. Check Network tab for PATCH request
2. Look for 401 (auth failed) or 403 (forbidden) errors
3. Verify user is logged in as admin/manager
4. Check response body for error message

### "Fields show [object Object]"
1. Form data likely has nested objects (e.g., witness_list is array)
2. Check `FORM_SCHEMAS` field definitions
3. Verify data transformation in FormReviewModal (line 773)

---

## Notes
- Tests assume database has pending forms with `review_status = 'pending'`
- All form fields are read-only in modal (cannot edit, only review)
- Review notes are optional (can approve/reject without notes)
- Approved/rejected forms can be re-opened but not re-reviewed (Review button gone)
- Audit log entry created for each approval/rejection

