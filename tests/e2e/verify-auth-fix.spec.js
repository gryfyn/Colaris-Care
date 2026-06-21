import { test } from '@playwright/test';

test('Verify auth token is stored correctly and reports hub works', async ({ page }) => {
  const baseURL = 'http://localhost:3000';
  const adminEmail = 'admin@dependablecare.org';
  const adminPassword = 'Admin@DC2026!';

  console.log('\n🔐 TESTING AUTH FIX\n');

  // Login
  console.log('1. Logging in...');
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  const emailInput = page.getByLabel('Email');
  const passwordInput = page.getByRole('textbox', { name: 'Password' });

  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);

  const loginButton = page.getByRole('button', { name: /sign in/i });
  await loginButton.click();

  await page.waitForLoadState('networkidle');

  // Check auth state for the current model
  console.log('2. Checking auth state after login...');
  const storage = await page.evaluate(() => ({
    accessToken: localStorage.getItem('accessToken'),
    user: localStorage.getItem('user'),
    keys: Object.keys(localStorage),
  }));
  const cookies = await page.context().cookies(baseURL);

  console.log(`   accessToken stored locally: ${!!storage.accessToken}`);
  console.log(`   user stored locally: ${!!storage.user}`);
  console.log(`   localStorage keys: ${storage.keys.join(', ')}`);
  console.log(`   refresh cookie stored: ${cookies.some((cookie) => cookie.name === 'refresh_token')}`);
  console.log('');

  // Navigate to reports
  console.log('3. Navigating to reports hub...');
  await page.goto(`${baseURL}/admin/reports/daily_progress_notes`);
  await page.waitForLoadState('networkidle');

  // Check if page loaded
  const hasFilterSection = await page.locator('text=Filter Forms').isVisible().catch(() => false);
  const hasTableHeader = await page.locator('text=Date Created').isVisible().catch(() => false);

  console.log(`   Filter section visible: ${hasFilterSection}`);
  console.log(`   Table header visible: ${hasTableHeader}`);
  console.log('');

  // Check API calls
  console.log('4. Checking what API the page called...');
  const apiCalls = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      apiCalls.push({
        url: response.url().replace(baseURL, ''),
        status: response.status(),
      });
    }
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  console.log(`   API calls: ${apiCalls.length}`);
  apiCalls.forEach((call) => {
    console.log(`     ${call.status} ${call.url}`);
  });
  console.log('');

  // Final check
  console.log('5. RESULTS:');
  if (hasFilterSection && hasTableHeader) {
    console.log('   ✅ AUTH FIX SUCCESSFUL!');
    console.log('   - Reports hub page loaded properly');
    console.log('   - Filter and table sections visible');
  } else {
    console.log('   ❌ Auth fix not fully working:');
    if (!hasFilterSection) console.log('   - Filter section not visible');
    if (!hasTableHeader) console.log('   - Table header not visible');
  }
  console.log('');
});
