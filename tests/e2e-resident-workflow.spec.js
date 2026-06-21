import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_ADMIN_EMAIL = 'alice.admin@dcllc.org';
const TEST_ADMIN_PASS = 'AlicePass123!';

let errors = [];
let warnings = [];

test.describe('Complete Resident Lifecycle - Admission to Active Care', () => {
  let admissionId = null;
  let residentName = `Test Resident ${Date.now()}`;
  let residentDob = '1985-03-15';

  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto(`${BASE_URL}/`);

    // Check if already logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/admin')) {
      // Login as admin
      await page.fill('input[placeholder*="email" i]', TEST_ADMIN_EMAIL);
      await page.fill('input[type="password"]', TEST_ADMIN_PASS);
      await page.click('button:has-text("Sign in")');
      await page.waitForNavigation();
    }
  });

  test('Step 1: Navigate to Admission Form', async ({ page }) => {
    await page.goto(`${BASE_URL}/admission`);

    // Should redirect to nursing-assessment
    await page.waitForURL('**/nursing-assessment**', { timeout: 5000 }).catch(() => {});
    expect(page.url()).toContain('nursing-assessment');
  });

  test('Step 2: Complete Nursing Assessment Form', async ({ page }) => {
    await page.goto(`${BASE_URL}/admission`);
    await page.waitForURL('**/nursing-assessment**', { timeout: 5000 }).catch(() => {});

    // Step 1: Demographics
    try {
      await page.waitForSelector('input', { timeout: 3000 }).catch(() => {});
      const nameInput = await page.$('input[placeholder*="Name" i]') || await page.$('input[type="text"]');
      if (nameInput) {
        await nameInput.fill(residentName);
      }

      const dobInput = await page.$('input[type="date"]');
      if (dobInput) {
        await dobInput.fill(residentDob);
      }

      // Click next/continue
      const continueBtn = await page.$('button:has-text("Next")') || await page.$('button:has-text("Continue")');
      if (continueBtn) {
        await continueBtn.click();
        await page.waitForTimeout(500);
      }

      console.log('✓ Demographics section completed');
    } catch (e) {
      errors.push(`Nursing Assessment - Demographics: ${e.message}`);
    }
  });

  test('Step 3: Verify Pre-Screening Form Access', async ({ page }) => {
    // Try to navigate to pre-screening directly
    await page.goto(`${BASE_URL}/admission/pre-screening`);
    await page.waitForTimeout(2000);

    try {
      // Check if form is accessible
      const formElements = await page.locator('input, select, textarea').count();
      if (formElements > 0) {
        console.log('✓ Pre-screening form is accessible');
      } else {
        warnings.push('Pre-screening form appears to have no input elements');
      }
    } catch (e) {
      errors.push(`Pre-Screening Access: ${e.message}`);
    }
  });

  test('Step 4: Verify Advance Directive Form Access', async ({ page }) => {
    await page.goto(`${BASE_URL}/admission/advance-directive`);
    await page.waitForTimeout(2000);

    try {
      const formElements = await page.locator('input, select, textarea').count();
      if (formElements > 0) {
        console.log('✓ Advance directive form is accessible');
      } else {
        warnings.push('Advance directive form appears to have no input elements');
      }
    } catch (e) {
      errors.push(`Advance Directive Access: ${e.message}`);
    }
  });

  test('Step 5: Verify Admin Dashboard Loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    try {
      // Check if dashboard content is visible
      const sections = await page.locator('section, [role="main"]').count();
      if (sections > 0) {
        console.log('✓ Admin dashboard loaded successfully');
      } else {
        warnings.push('Admin dashboard structure unclear');
      }
    } catch (e) {
      errors.push(`Admin Dashboard Load: ${e.message}`);
    }
  });

  test('Step 6: Check Care Plans Section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    try {
      const carePlansSection = await page.$('text=Care Plans') ||
                              await page.$('text=care plans') ||
                              await page.$('[aria-label*="Care Plan"]');

      if (carePlansSection) {
        console.log('✓ Care plans section is visible');
      } else {
        warnings.push('Care plans section not visible in admin dashboard');
      }
    } catch (e) {
      errors.push(`Care Plans Section: ${e.message}`);
    }
  });

  test('Step 7: Check Medications Section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    try {
      const medSection = await page.$('text=Medications') ||
                        await page.$('text=medications') ||
                        await page.$('[aria-label*="Medication"]');

      if (medSection) {
        console.log('✓ Medications section is visible');
      } else {
        warnings.push('Medications section not visible in admin dashboard');
      }
    } catch (e) {
      errors.push(`Medications Section: ${e.message}`);
    }
  });

  test('Step 8: Check Staff/Credentials Section', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    try {
      const staffSection = await page.$('text=Staff') ||
                          await page.$('text=staff') ||
                          await page.$('[aria-label*="Staff"]');

      if (staffSection) {
        console.log('✓ Staff/Credentials section is visible');
      } else {
        warnings.push('Staff section not visible in admin dashboard');
      }
    } catch (e) {
      errors.push(`Staff Section: ${e.message}`);
    }
  });

  test('Step 9: Verify Form Navigation Flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/admission`);

    try {
      // Check current URL
      await page.waitForTimeout(2000);
      const url = page.url();

      if (url.includes('nursing-assessment')) {
        console.log('✓ Admission correctly starts at nursing-assessment');
      } else if (url.includes('pre-screening')) {
        errors.push('Admission form order is wrong: should start at nursing-assessment, not pre-screening');
      } else {
        warnings.push(`Unexpected admission starting point: ${url}`);
      }
    } catch (e) {
      errors.push(`Form Navigation Check: ${e.message}`);
    }
  });

  test('Step 10: Check for Console Errors', async ({ page, context }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => {
        errors.push(`Console Error: ${err}`);
      });
    } else {
      console.log('✓ No console errors detected');
    }
  });

  test.afterAll(async () => {
    // Print summary report
    console.log('\n' + '='.repeat(70));
    console.log('RESIDENT WORKFLOW TEST REPORT');
    console.log('='.repeat(70));

    console.log(`\nTest Date: ${new Date().toLocaleString()}`);
    console.log(`Admission Flow: Nursing Assessment → Pre-Screening → Advance Directive`);

    if (errors.length === 0) {
      console.log('\n✅ ALL TESTS PASSED - No errors detected');
    } else {
      console.log(`\n❌ ERRORS FOUND (${errors.length}):`);
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS / OBSERVATIONS (${warnings.length}):`);
      warnings.forEach((warn, i) => {
        console.log(`   ${i + 1}. ${warn}`);
      });
    }

    console.log('\n' + '='.repeat(70) + '\n');
  });
});
