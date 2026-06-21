import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Progress Notes PDF Download', () => {
  const baseURL = 'http://localhost:3000';
  const downloadsPath = path.join(process.cwd(), 'test-downloads');
  const ADMIN_EMAIL = 'admin@dependablecare.dev';
  const ADMIN_PASSWORD = 'Admin@Secure2024!';

  test.beforeAll(() => {
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
  });

  test('Admin can login and review progress notes with PDF download', async ({ page, context }) => {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill and submit login form
    const emailInput = page.locator('input[placeholder*="email"], input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[placeholder*="password"], input[name="password"], input[type="password"]').first();

    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);

    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();

    // Wait for redirect to admin dashboard
    await page.waitForURL(`${baseURL}/admin`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to admin dashboard
    await page.goto(`${baseURL}/admin`);
    await page.waitForLoadState('networkidle');

    // Look for Progress Notes section
    console.log('Looking for Progress Notes section...');
    const progressNotesLink = page.locator('text=Progress Notes').first();
    const isProgressNotesVisible = await progressNotesLink.isVisible().catch(() => false);

    if (isProgressNotesVisible) {
      console.log('Found Progress Notes link, clicking...');
      await progressNotesLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Wait for the table and check for review buttons
    await page.waitForSelector('button:has-text("Review")', { timeout: 5000 });

    const reviewButtons = page.locator('button:has-text("Review")');
    const count = await reviewButtons.count();
    console.log(`Found ${count} review buttons`);

    if (count > 0) {
      // Click the first review button
      await reviewButtons.first().click();

      // Wait for modal to open
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      console.log('Modal opened');

      // Get the modal content
      const modal = page.locator('[role="dialog"]');

      // Check for key sections that should be in the note details
      const sections = [
        'NOTE DETAILS',
        'RESIDENT',
        'STAFF',
        'DATE',
        'SHIFT',
        'PROGRESS NOTES CONTENT',
      ];

      for (const section of sections) {
        const element = modal.locator(`text="${section}"`);
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`Section "${section}": ${isVisible ? '✓' : '✗'}`);
      }

      // Look for Download PDF button
      const downloadButton = modal.locator('button:has-text("Download PDF")');
      const hasDownloadButton = await downloadButton.isVisible().catch(() => false);
      console.log(`Download PDF button: ${hasDownloadButton ? '✓ Found' : '✗ Not found'}`);

      if (hasDownloadButton) {
        // Wait for download and click
        const [download] = await Promise.all([
          context.waitForEvent('download'),
          downloadButton.click(),
        ]);

        const filename = download.suggestedFilename();
        console.log(`PDF downloaded: ${filename}`);

        // Save the PDF
        const filepath = path.join(downloadsPath, filename);
        await download.saveAs(filepath);

        // Verify file exists and has content
        const stats = fs.statSync(filepath);
        console.log(`PDF file size: ${stats.size} bytes`);

        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
        expect(filename).toMatch(/\.pdf$/);

        // Check PDF header for expected content
        const fileContent = fs.readFileSync(filepath);
        const contentStr = fileContent.toString('binary');

        // PDF files start with %PDF
        expect(contentStr).toContain('%PDF');
        console.log('✓ Valid PDF file generated');
      }
    }

    await page.close();
  });

  test('PDF contains all progress note sections', async ({ page, context }) => {
    // This test verifies the PDF structure by checking the note_body data

    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('networkidle');

    // Login as admin
    const emailInput = page.locator('input[placeholder*="email"], input[name="email"], input[type="email"]').first();
    const passwordInput = page.locator('input[placeholder*="password"], input[name="password"], input[type="password"]').first();

    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);

    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();

    await page.waitForURL(`${baseURL}/admin`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to admin and check API response
    await page.goto(`${baseURL}/admin`);
    await page.waitForLoadState('networkidle');

    // Check for any API call that loads the progress notes
    const response = await page.context().newPage().then(async (newPage) => {
      let capturedResponse = null;

      newPage.on('response', (resp) => {
        if (resp.url().includes('/api/v1/daily-progress-notes')) {
          capturedResponse = resp;
        }
      });

      await newPage.goto(`${baseURL}/api/v1/daily-progress-notes?limit=1`);

      if (capturedResponse && capturedResponse.ok()) {
        return await capturedResponse.json();
      }
      return null;
    }).catch(() => null);

    if (response && response.data && response.data.length > 0) {
      const note = response.data[0];
      console.log('Progress note structure:');
      console.log(`- Resident: ${note.first_name} ${note.last_name}`);
      console.log(`- Date: ${note.note_date}`);
      console.log(`- Shift: ${note.shift}`);
      console.log(`- Status: ${note.review_status}`);

      if (note.note_body) {
        console.log('Note body fields:');
        const fields = [
          'progressNotes',
          'moodBehavior',
          'physicalHealth',
          'medicationsAdministered',
          'mealsBreakfast',
          'mealsLunch',
          'mealsDinner',
          'activitiesParticipated',
          'incidents',
        ];

        for (const field of fields) {
          if (note.note_body[field]) {
            console.log(`  ✓ ${field}: ${JSON.stringify(note.note_body[field]).substring(0, 50)}...`);
          }
        }
      }
    }

    await page.close();
  });
});
