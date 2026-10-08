import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, wait3D } from './helpers';

// NFR-16, NFR-17: the workspace survives a 3D view that fails in each way it can, and unsaved
// work survives a tab that is closed without warning. NFR-18 (a message with Retry for every
// failed request) is in plans-workflow.spec.ts and m6-states.spec.ts.

const planned = (page: Page) => page.getByText(/[\d,]+ \/ 1,240 planned/);

/** The fallback is shown, and placement still works in the bay grid with the keyboard. */
async function workspaceStillWorks(page: Page) {
  const view = page.getByRole('region', { name: '3D view' });
  await expect(view.getByText('3D view unavailable')).toBeVisible();
  await expect(view.getByText('The 3D view stopped working.', { exact: false })).toBeVisible();
  await expect(planned(page)).toHaveText('312 / 1,240 planned');
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByRole('tab', { name: /^Violations/ })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('the 3D renderer fails while it starts: the error stays inside the 3D view (NFR-17)', async ({
  page,
}) => {
  // WebGL 2 is there (the check passes), but the context on the canvas on screen fails when
  // three.js asks it anything, as a broken GPU driver does. Requests for the 3D code go through
  // the mock API's service worker, which page.route cannot see, so a failed import is covered by
  // Viewport3D.test.tsx instead: it reaches the same error boundary.
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype;
    const real = Object.getOwnPropertyDescriptor(proto, 'getContext')!.value as (
      ...a: unknown[]
    ) => object | null;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = real.call(this, type, ...rest);
      if (!this.isConnected || type !== 'webgl2' || !ctx) return ctx;
      return new Proxy(ctx, {
        get(target, key) {
          if (key === 'getParameter' || key === 'getShaderPrecisionFormat')
            return () => {
              throw new Error('GPU driver failed');
            };
          const v = Reflect.get(target, key) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    } as typeof proto.getContext;
  });
  await openWorkspace(page);
  await workspaceStillWorks(page);
});

test('the WebGL context is lost: the 3D view says so and the workspace keeps working (NFR-17)', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid=viewport-canvas] canvas',
    );
    canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await workspaceStillWorks(page);
});

test('unsaved work survives a tab that is closed without warning (NFR-16)', async ({ page }) => {
  await openWorkspace(page);
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
  // As a crash: no unload handlers run.
  const context = page.context();
  await page.close({ runBeforeUnload: false });
  const again = await context.newPage();
  await again.setViewportSize({ width: 1440, height: 900 });
  await again.goto('/plans/042W-SGSIN');
  await again.getByRole('heading', { name: 'Load list' }).waitFor();
  await expect(
    again
      .getByRole('status')
      .filter({ has: again.getByRole('button', { name: 'Dismiss' }) })
      .filter({ hasText: 'Unsaved changes restored' }),
  ).toContainText('1 change from your last session is back. Save to keep it.');
  await expect(again.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
});
