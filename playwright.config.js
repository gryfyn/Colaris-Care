import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for admission forms E2E testing.
 * Tests verify form submission and database storage correctness.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false, // Run sequentially to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker for consistent DB state
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});
