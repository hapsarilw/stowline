import { expect, test } from '@playwright/test';
import { openWorkspace } from './helpers';

// Screens 01 (workspace, 1440 and 1920, dark and light) and 03 (bay view).
// Baselines are in e2e/screenshots.spec.ts-snapshots, made on the machine in docs/BUILD_NOTES.md.

const sizes = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

for (const size of sizes) {
  for (const theme of ['dark', 'light'] as const) {
    test(`workspace ${size.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openWorkspace(page, theme);
      await expect(page).toHaveScreenshot(`workspace-${size.name}-${theme}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}

for (const theme of ['dark', 'light'] as const) {
  test(`bay view 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.getByRole('button', { name: 'Collapse load list' }).click();
    await page.getByRole('button', { name: 'Collapse panel' }).click();
    await page.getByRole('tab', { name: 'Bay', exact: true }).click();
    await expect(page).toHaveScreenshot(`bay-view-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
    });
  });
}
