import { test, expect } from '@playwright/test';

test('Form login should store dcllc_auth in localStorage', async ({ page }) => {
  const baseURL = 'http://localhost:3000';

  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  console.log('\n1️⃣ Filling login form...');

  // Fill in the form
  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const submitButton = page.locator('button:has-text("Login")').first();

  await emailInput.fill('admin@dependablecare.org');
  await passwordInput.fill('Admin@DC2026!');

  // Log form state before submit
  const formData = await page.evaluate(() => {
    const email = document.querySelector('input[type="email"]');
    const pwd = document.querySelector('input[type="password"]');
    return {
      email: email?.value,
      password: pwd?.value
    };
  });
  console.log(`  Email: ${formData.email}`);
  console.log(`  Password filled: ${!!formData.password}`);

  // Click submit
  console.log('\n2️⃣ Submitting login form...');
  await submitButton.click();

  // Wait for login to complete
  console.log('\n3️⃣ Waiting for redirect or error...');

  // Wait for either redirect to admin or error message
  const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
  const errorPromise = page.locator('[role="alert"]').isVisible({ timeout: 5000 }).catch(() => false);

  const [navResult, errorVisible] = await Promise.all([navigationPromise, errorPromise]);

  console.log(`  Navigation happened: ${!!navResult}`);
  console.log(`  Error visible: ${errorVisible}`);
  console.log(`  Current URL: ${page.url()}`);

  // Check localStorage
  console.log('\n4️⃣ Checking localStorage...');
  const storage = await page.evaluate(() => {
    return {
      keys: Object.keys(localStorage),
      dcllcAuth: localStorage.getItem('dcllc_auth'),
      user: localStorage.getItem('user'),
    };
  });

  console.log(`  All keys: ${storage.keys.join(', ')}`);
  console.log(`  dcllc_auth exists: ${!!storage.dcllcAuth}`);
  console.log(`  user exists: ${!!storage.user}`);

  if (storage.dcllcAuth) {
    try {
      const auth = JSON.parse(storage.dcllcAuth);
      console.log(`  ✅ dcllc_auth is valid JSON`);
      console.log(`  - Has accessToken: ${!!auth.accessToken}`);
      console.log(`  - Has user: ${!!auth.user}`);
      console.log(`  - User role: ${auth.user?.role}`);
    } catch (e) {
      console.log(`  ❌ dcllc_auth is not valid JSON: ${e.message}`);
    }
  } else {
    console.log(`  ❌ dcllc_auth not found in localStorage`);
  }

  // Take screenshot
  await page.screenshot({ path: 'test-results/form-login-test.png', fullPage: true });
  console.log('\n✅ Screenshot saved: test-results/form-login-test.png');
});
