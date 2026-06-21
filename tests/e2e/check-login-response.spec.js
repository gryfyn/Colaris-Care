import { test } from '@playwright/test';

test('Check login API response directly', async ({ page }) => {
  const baseURL = 'http://localhost:3000';

  console.log('\n📝 CHECKING LOGIN API\n');

  // Navigate to a page first to establish the domain context
  await page.goto(`${baseURL}/login`);

  // Make a login request
  console.log('1. Testing login API endpoint directly...\n');

  const loginResponse = await page.evaluate(
    async ({ url, email, password }) => {
      const response = await fetch(`${url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }

      return {
        status: response.status,
        ok: response.ok,
        data: data,
      };
    },
    {
      url: baseURL,
      email: 'admin@dependablecare.org',
      password: 'Admin@DC2026!'
    }
  );

  console.log(`Status: ${loginResponse.status}`);
  console.log(`OK: ${loginResponse.ok}`);
  console.log(`Response:`, JSON.stringify(loginResponse.data).substring(0, 300));

  if (loginResponse.ok && loginResponse.data.accessToken) {
    console.log('\n✅ Login API is working!');
    console.log(`   - Access token length: ${loginResponse.data.accessToken.length}`);
    console.log(`   - User role: ${loginResponse.data.user?.role}`);
  } else {
    console.log('\n❌ Login API is failing!');
    if (loginResponse.data.error) {
      console.log(`   - Error: ${loginResponse.data.error}`);
    }
  }

  // Now try login via the form
  console.log('\n2. Testing login via form...\n');

  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  const emailInput = page.getByLabel('Email');
  const passwordInput = page.getByRole('textbox', { name: 'Password' });

  await emailInput.fill('admin@dependablecare.org');
  await passwordInput.fill('Admin@DC2026!');

  // Log all network responses
  const responses = [];
  page.on('response', (resp) => {
    responses.push({
      url: resp.url().substring(baseURL.length),
      status: resp.status(),
    });
  });

  const loginButton = page.getByRole('button', { name: /sign in/i });
  await loginButton.click();

  // Wait for navigation or error message
  const errorMsg = page.locator('[role="alert"]');
  const errorVisible = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);

  console.log(`Error message visible: ${errorVisible}`);

  if (errorVisible) {
    const errorText = await errorMsg.textContent();
    console.log(`Error: ${errorText}`);
  }

  // Wait a moment
  await page.waitForLoadState('networkidle');
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // Check localStorage and cookie state for the current auth model
  const storage = await page.evaluate(() => ({
    keys: Object.keys(localStorage),
  }));
  const cookies = await page.context().cookies(baseURL);

  console.log(`\nLocalStorage keys: ${storage.keys.join(', ')}`);
  console.log(`Refresh cookie stored: ${cookies.some((cookie) => cookie.name === 'refresh_token')}`);

  // Log all responses
  console.log(`\nNetwork responses during login:`);
  responses.forEach((r) => {
    console.log(`  ${r.status} ${r.url}`);
  });
});
