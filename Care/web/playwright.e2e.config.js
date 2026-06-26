import { defineConfig, devices } from '@playwright/test';
import base from './playwright.no-webserver.config.js';

// Config for the extensive E2E suite against a deployed environment.
// Set PLAYWRIGHT_TEST_BASE_URL to the target (defaults to production).
export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  use: {
    ...base.use,
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://colaris-care.vercel.app',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: /(extensive|staff-flows)\.spec\.js/,
    },
  ],
});
