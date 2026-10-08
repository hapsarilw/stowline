import { defineConfig, devices } from '@playwright/test';

// Chromium runs every test. Firefox and WebKit run the ten acceptance scenarios (AT-01 to AT-10,
// NFR-25): the other tests measure Chromium-only things (frame rate, the long task observer,
// per-machine screenshots).
const acceptance = /AT-\d\d/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: acceptance },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: acceptance },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
