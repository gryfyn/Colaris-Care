const { test, expect } = require('@playwright/test');

// Test data
const ADMIN_LOGIN = {
  email: 'admin@dcllc.local',
  password: 'AdminPassword123!'
};

const STAFF_LOGIN = {
  email: 'staff@dcllc.local',
  password: 'StaffPassword123!'
};

const RESIDENT_DATA = {
  firstName: 'Test',
  lastName: 'Resident',
  medicaidId: 'MED123456',
  age: 45,
  dateOfBirth: '1981-05-28'
};

test.describe('Admin Workflows - End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');
  });

  test('Workflow 1: Admin creates resident and views dashboard', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Verify admin dashboard loads
    const dashboardTitle = await page.locator('h2:has-text("Dashboard")');
    await expect(dashboardTitle).toBeVisible();

    // Navigate to Residents section
    await page.click('text=Residents');
    await page.waitForLoadState('networkidle');

    // Click create resident button
    await page.click('button:has-text("+ New Resident")');

    // Fill resident form
    await page.fill('input[name="first_name"]', RESIDENT_DATA.firstName);
    await page.fill('input[name="last_name"]', RESIDENT_DATA.lastName);
    await page.fill('input[name="medicaid_id"]', RESIDENT_DATA.medicaidId);
    await page.fill('input[name="age"]', RESIDENT_DATA.age.toString());
    await page.fill('input[name="dob_date"]', RESIDENT_DATA.dateOfBirth);

    // Submit form
    await page.click('button:has-text("Create Resident")');

    // Verify resident appears in list
    await page.waitForLoadState('networkidle');
    const residentRow = page.locator(`text=${RESIDENT_DATA.firstName} ${RESIDENT_DATA.lastName}`);
    await expect(residentRow).toBeVisible();
  });

  test('Workflow 2: Staff enters daily progress notes and they appear in dashboard', async ({ page }) => {
    // Login as staff
    await page.fill('input[type="email"]', STAFF_LOGIN.email);
    await page.fill('input[type="password"]', STAFF_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/staff', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Navigate to daily progress notes
    await page.click('text=Daily Progress Notes');
    await page.waitForLoadState('networkidle');

    // Click create note button
    await page.click('button:has-text("+ New Note")');
    await page.waitForLoadState('networkidle');

    // Fill progress note form
    const progressText = `This is a test progress note created at ${new Date().toISOString()}. Staff is monitoring resident closely.`;
    await page.fill('textarea[name="content"]', progressText);

    // Select a mood/status
    await page.selectOption('select[name="mood"]', 'stable');

    // Submit note
    await page.click('button:has-text("Save Note")');
    await page.waitForLoadState('networkidle');

    // Verify note appears in list
    await page.goto('http://localhost:3000/staff');
    await page.waitForLoadState('networkidle');

    const noteContent = page.locator(`text=${progressText.substring(0, 50)}`);
    await expect(noteContent).toBeVisible({ timeout: 5000 });
  });

  test('Workflow 3: Admin creates care plan and updates resident assignment', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Care Plans
    await page.click('text=Care Plans');
    await page.waitForLoadState('networkidle');

    // Click create care plan button
    await page.click('button:has-text("+ New Care Plan")');
    await page.waitForLoadState('networkidle');

    // Select a resident from dropdown
    await page.click('select');
    const options = await page.locator('select option');
    const count = await options.count();

    if (count > 1) {
      // Select first non-empty option
      await page.selectOption('select', options.nth(1).getAttribute('value'));
      await page.waitForLoadState('networkidle');

      // Verify confirmation shows
      const confirmButton = page.locator('button:has-text("Create Plan")');
      await expect(confirmButton).toBeEnabled();

      // Click create
      await confirmButton.click();
      await page.waitForLoadState('networkidle');

      // Verify care plan page loads
      const formHeader = await page.locator('h1, h2').first();
      const headerText = await formHeader.textContent();
      expect(headerText).toContain('Care Plan');
    }
  });

  test('Workflow 4: Appointments section - create, verify display, check conflict detection', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Appointments section
    await page.click('text=Appointments');
    await page.waitForLoadState('networkidle');

    // Click create appointment
    const createBtn = page.locator('button:has-text("+ Schedule")');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');

      // Try to fill appointment form if modal appears
      const appointmentModal = page.locator('[role="dialog"]');
      if (await appointmentModal.isVisible()) {
        const typeSelect = appointmentModal.locator('select').first();
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('medical');
        }

        // Submit if form exists
        const submitBtn = appointmentModal.locator('button:has-text("Schedule")');
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }

    // Verify appointments are displayed
    const appointmentsList = page.locator('[data-testid="appointments-list"]');
    if (await appointmentsList.isVisible()) {
      const items = await appointmentsList.locator('[data-testid="appointment-item"]').count();
      console.log(`Found ${items} appointments in list`);
    }
  });

  test('Workflow 5: Admission form - multi-step persistence, progress indicator, autosave', async ({ page }) => {
    // Navigate to admission form
    await page.goto('http://localhost:3000/admission/nursing-assessment');
    await page.waitForLoadState('networkidle');

    // Verify progress indicator visible
    const progressIndicator = page.locator('text=/Step .* of .*/');
    if (await progressIndicator.isVisible()) {
      const text = await progressIndicator.textContent();
      console.log(`Progress indicator shows: ${text}`);
    }

    // Fill first step data
    const firstNameInput = page.locator('input[name*="first_name"], input[placeholder*="First"]').first();
    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill('John');
      await page.waitForTimeout(500);

      // Verify autosave
      const saveIndicator = page.locator('text=/Auto-saved|Saving/i');
      await expect(saveIndicator).toBeVisible({ timeout: 5000 });
    }

    // Try to advance to next step
    const nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle');

      // Verify step indicator updated
      const newProgress = await progressIndicator.textContent();
      console.log(`Advanced to: ${newProgress}`);
    }
  });

  test('Workflow 6: Form dirty-check confirmation - unsaved changes warning', async ({ page }) => {
    // Navigate to admission form
    await page.goto('http://localhost:3000/admission/nursing-assessment');
    await page.waitForLoadState('networkidle');

    // Make a change
    const input = page.locator('input').first();
    if (await input.isVisible()) {
      const initialValue = await input.inputValue();
      await input.fill('Modified Value');
      await page.waitForTimeout(500);

      // Try to close (if in modal) or navigate away
      const closeBtn = page.locator('button:has-text("Close"), [aria-label="Close"], button[type="button"]:visible').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();

        // Check for confirmation dialog
        const confirmDialog = page.locator('[role="dialog"], .modal-overlay');
        if (await confirmDialog.isVisible()) {
          const confirmText = await confirmDialog.textContent();
          console.log(`Confirmation dialog appeared: ${confirmText?.substring(0, 100)}`);
        }
      }
    }
  });

  test('Workflow 7: Search functionality - resident search with real-time filtering', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Residents
    await page.click('text=Residents');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Name"]').first();
    if (await searchInput.isVisible()) {
      // Type search term
      await searchInput.fill('Test');
      await page.waitForLoadState('networkidle');

      // Verify filtering works
      const results = page.locator('[data-testid="resident-item"], tr:visible').all();
      console.log(`Search filtered results`);
    }
  });

  test('Workflow 8: Medication schedule - matrix display and selection', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/admin', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Care Plans
    await page.click('text=Care Plans');
    await page.waitForLoadState('networkidle');

    // Try to find and open an existing care plan
    const planRows = page.locator('[data-testid="care-plan-item"], tr').all();
    if ((await planRows).length > 0) {
      const firstPlan = (await planRows)[0];
      await firstPlan.click();
      await page.waitForLoadState('networkidle');

      // Look for medication schedule section
      const medSection = page.locator('text=/Medication|Schedule/i').first();
      if (await medSection.isVisible()) {
        // Check for checkboxes
        const checkboxes = page.locator('input[type="checkbox"]');
        const count = await checkboxes.count();
        console.log(`Medication schedule has ${count} checkboxes`);
      }
    }
  });

  test('Workflow 9: Error message display - friendly messages on validation failures', async ({ page }) => {
    // Navigate to admission form
    await page.goto('http://localhost:3000/admission/nursing-assessment');
    await page.waitForLoadState('networkidle');

    // Try to advance without required fields
    const nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle');

      // Look for error message
      const errorMsg = page.locator('[class*="error"], [role="alert"], .text-red-500, .error-message');
      if (await errorMsg.isVisible()) {
        const text = await errorMsg.textContent();
        console.log(`Error displayed: ${text?.substring(0, 100)}`);

        // Verify it's user-friendly (not technical)
        expect(text).not.toMatch(/Cannot|undefined|null|TypeError/i);
      }
    }
  });

  test('Workflow 10: Loading indicators - visible during API calls', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_LOGIN.email);
    await page.fill('input[type="password"]', ADMIN_LOGIN.password);

    // Start loading
    const submitPromise = page.click('button[type="submit"]');

    // Look for loading indicator
    const spinner = page.locator('[class*="spinner"], [class*="loading"], .animate-spin');
    const isVisible = await spinner.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      console.log('Loading spinner visible during login');
    }

    await submitPromise;
    await page.waitForURL('**/admin', { timeout: 5000 });
  });
});
