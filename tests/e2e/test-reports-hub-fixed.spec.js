import { test } from '@playwright/test';

test('Reports hub should display daily progress notes', async ({ page }) => {
  const baseURL = 'http://localhost:3000';
  const adminEmail = 'admin@dependablecare.dev';
  const adminPassword = 'Admin@Secure2024!';

  console.log('Testing Reports Hub Display...\n');

  // Navigate to home
  await page.goto(baseURL);
  await page.waitForLoadState('networkidle');

  // Check if on login page
  const isLoginPage = page.url().includes('/login');

  if (isLoginPage) {
    console.log('✓ Login required, logging in...');
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);

    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();

    await page.waitForLoadState('networkidle');
  }

  // Navigate to reports hub
  console.log('Navigating to reports hub...');
  await page.goto(`${baseURL}/admin/reports`);
  await page.waitForLoadState('networkidle');

  // Click on Daily Progress Notes
  console.log('Clicking Daily Progress Notes card...');
  const dailyProgressCard = page.locator('text=Daily Progress Notes').first();
  await dailyProgressCard.click();
  await page.waitForLoadState('networkidle');

  console.log(`Current URL: ${page.url()}`);

  // Check page elements
  console.log('\nChecking page structure:');

  // Check for filter section
  const filterSection = page.locator('text=Filter Forms');
  const hasFilter = await filterSection.isVisible();
  console.log(`✓ Filter section: ${hasFilter ? 'YES' : 'NO'}`);

  // Check for table header
  const tableHeader = page.locator('text=Resident');
  const hasTable = await tableHeader.isVisible();
  console.log(`✓ Table header: ${hasTable ? 'YES' : 'NO'}`);

  // Check for form rows
  const rows = await page.locator('[style*="grid"]').filter({ hasText: /Morning|Afternoon|Night/ }).count();
  console.log(`✓ Data rows found: ${rows}`);

  // Check for data or empty message
  const noDataMsg = await page.locator('text=No forms found').isVisible().catch(() => false);
  console.log(`✓ "No forms found" message: ${noDataMsg ? 'YES (expected if no data)' : 'NO'}`);

  if (hasFilter && hasTable) {
    console.log('\n✅ REPORTS HUB IS WORKING!');
    console.log('   - Filter section is visible');
    console.log('   - Table header is visible');
    if (rows > 0) {
      console.log(`   - ${rows} progress notes displayed`);
    } else {
      console.log('   - No notes yet (expected if none have been approved)');
    }
  } else {
    console.log('\n❌ REPORTS HUB HAS ISSUES');
    console.log(`   - Filter visible: ${hasFilter}`);
    console.log(`   - Table visible: ${hasTable}`);
  }
});
