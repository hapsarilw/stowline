import { defineConfig, devices } from '@playwright/test';

// Chromium runs every test. Firefox and WebKit run the ten acceptance scenarios (AT-01 to AT-10,
// NFR-25): the other tests measure Chromium-only things (frame rate, the long task observer,
// per-machine screenshots).
const acceptance = /AT-\d\d/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Screenshot baselines are per machine (CLAUDE.md). In CI the tests run every other check,
  // axe included, and skip the picture comparison.
  ignoreSnapshots: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // No trace: recording one for every test (DOM snapshots at each step, with axe scans and the
  // bay grid) made a 16 s test take 15 minutes (M7). A screenshot on failure is cheap.
  use: { baseURL: 'http://localhost:4173', trace: 'off', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: acceptance },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: acceptance },
  ],
  // The production code with test hooks (TEST_HOOKS), built once and served by vite preview. The
  // dev server compiled each module on first request, and four workers opening the workspace at
  // once on a cold server took over 60 s (M7): that was the cause of the flaky starts.
  webServer: {
    command: 'npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
