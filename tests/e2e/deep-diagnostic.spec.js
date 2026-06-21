import { test } from '@playwright/test';

test('Deep diagnostic - check API response and data', async ({ page }) => {
  const baseURL = 'http://localhost:3000';
  const adminEmail = 'admin@dependablecare.org';
  const adminPassword = 'Admin@DC2026!';

  console.log('\n' + '='.repeat(80));
  console.log('DEEP DIAGNOSTIC TEST');
  console.log('='.repeat(80) + '\n');

  // 1. Login
  console.log('1️⃣ LOGGING IN');
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);

  const loginButton = page.locator('button:has-text("Login")').first();
  await loginButton.click();

  await page.waitForLoadState('networkidle');
  console.log('✓ Logged in\n');

  // 2. Get auth token from localStorage
  console.log('2️⃣ CHECKING AUTH');
  const authData = await page.evaluate(() => {
    const auth = localStorage.getItem('dcllc_auth');
    return {
      hasAuth: !!auth,
      auth: auth ? JSON.parse(auth) : null,
    };
  });

  console.log(`✓ Auth token exists: ${authData.hasAuth}`);
  if (authData.auth) {
    console.log(`  - User role: ${authData.auth.user?.role}`);
    console.log(`  - Token length: ${authData.auth.accessToken?.length || 0} chars`);
  }
  console.log('');

  // 3. Test API endpoints directly with logging
  console.log('3️⃣ TESTING API ENDPOINTS');

  const endpoints = [
    '/api/v1/daily-progress-notes',
    '/api/v1/daily-progress-notes?status=approved',
    '/api/v1/admin/forms-history/daily-progress-notes',
    '/api/v1/admin/forms-history/daily-progress-notes?limit=100',
  ];

  const token = authData.auth?.accessToken;

  for (const endpoint of endpoints) {
    try {
      const response = await page.evaluate(
        async ({ url, authToken }) => {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          const textData = await res.text();
          let jsonData = null;
          try {
            jsonData = JSON.parse(textData);
          } catch (e) {
            // Not JSON
          }

          return {
            status: res.status,
            ok: res.ok,
            contentType: res.headers.get('content-type'),
            dataSize: textData.length,
            jsonData: jsonData,
          };
        },
        {
          url: `${baseURL}${endpoint}`,
          authToken: token
        }
      );

      const icon = response.ok ? '✓' : '✗';
      console.log(`${icon} ${response.status} ${endpoint}`);
      console.log(`  Content-Type: ${response.contentType}`);
      console.log(`  Response size: ${response.dataSize} bytes`);

      if (response.jsonData) {
        const count = response.jsonData.data?.length || 0;
        const total = response.jsonData.total || 0;
        console.log(`  Data items: ${count}, Total: ${total}`);

        if (count > 0) {
          console.log(`  First item:`, JSON.stringify(response.jsonData.data[0]).substring(0, 150));
        }
      }
      console.log('');
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`);
      console.log('');
    }
  }

  // 4. Navigate to reports page and check what loads
  console.log('4️⃣ NAVIGATING TO REPORTS PAGE');
  await page.goto(`${baseURL}/admin/reports/daily_progress_notes`);
  await page.waitForLoadState('networkidle');

  console.log(`Current URL: ${page.url()}`);
  console.log('');

  // 5. Check what fetch calls the page makes
  console.log('5️⃣ MONITORING PAGE FETCH CALLS');

  const fetchCalls = [];
  const originalFetch = await page.evaluate(() => {
    return window.fetch.toString();
  });

  // Listen for network activity
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      fetchCalls.push({
        url: response.url().substring(baseURL.length),
        status: response.status,
      });
    }
  });

  // Trigger the page data load
  console.log('Reloading page to capture fetch calls...');
  await page.reload();
  await page.waitForLoadState('networkidle');

  console.log(`Fetch calls captured: ${fetchCalls.length}`);
  fetchCalls.forEach((call, i) => {
    console.log(`  ${i + 1}. ${call.status} ${call.url}`);
  });
  console.log('');

  // 6. Check the DOM for data
  console.log('6️⃣ CHECKING PAGE DOM');

  const pageStats = await page.evaluate(() => {
    return {
      title: document.title,
      h1Text: document.querySelector('h1')?.textContent,
      filterVisible: !!document.querySelector('text=Filter Forms'),
      tableHeaders: Array.from(document.querySelectorAll('[style*="grid"]'))
        .map(el => el.textContent)
        .filter(t => t && t.length < 50),
      gridDivs: document.querySelectorAll('[style*="grid"]').length,
      hasNoFormsMsg: document.body.textContent.includes('No forms found'),
      allText: document.body.innerText.substring(0, 500),
    };
  });

  console.log(`Page title: ${pageStats.title}`);
  console.log(`H1 text: ${pageStats.h1Text}`);
  console.log(`Grid divs found: ${pageStats.gridDivs}`);
  console.log(`Has "No forms found": ${pageStats.hasNoFormsMsg}`);
  console.log('');

  // 7. Check database directly via API
  console.log('7️⃣ QUERYING DATABASE STATUS');

  try {
    const dbCheck = await page.evaluate(async ({ url, authToken }) => {
      // Try to get ANY daily progress notes, not filtered
      const res = await fetch(`${url}/api/v1/daily-progress-notes?limit=500`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      if (!res.ok) {
        return { status: res.status, error: 'Not OK' };
      }

      const data = await res.json();
      return {
        status: res.status,
        totalCount: data.pagination?.total || data.data?.length || 0,
        items: data.data || [],
        statuses: data.data ? [...new Set(data.data.map(d => d.review_status))] : [],
      };
    }, { url: baseURL, authToken: token });

    console.log(`✓ Database query status: ${dbCheck.status}`);
    console.log(`  Total notes in DB: ${dbCheck.totalCount}`);
    if (dbCheck.items.length > 0) {
      console.log(`  Statuses found: ${dbCheck.statuses.join(', ')}`);
      console.log(`  Sample note: ${JSON.stringify(dbCheck.items[0]).substring(0, 100)}...`);
    }
  } catch (err) {
    console.log(`✗ Database check failed: ${err.message}`);
  }

  console.log('');

  // 8. Final screenshot
  console.log('8️⃣ TAKING SCREENSHOTS');
  await page.screenshot({ path: 'test-results/deep-diagnostic-page.png', fullPage: true });
  console.log('✓ Screenshot saved: test-results/deep-diagnostic-page.png');

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80) + '\n');
});
