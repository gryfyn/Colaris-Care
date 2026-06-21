import { test, expect } from '@playwright/test';

test.describe('Reports Hub Form Display - Real Data Integration', () => {
  const adminUsername = 'admin@test.com';
  const adminPassword = 'AdminPass123!';
  const staffUsername = 'staff1@test.com';
  const staffPassword = 'StaffPass123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });
  });

  test('Reports Hub displays form counts from live APIs', async ({ page }) => {
    // Login as admin first
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Wait for reports hub to load and fetch data
    await page.waitForSelector('[data-testid="form-card-nursing-assessment"]', { timeout: 5000 });

    // Check that form cards are present (not mock data placeholders)
    const nursingAssessmentCard = page.locator('[data-testid="form-card-nursing-assessment"]');
    await expect(nursingAssessmentCard).toBeVisible();

    // Verify form cards show real counts (should be numbers, not placeholder text)
    const formCount = await nursingAssessmentCard.locator('[data-testid="form-count"]').textContent();
    expect(formCount).toMatch(/^\d+$/);

    // Check that all form types are displayed
    const formTypes = [
      'nursing-assessment',
      'pre-screening',
      'advance-directive',
      'daily-progress-notes',
      'care-plans',
      'goals',
      'objectives',
      'evacuation-drills',
      'drug-disposal',
      'incidents',
    ];

    for (const formType of formTypes) {
      const card = page.locator(`[data-testid="form-card-${formType}"]`);
      await expect(card).toBeVisible({ timeout: 5000 });
    }
  });

  test('Reports Hub handles loading and error states correctly', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Wait for loading to complete
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });

    // Verify no error message is displayed
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).not.toBeVisible();

    // Verify form cards are displayed
    await expect(page.locator('[data-testid="form-card-nursing-assessment"]')).toBeVisible();
  });

  test('Submitted nursing assessment appears in Reports Hub with correct data', async ({ page, context }) => {
    // Staff submits a nursing assessment form
    const staffPage = await context.newPage();
    await staffPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await staffPage.fill('input[name="email"]', staffUsername);
    await staffPage.fill('input[name="password"]', staffPassword);
    await staffPage.click('button:has-text("Sign In")');
    await staffPage.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to admission forms
    await staffPage.goto('http://localhost:3000/staff/admission-forms', { waitUntil: 'networkidle' });

    // Start a new nursing assessment
    await staffPage.click('button:has-text("New Nursing Assessment")');
    await staffPage.waitForNavigation({ waitUntil: 'networkidle' });

    // Fill Step 1: Demographics
    const residentSelector = staffPage.locator('input[placeholder*="Select Resident"]').first();
    await residentSelector.click();
    const residentOption = staffPage.locator('[role="option"]').first();
    await residentOption.click();

    // Fill required demographics fields
    await staffPage.fill('input[name="first_name"]', 'John');
    await staffPage.fill('input[name="last_name"]', 'TestDemographics');
    await staffPage.fill('input[name="date_of_birth"]', '1950-01-15');
    await staffPage.fill('input[name="mrn"]', 'MRN-TEST-001');
    await staffPage.fill('input[name="admit_date"]', new Date().toISOString().split('T')[0]);

    // Fill remaining step 1 fields
    await staffPage.fill('input[name="gender"]', 'Male');
    await staffPage.fill('input[name="ethnicity"]', 'Caucasian');
    await staffPage.fill('input[name="preferred_language"]', 'English');
    await staffPage.fill('input[name="emergency_contact"]', 'Jane Doe');
    await staffPage.fill('input[name="phone"]', '555-0100');

    // Move to next step
    const nextButton = staffPage.locator('button:has-text("Next")').first();
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await staffPage.waitForTimeout(500);

    // Fill Step 2: Vital Signs
    await staffPage.fill('input[name="temperature"]', '98.6');
    await staffPage.fill('input[name="blood_pressure_systolic"]', '120');
    await staffPage.fill('input[name="blood_pressure_diastolic"]', '80');
    await staffPage.fill('input[name="heart_rate"]', '72');
    await staffPage.fill('input[name="respiratory_rate"]', '16');
    await staffPage.fill('input[name="oxygen_saturation"]', '98');
    await staffPage.fill('input[name="weight"]', '180');
    await staffPage.fill('textarea[name="allergies"]', 'Penicillin');

    // Continue through remaining steps (just fill minimally to complete)
    for (let step = 3; step <= 7; step++) {
      const nextBtn = staffPage.locator('button:has-text("Next"):first');
      const isEnabled = await nextBtn.isEnabled();
      if (isEnabled) {
        await nextBtn.click();
        await staffPage.waitForTimeout(300);
      }
    }

    // Submit on final step
    const submitBtn = staffPage.locator('button:has-text("Submit")').first();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for submission success
    await staffPage.waitForSelector('[data-testid="submission-success"]', { timeout: 5000 }).catch(() => null);

    // Now check admin Reports Hub
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Click on nursing assessment form card
    const nursingCard = page.locator('[data-testid="form-card-nursing-assessment"]');
    await nursingCard.click();

    // Wait for forms list to load
    await page.waitForSelector('[data-testid="form-row-"]', { timeout: 5000 }).catch(() => null);

    // Verify submitted form appears in the list
    const submittedForm = page.locator('text=John TestDemographics').first();
    await expect(submittedForm).toBeVisible();

    // Click to view form details
    await submittedForm.click();
    await page.waitForTimeout(500);

    // Verify form data displays exactly as entered
    await expect(page.locator('text=John')).toBeVisible();
    await expect(page.locator('text=TestDemographics')).toBeVisible();
    await expect(page.locator('text=1950-01-15')).toBeVisible();
    await expect(page.locator('text=MRN-TEST-001')).toBeVisible();
    await expect(page.locator('text=Penicillin')).toBeVisible();
    await expect(page.locator('text=98.6')).toBeVisible();
    await expect(page.locator('text=120')).toBeVisible();

    await staffPage.close();
  });

  test('Submitted daily progress note appears in Reports Hub', async ({ page, context }) => {
    // Staff submits a progress note
    const staffPage = await context.newPage();
    await staffPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await staffPage.fill('input[name="email"]', staffUsername);
    await staffPage.fill('input[name="password"]', staffPassword);
    await staffPage.click('button:has-text("Sign In")');
    await staffPage.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to progress notes
    await staffPage.goto('http://localhost:3000/staff/progress-notes', { waitUntil: 'networkidle' });

    // Click to add new progress note
    await staffPage.click('button:has-text("New Progress Note")');
    await staffPage.waitForNavigation({ waitUntil: 'networkidle' });

    // Fill progress note form
    const residentSelect = staffPage.locator('input[placeholder*="Select Resident"]').first();
    await residentSelect.click();
    const residentOption = staffPage.locator('[role="option"]').first();
    await residentOption.click();

    const today = new Date().toISOString().split('T')[0];
    await staffPage.fill('input[name="date"]', today);

    const shiftSelect = staffPage.locator('input[placeholder*="Select Shift"]');
    await shiftSelect.click();
    const shiftOption = staffPage.locator('text=Morning').first();
    await shiftOption.click();

    const notesField = staffPage.locator('textarea[placeholder*="Progress Notes"]');
    await notesField.fill('Patient had good morning. Ate breakfast completely. Participated in activities.');

    // Fill optional fields
    const moodSelect = staffPage.locator('input[placeholder*="Mood"]');
    await moodSelect.click();
    const moodOption = staffPage.locator('text=Happy').first();
    await moodOption.click();

    // Submit
    const submitBtn = staffPage.locator('button:has-text("Submit"):first');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await staffPage.waitForSelector('[data-testid="submission-success"]', { timeout: 5000 }).catch(() => null);

    // Now check admin Reports Hub
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Click on daily progress notes card
    const progressNotesCard = page.locator('[data-testid="form-card-daily-progress-notes"]');
    await progressNotesCard.click();

    // Wait for notes list to load
    await page.waitForSelector('[data-testid="note-row-"]', { timeout: 5000 }).catch(() => null);

    // Verify submitted note appears
    const submittedNote = page.locator('text=good morning').first();
    await expect(submittedNote).toBeVisible();

    // View details
    await submittedNote.click();
    await page.waitForTimeout(500);

    // Verify data displays exactly as entered
    await expect(page.locator('text=good morning')).toBeVisible();
    await expect(page.locator('text=Ate breakfast completely')).toBeVisible();
    await expect(page.locator('text=Happy')).toBeVisible();

    await staffPage.close();
  });

  test('Reports Hub pagination works correctly with multiple forms', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Click on a form type with multiple entries
    const nursingCard = page.locator('[data-testid="form-card-nursing-assessment"]');
    await nursingCard.click();

    // Wait for forms list
    await page.waitForSelector('[data-testid="form-row-"]', { timeout: 5000 });

    // Check for pagination controls
    const paginationContainer = page.locator('[data-testid="pagination"]');
    const hasPagination = await paginationContainer.isVisible().catch(() => false);

    if (hasPagination) {
      // Verify next/previous buttons are present
      const nextBtn = page.locator('button:has-text("Next")');
      const prevBtn = page.locator('button:has-text("Previous")');

      // At least one should exist if pagination is shown
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      const prevVisible = await prevBtn.isVisible().catch(() => false);

      expect(nextVisible || prevVisible).toBeTruthy();
    }

    // Verify we can see form rows
    const firstFormRow = page.locator('[data-testid="form-row-"]').first();
    await expect(firstFormRow).toBeVisible();
  });

  test('Reports Hub displays form filters if available', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Click on a form type
    const nursingCard = page.locator('[data-testid="form-card-nursing-assessment"]');
    await nursingCard.click();

    // Check for filter controls (date range, status, resident, etc.)
    const filterContainer = page.locator('[data-testid="filter-controls"]');
    const hasFilters = await filterContainer.isVisible().catch(() => false);

    if (hasFilters) {
      // Verify common filter fields exist
      const dateFilter = page.locator('input[placeholder*="date"], input[placeholder*="Date"]');
      const statusFilter = page.locator('select[name*="status"], input[placeholder*="status"]');

      const hasDateFilter = await dateFilter.isVisible().catch(() => false);
      const hasStatusFilter = await statusFilter.isVisible().catch(() => false);

      // At least one filter should be present
      expect(hasDateFilter || hasStatusFilter).toBeTruthy();
    }
  });

  test('Closed modal returns to reports hub list', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', adminUsername);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button:has-text("Sign In")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Navigate to Reports Hub
    await page.goto('http://localhost:3000/admin/reports', { waitUntil: 'networkidle' });

    // Click on a form type
    const nursingCard = page.locator('[data-testid="form-card-nursing-assessment"]');
    await nursingCard.click();

    // Wait for forms list
    await page.waitForSelector('[data-testid="form-row-"]', { timeout: 5000 });

    // Click first form to open modal
    const firstFormRow = page.locator('[data-testid="form-row-"]').first();
    await firstFormRow.click();

    // Wait for modal
    await page.waitForSelector('[data-testid="form-detail-modal"]', { timeout: 3000 }).catch(() => null);

    // Close modal
    const closeBtn = page.locator('button[aria-label="Close"]');
    const closeVisible = await closeBtn.isVisible().catch(() => false);

    if (closeVisible) {
      await closeBtn.click();
    } else {
      // Try pressing Escape
      await page.press('body', 'Escape');
    }

    // Verify we're back to form list
    await expect(firstFormRow).toBeVisible();
  });
});
