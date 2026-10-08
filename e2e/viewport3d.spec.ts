import { expect, test, type Page } from '@playwright/test';
import { openWorkspace } from './helpers';
import type {} from '../src/features/bench/BenchPage';
import type {} from '../src/features/viewport3d/scene/Picking';

// FR-18 to FR-24: the 3D view in the browser. Headless Chromium draws WebGL in software,
// so these check behavior, not speed. Speed is measured on /bench with the GPU (BUILD_NOTES).

async function sceneReady(page: Page) {
  await page.getByTestId('viewport-canvas').locator('canvas').waitFor();
  await page.waitForFunction(() => window.__stowViewport !== undefined);
}

test('a click in the 3D view selects the same container in the bay view and the Inspector (FR-22)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await sceneReady(page);
  const target = await page.evaluate(() => window.__stowViewport!.findPickable());
  expect(target).not.toBeNull();
  const { key, id, x, y } = target!;

  // Hover shows the tooltip with the container's ID.
  await page.mouse.move(x, y);
  await expect(page.locator('[data-field="id"]')).toHaveText(id);

  await page.mouse.click(x, y);
  const bay =
    Number(key.slice(0, 2)) % 2 === 0
      ? key.slice(0, 2)
      : String(Number(key.slice(0, 2)) + 1).padStart(2, '0');
  await expect(page.locator('span[aria-live="polite"]', { hasText: /^Bay / })).toHaveText(
    `Bay ${bay}`,
  );
  await expect(page.locator(`#bay-cell-${key}`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').getByText(id, { exact: true })).toBeVisible();
});

test('pointer moves over the 3D view cause no React render (CLAUDE.md "3D view")', async ({
  page,
}) => {
  // A stand-in for the React DevTools hook: React reports every commit to it.
  await page.addInitScript(() => {
    const w = window as unknown as { __commits: number; __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown };
    w.__commits = 0;
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot: () => void w.__commits++,
      onCommitFiberUnmount: () => undefined,
      onPostCommitFiberRoot: () => undefined,
      checkDCE: () => undefined,
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await sceneReady(page);
  const box = (await page.getByTestId('viewport-canvas').boundingBox())!;
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => (window as unknown as { __commits: number }).__commits);
  // Sweep across the ship: the hover outline and the tooltip change many times.
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + 0.6 * (i / 60)), box.y + box.height * 0.55);
  }
  await page.waitForTimeout(300);
  await expect(page.locator('[data-field="id"]')).not.toHaveText('');
  const after = await page.evaluate(() => (window as unknown as { __commits: number }).__commits);
  expect(after - before).toBe(0);
  // Control: the hook does count. A toolbar click renders.
  await page
    .getByRole('toolbar', { name: '3D view controls' })
    .getByRole('button', { name: 'Weight', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __commits: number }).__commits))
    .toBeGreaterThan(after);
});

test('a drag orbits instead of selecting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await sceneReady(page);
  const target = await page.evaluate(() => window.__stowViewport!.findPickable());
  const { x, y } = target!;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByRole('tabpanel').getByText('NSPU 482913 5', { exact: true }),
  ).toBeVisible();
});

test('camera presets, color modes, hull and POD filter all respond (FR-19 to FR-21)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await sceneReady(page);
  const canvas = page.getByTestId('viewport-canvas');
  const shot = () => canvas.screenshot();
  const before = await shot();
  const toolbar = page.getByRole('toolbar', { name: '3D view controls' });
  await toolbar.getByRole('button', { name: 'Top', exact: true }).click();
  await page.waitForTimeout(800);
  const top = await shot();
  expect(top.equals(before)).toBe(false);
  await toolbar.getByRole('button', { name: 'Violations', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Legend: Rule status' })).toContainText('Error6');
  await page.waitForTimeout(100);
  expect((await shot()).equals(top)).toBe(false);
  await page.getByRole('button', { name: /^Hull/ }).click();
  await expect(page.getByRole('button', { name: /^Hull/ })).toContainText('Solid');
  await page.getByRole('combobox', { name: 'Show only containers for port' }).selectOption('LKCMB');
});

test('selecting a bay moves the gap and the bay label (FR-23)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await sceneReady(page);
  await expect(page.getByText('BAY 18', { exact: true })).toBeAttached();
  await page.getByRole('button', { name: /^Bay 42:/ }).click();
  await expect(page.getByText('BAY 42', { exact: true })).toBeAttached();
});

test('AT-08: without WebGL the 3D view offers the bay view, which still works', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype;
    const real = Object.getOwnPropertyDescriptor(proto, 'getContext')!.value as (
      ...a: unknown[]
    ) => unknown;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return real.call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  const view = page.getByRole('region', { name: '3D view' });
  await expect(view.getByText('3D view unavailable')).toBeVisible();
  await expect(view.getByText(/WebGL couldn't start/)).toBeVisible();
  await view.getByRole('button', { name: 'Open bay view' }).click();
  await expect(page.getByRole('tab', { name: 'Bay', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // The bay grid still works with the keyboard.
  const grid = page.getByRole('grid', { name: /cross section/ });
  await grid.focus();
  await page.keyboard.press('ArrowUp');
  // The Bay tab collapses the side panels (screen 03); the Inspector is one click away.
  await page.getByRole('button', { name: 'Expand details panel' }).click();
  await expect(
    page.getByRole('tabpanel').getByText('NSPU 771032 1', { exact: true }),
  ).toBeVisible();
});

test('/bench draws 10,000 containers in under 50 draw calls (NFR-05)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/bench');
  await page.waitForFunction(() => (window.__stowBench?.containers ?? 0) > 0, null, {
    timeout: 60_000,
  });
  const report = await page.evaluate(() => window.__stowBench!);
  expect(report.containers).toBe(10000);
  expect(report.calls).toBeGreaterThan(0);
  expect(report.calls).toBeLessThan(50);
});
