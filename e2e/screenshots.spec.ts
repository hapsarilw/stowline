import { expect, test } from '@playwright/test';
import { openPlans, openWorkspace, settle } from './helpers';
import type {} from '../src/features/viewport3d/scene/Picking';

// Screens 01 (workspace, 1440 and 1920, dark and light), 03 (bay view), 04 (violations),
// 05 (stability drawer), 06 (port playback) and 07 (plans list).
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
      await page.getByTestId('viewport-canvas').locator('canvas').waitFor();
      // The 3D canvas is masked here; it has its own screenshot below.
      await expect(page).toHaveScreenshot(`workspace-${size.name}-${theme}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
        mask: [page.getByTestId('viewport-canvas')],
      });
    });
  }
}

for (const theme of ['dark', 'light'] as const) {
  test(`bay view 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    // The Bay tab collapses both side panels itself (screen 03).
    await page.getByRole('tab', { name: 'Bay', exact: true }).click();
    await expect(page).toHaveScreenshot(`bay-view-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
    });
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`3D view 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.getByTestId('viewport-canvas').locator('canvas').waitFor();
    await page.waitForFunction(() => window.__stowViewport !== undefined);
    await settle(page);
    // Headless Chromium draws WebGL in software, so allow small differences.
    await expect(page.getByRole('region', { name: '3D view' })).toHaveScreenshot(
      `viewport3d-1440-${theme}.png`,
      {
        maxDiffPixelRatio: 0.02,
      },
    );
  });
}

// 04, 05, 06. The 3D canvas is masked on the page, and the time of the last check changes.
for (const theme of ['dark', 'light'] as const) {
  test(`violations 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.waitForFunction(() => window.__stowViewport !== undefined);
    await page.getByRole('tab', { name: /^Violations/ }).click();
    await page.getByRole('button', { name: 'Show error · stack weight at 180488' }).click();
    await expect(page).toHaveScreenshot(`violations-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
      mask: [page.getByTestId('viewport-canvas'), page.getByTestId('violations-summary')],
    });
    // The camera on bay 18, the 4 containers at full color, the banner. After the 600 ms move.
    await settle(page);
    await expect(page.getByRole('region', { name: '3D view' })).toHaveScreenshot(
      `violations-3d-1440-${theme}.png`,
      { maxDiffPixelRatio: 0.02 },
    );
  });

  test(`stability drawer 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.waitForFunction(() => window.__stowViewport !== undefined);
    await page.getByRole('button', { name: 'Stability', exact: true }).click();
    // The drawer lies over the 3D canvas, so it is taken on its own, with the strip below it.
    const drawer = page.getByRole('region', { name: 'Stability details' });
    await expect(drawer).toBeVisible();
    await settle(page);
    await expect(drawer).toHaveScreenshot(`stability-drawer-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
    });
    await expect(page.getByRole('region', { name: 'Stability', exact: true })).toHaveScreenshot(
      `stability-strip-open-1440-${theme}.png`,
      { animations: 'disabled', maxDiffPixelRatio: 0.002 },
    );
  });

  test(`playback 1440 ${theme}`, async ({ page }) => {
    // Reduced motion: the lift is instant, so the picture does not depend on timing.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.waitForFunction(() => window.__stowViewport !== undefined);
    await page.getByRole('button', { name: 'Playback' }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: /^Jebel Ali/ }).click();
    await settle(page);
    await expect(page).toHaveScreenshot(`playback-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
      mask: [page.getByTestId('viewport-canvas')],
    });
    await expect(page.getByRole('region', { name: '3D view' })).toHaveScreenshot(
      `playback-3d-1440-${theme}.png`,
      { maxDiffPixelRatio: 0.02 },
    );
  });
}

// 07. The "Updated" column is "N min" since the page opened, so it is masked.
for (const theme of ['dark', 'light'] as const) {
  test(`plans list 1440 ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlans(page, theme);
    await expect(
      page
        .getByRole('complementary', { name: 'Plan preview' })
        .getByText('Rina Adiputri validated the plan: 6 errors, 1 warning'),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`plans-1440-${theme}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
      mask: [
        page.getByRole('gridcell').filter({ hasText: /^(\d+ (min|h|d)|Yesterday|Just now|—)$/ }),
      ],
    });
  });
}
