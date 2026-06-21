# Complete End-to-End Testing Guide
## Verify All Admin Workflows Capture & Display Data Correctly

**Purpose:** Execute real Playwright tests that verify staff entering progress notes appears in admin dashboard, appointments display with duration, forms autosave correctly, and all data flows end-to-end.

---

## Prerequisites

### 1. Database Test Data Setup
Create test accounts and data needed for Playwright workflows:

```bash
# Option A: Using SQL directly (if you have DB access)
psql -U postgres -d dcllc < scripts/setup-test-data.sql

# Option B: Using your application's DB tool
# Run the SQL from: scripts/setup-test-data.sql
```

**This creates:**
- ✅ Admin account: `admin@test.local` / `TestPassword123!`
- ✅ Staff account: `staff@test.local` / `TestPassword123!`
- ✅ 2 Test residents with assigned staff
- ✅ 2 Progress notes (pending review)
- ✅ 2 Test appointments
- ✅ 1 Test care plan

### 2. Verify Dev Server Running
```bash
# Terminal 1: Start dev server
npm run dev
# Should show: ✓ Ready in XXXms at http://localhost:3000

# Terminal 2: Verify it's up
curl -s http://localhost:3000/login | head -5
# Should return HTML (login page loads)
```

### 3. Update Test Credentials in Test File
If using different passwords, update in `tests/e2e/admin-complete-workflows.spec.js`:

```javascript
const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@test.local',
    password: 'YourActualPassword' // Update this
  },
  staff: {
    email: 'staff@test.local',
    password: 'YourActualPassword' // Update this
  }
};
```

---

## Running Complete E2E Tests

### Execute All Workflows
```bash
# Run all 6 complete end-to-end workflows
npx playwright test tests/e2e/admin-complete-workflows.spec.js --headed

# Or run with verbose output
npx playwright test tests/e2e/admin-complete-workflows.spec.js --headed --reporter=list
```

**What `--headed` does:** Opens browser window so you see the tests execute in real-time. Remove it to run headless (no browser window).

---

## Test Workflows & What They Verify

### ✅ Workflow 1: Progress Notes Data Flow
**Tests:** Staff enters note → Appears in admin dashboard exactly as entered

**Steps:**
1. Staff logs in
2. Staff creates progress note with specific text
3. Staff submits note
4. Admin logs in (separate session)
5. Admin navigates to Progress Notes section
6. **VERIFY:** Exact note content appears with no modifications

**What This Tests:**
- ✅ Form submission captures all data correctly
- ✅ API stores data accurately
- ✅ Admin dashboard retrieves and displays data
- ✅ No data loss or corruption in transit

**Expected Result:** ✅ PASS if note content appears exactly as entered

---

### ✅ Workflow 2: Appointment Duration & Conflict Detection
**Tests:** Appointment displays with duration, conflict detection blocks overlaps

**Steps:**
1. Admin logs in
2. Admin creates appointment for resident at 14:00 for 60 minutes
3. Verify appointment displays with "60 min" duration
4. Try to create overlapping appointment at 14:30
5. **VERIFY:** Conflict error appears preventing double-booking

**What This Tests:**
- ✅ Duration field captured and stored
- ✅ Duration displays correctly in appointments list
- ✅ Conflict detection calculates overlaps accurately
- ✅ User-friendly error message on conflict

**Expected Result:** ✅ PASS if duration displays and conflict is detected

---

### ✅ Workflow 3: Admission Form Multi-Step + Autosave
**Tests:** Form progresses through steps, autosave works, data restores on reload

**Steps:**
1. Navigate to nursing assessment form
2. Verify "Step 1 of 8" progress indicator shows
3. Fill first step with data
4. Observe "Auto-saved" indicator appears
5. Click Next to advance to Step 2
6. Verify progress shows "Step 2 of 8"
7. **Reload page**
8. **VERIFY:** Form data still present, you're still on Step 2

**What This Tests:**
- ✅ Progress indicator displays current step
- ✅ Form autosave captures data every 30 seconds
- ✅ sessionStorage persists data across page reloads
- ✅ Form restoration picks up where user left off

**Expected Result:** ✅ PASS if data persists and step position maintained after reload

---

### ✅ Workflow 4: Care Plan Resident Selector Modal
**Tests:** Clicking "Create Care Plan" shows modal, selecting resident shows confirmation

**Steps:**
1. Admin logs in
2. Navigate to Care Plans section
3. Click "+ New Care Plan" button
4. **VERIFY:** Modal appears with resident dropdown
5. Select a resident from dropdown
6. **VERIFY:** Confirmation appears showing resident name and details
7. Click "Create Plan" to proceed

**What This Tests:**
- ✅ Modal displays resident selector
- ✅ Dropdown populated with actual residents from database
- ✅ Selected resident details display correctly
- ✅ No accidental care plan creation for wrong resident

**Expected Result:** ✅ PASS if modal appears with correct resident data

---

### ✅ Workflow 5: Medication Schedule Matrix Persistence
**Tests:** Medications selected in schedule matrix persist when care plan saved

**Steps:**
1. Navigate to care plan with medications
2. Find medication schedule matrix
3. Select medications for specific time periods (Morning, Afternoon, etc.)
4. Click "Save Care Plan"
5. **Reload page**
6. **VERIFY:** Same medications are still selected in matrix

**What This Tests:**
- ✅ Checkbox selections captured correctly
- ✅ Medication schedule state preserved in care plan
- ✅ Data round-trips through API correctly
- ✅ UI reflects correct persisted state

**Expected Result:** ✅ PASS if medication selections persist after save/reload

---

### ✅ Workflow 6: User-Friendly Error Messages
**Tests:** Form validation errors are helpful, not technical jargon

**Steps:**
1. Navigate to admission form
2. Try to advance to next step without filling required fields
3. **VERIFY:** Error message appears
4. Check message is user-friendly (e.g., "Please enter patient name")
5. NOT technical (e.g., NOT "TypeError: Cannot read property 'name'")

**What This Tests:**
- ✅ Form validation working
- ✅ Error messages are user-friendly
- ✅ Errors guide users to fix problems
- ✅ No technical jargon leaking to users

**Expected Result:** ✅ PASS if error is helpful and non-technical

---

## Expected Test Results

### ✅ All Tests Should PASS
```
✓ Workflow 1: Progress notes appear in admin dashboard
✓ Workflow 2: Appointment duration displays, conflicts detected
✓ Workflow 3: Form multi-step with autosave and restoration
✓ Workflow 4: Care plan resident selector modal works
✓ Workflow 5: Medication selections persist
✓ Workflow 6: Error messages are user-friendly
```

### ⚠️ If Tests Fail: Common Issues & Fixes

**Issue: "Timeout waiting for locator('input[type=email]')"**
- Login page not loading
- **Fix:** Verify dev server is running on port 3000

**Issue: "Test credentials not found"**
- Staff/admin accounts don't exist in database
- **Fix:** Run setup-test-data.sql to create test accounts

**Issue: "Form data not restored after reload"**
- Autosave not working
- **Fix:** Check browser console for sessionStorage errors

**Issue: "Error message contains 'TypeError'"**
- Unhandled exception in form validation
- **Fix:** Check error-messages.js for proper error mapping

---

## What Issues to Document

If tests fail, document:

1. **Data Capture Issues**
   - Example: "Progress note submitted but incomplete content saved"
   - Fix: Check API route is capturing all form fields

2. **Data Display Issues**
   - Example: "Appointment duration not showing in list"
   - Fix: Check admin page is retrieving duration field

3. **Form Workflow Issues**
   - Example: "Form autosave shows timestamp but data not persisted"
   - Fix: Check sessionStorage implementation

4. **Error Handling Issues**
   - Example: "Technical error shown to user instead of friendly message"
   - Fix: Enhance error-messages.js mapping

---

## After Testing: Next Steps

### If All Tests Pass ✅
- System is ready for production
- All workflows validated end-to-end
- Data capture and display working correctly

### If Tests Fail ⚠️
1. Document the exact failure (copy test output)
2. Identify which component failed (form, API, display)
3. Trace the issue:
   - Check browser console for errors
   - Check server logs for API failures
   - Verify database has data
4. Fix the issue
5. Re-run tests to confirm fix

---

## Quick Test Checklist

- [ ] Dev server running (http://localhost:3000)
- [ ] Test database accounts created
- [ ] Database has test residents and data
- [ ] Test credentials updated in test file
- [ ] Run Playwright tests: `npx playwright test tests/e2e/admin-complete-workflows.spec.js --headed`
- [ ] All 6 workflows show ✓ PASS
- [ ] Document any failures and root causes
- [ ] Fix issues (if any)
- [ ] Re-run tests to confirm fixes

---

## Command Reference

```bash
# Start dev server (Terminal 1)
npm run dev

# Run E2E tests with browser visible (Terminal 2)
npx playwright test tests/e2e/admin-complete-workflows.spec.js --headed

# Run single workflow only
npx playwright test tests/e2e/admin-complete-workflows.spec.js --grep "Workflow 1"

# Run tests in headed mode with UI inspector
npx playwright test tests/e2e/admin-complete-workflows.spec.js --headed --debug

# View test results/videos
npx playwright show-report

# Check database test data was created
psql -U postgres -d dcllc -c "SELECT COUNT(*) FROM ref.staff WHERE tenant_id='test-tenant-001';"
```

---

## Success Criteria

✅ **All workflows complete successfully**
- Staff progress notes appear in admin dashboard exactly as entered
- Appointments display with correct duration
- Conflict detection prevents double-booking
- Forms autosave and restore correctly
- Resident selector modal works
- Medication schedules persist
- Error messages are user-friendly

✅ **Data flows end-to-end**
- Data entered in form → Stored in database → Displays in admin
- No data loss, corruption, or modification in transit
- All fields captured and preserved

✅ **System ready for production**
- All admin tasks functioning as designed
- Data integrity verified
- User experience validated

---

## Need Help?

Check test output files in `test-results/` directory:
- `*.png` - Screenshot when test failed
- `*.webm` - Video recording of test execution
- `error-context.md` - Details about failure

These provide visual evidence of what was happening when issue occurred.
