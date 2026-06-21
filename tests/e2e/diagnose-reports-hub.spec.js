import { test, expect } from '@playwright/test';

test.describe('Diagnose Reports Hub Issues', () => {
  const baseURL = 'http://localhost:3000';
  const adminEmail = 'admin@dependablecare.dev';
  const adminPassword = 'Admin@Secure2024!';

  test('Diagnose why reports hub is not displaying data', async ({ page, context }) => {
    console.log('🔍 DIAGNOSTIC TEST: Reports Hub Display Issues\n');

    // Login first
    console.log('1️⃣  LOGGING IN');
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);

    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();

    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    console.log(`   → Logged in, current URL: ${currentUrl}\n`);

    // Navigate to reports hub
    console.log('2️⃣  NAVIGATING TO REPORTS HUB');
    await page.goto(`${baseURL}/admin/reports`);
    await page.waitForLoadState('networkidle');
    console.log(`   → At: ${page.url()}`);

    // Check what's rendered
    const pageContent = await page.content();
    console.log(`   → Page content length: ${pageContent.length} bytes`);

    // Look for reports hub elements
    const hubTitle = await page.locator('h1').first();
    const hubTitleText = await hubTitle.textContent();
    console.log(`   → Page title: "${hubTitleText}"\n`);

    // Check for form type cards
    console.log('3️⃣  CHECKING FORM TYPE CARDS');
    const buttons = await page.locator('button').count();
    console.log(`   → Found ${buttons} buttons on page`);

    const dailyProgressCard = page.locator('text=Daily Progress Notes').first();
    const isCardVisible = await dailyProgressCard.isVisible().catch(() => false);
    console.log(`   → Daily Progress Notes card visible: ${isCardVisible}`);

    if (isCardVisible) {
      console.log('   → Clicking Daily Progress Notes card...');
      await dailyProgressCard.click();
      await page.waitForLoadState('networkidle');
      console.log(`   → Navigated to: ${page.url()}\n`);
    } else {
      console.log('   ⚠️  Daily Progress Notes card not found!\n');
    }

    // Check for API calls
    console.log('4️⃣  INTERCEPTING API CALLS');
    const apiResponses = [];

    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type'],
        });
      }
    });

    // Navigate to daily progress notes report
    console.log('5️⃣  CHECKING DAILY PROGRESS NOTES REPORT PAGE');
    await page.goto(`${baseURL}/admin/reports/daily_progress_notes`);
    await page.waitForLoadState('networkidle');

    // Wait a moment for any API calls
    await page.waitForTimeout(2000);

    console.log(`   → Current URL: ${page.url()}`);
    console.log(`   → API calls captured: ${apiResponses.length}`);
    apiResponses.forEach((resp, i) => {
      console.log(`      ${i + 1}. ${resp.status} ${resp.url.substring(baseURL.length)}`);
    });

    // Check page elements
    console.log('\n6️⃣  ANALYZING PAGE STRUCTURE');

    // Look for filter section
    const filterSection = page.locator('text=Filter Forms');
    const hasFilter = await filterSection.isVisible().catch(() => false);
    console.log(`   → Filter section visible: ${hasFilter}`);

    // Look for table/list
    const tableHeader = page.locator('text=Resident');
    const hasTable = await tableHeader.isVisible().catch(() => false);
    console.log(`   → Table header visible: ${hasTable}`);

    // Look for form rows
    const rows = page.locator('div[style*="grid"]').filter({ hasText: /\d+\/\d+\/\d+/ });
    const rowCount = await rows.count();
    console.log(`   → Form rows found: ${rowCount}`);

    // Look for no data message
    const noDataMsg = page.locator('text=No forms found');
    const hasNoDataMsg = await noDataMsg.isVisible().catch(() => false);
    console.log(`   → "No forms found" message visible: ${hasNoDataMsg}`);

    // Check the actual API endpoint
    console.log('\n7️⃣  TESTING API ENDPOINT DIRECTLY');
    const auth = JSON.parse(localStorage.getItem('dcllc_auth') || '{}');
    const token = auth?.accessToken || '';
    console.log(`   → Token available: ${!!token}`);

    if (token) {
      try {
        const apiUrl = `${baseURL}/api/v1/admin/forms-history/daily_progress_notes?limit=100`;
        console.log(`   → Testing endpoint: /api/v1/admin/forms-history/daily_progress_notes`);

        const response = await page.evaluate(async (url, authToken) => {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            }
          });
          const data = await res.json();
          return {
            status: res.status,
            data: data,
            dataLength: data?.data?.length || 0,
          };
        }, apiUrl, token);

        console.log(`   → API Status: ${response.status}`);
        console.log(`   → Data items returned: ${response.dataLength}`);
        if (response.dataLength > 0) {
          console.log(`   → First item: ${JSON.stringify(response.data.data[0]).substring(0, 100)}...`);
        } else if (response.status === 404) {
          console.log('   ⚠️  ENDPOINT NOT FOUND (404)');
        }
      } catch (err) {
        console.log(`   ❌ Error testing API: ${err.message}`);
      }
    }

    // Check localStorage
    console.log('\n8️⃣  CHECKING LOCAL STORAGE');
    const authData = await page.evaluate(() => {
      return {
        auth: localStorage.getItem('dcllc_auth'),
        user: localStorage.getItem('user'),
      };
    });
    console.log(`   → Auth token stored: ${!!authData.auth}`);
    console.log(`   → User data stored: ${!!authData.user}`);

    // Take screenshot
    console.log('\n9️⃣  SAVING DIAGNOSTIC SCREENSHOT');
    await page.screenshot({ path: 'test-results/reports-hub-diagnostic.png' });
    console.log('   → Screenshot saved to: test-results/reports-hub-diagnostic.png');

    // Check for console errors
    console.log('\n🔟 CHECKING FOR CONSOLE ERRORS');
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Reload page to capture any errors
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    if (errors.length > 0) {
      console.log(`   ⚠️  Found ${errors.length} console errors:`);
      errors.slice(0, 5).forEach((err, i) => {
        console.log(`      ${i + 1}. ${err.substring(0, 100)}`);
      });
    } else {
      console.log('   ✓ No console errors');
    }

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
  });

  test('Check if daily progress notes API endpoint exists', async ({ page }) => {
    console.log('\n🔌 TESTING API ENDPOINTS\n');

    // Login first
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(adminEmail);
    await passwordInput.fill(adminPassword);

    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();

    await page.waitForLoadState('networkidle');

    const endpoints = [
      '/api/v1/daily-progress-notes',
      '/api/v1/daily-progress-notes?status=approved',
      '/api/v1/admin/forms-history/daily_progress_notes',
      '/api/v1/admin/daily-progress-notes',
    ];

    const auth = JSON.parse(localStorage.getItem('dcllc_auth') || '{}');
    const token = auth?.accessToken || '';

    for (const endpoint of endpoints) {
      try {
        const response = await page.evaluate(
          async (url, authToken) => {
            const res = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              }
            });
            return {
              status: res.status,
              ok: res.ok,
              text: await res.text(),
            };
          },
          `${baseURL}${endpoint}`,
          token
        );

        const dataLength = response.text ? response.text.length : 0;
        const icon = response.ok ? '✓' : '✗';
        console.log(`${icon} ${response.status} ${endpoint} (${dataLength} bytes)`);
      } catch (err) {
        console.log(`✗ ERROR ${endpoint}: ${err.message}`);
      }
    }
  });
});
