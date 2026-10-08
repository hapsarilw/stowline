import { expect, type Page } from '@playwright/test';
import type {} from '../src/features/viewport3d/scene/Picking';

/** Opens the workspace in a theme and waits until the fonts and the layout are ready. */
export async function openWorkspace(page: Page, theme: 'dark' | 'light' = 'dark') {
  // Only when nothing is saved yet, so a reload keeps the choice the test made.
  await page.addInitScript((t) => {
    if (!localStorage.getItem('stowline.theme')) localStorage.setItem('stowline.theme', t);
  }, theme);
  await page.goto('/plans/042W-SGSIN');
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Waits until the 3D view has loaded its scene (dev builds expose a test hook then). */
export async function wait3D(page: Page) {
  await page.getByTestId('viewport-canvas').locator('canvas').waitFor();
  await page.waitForFunction(() => '__stowViewport' in window, null, { timeout: 30_000 });
}

/** Opens the plans list in a theme, with the 12 voyages loaded from the mock API. */
export async function openPlans(page: Page, theme: 'dark' | 'light' = 'dark') {
  await page.addInitScript((t) => {
    if (!localStorage.getItem('stowline.theme')) localStorage.setItem('stowline.theme', t);
  }, theme);
  await page.goto('/plans');
  await page.getByRole('heading', { name: 'Stowage plans' }).waitFor();
  await page.getByRole('row', { name: /MV Nusantara Pioneer/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** Opens the plan from the list, as a person does. */
export async function openPlanFromList(page: Page, name: RegExp = /MV Nusantara Pioneer/) {
  await page.getByRole('row', { name }).click();
  await page.getByRole('button', { name: 'Open plan' }).click();
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
}

/** Switches the role in the account menu. */
export async function switchRole(page: Page, label: string) {
  await page.getByRole('button', { name: /^Account:/ }).click();
  const item = page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) });
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Account' })).toHaveCount(0);
}

/** 10 rows, 3 of them invalid: a weight of 80 t, an unknown type, and a POD at the port itself. */
export function loadListFile(prefix = 9000): { name: string; mimeType: string; buffer: Buffer } {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `NSPU ${prefix + i}0 1`.replace(/^NSPU (\d{4})0 1$/, (_m, d: string) => `NSPU ${d}00 1`),
    type: '40GP',
    weightT: 8,
    pod: 'LKCMB',
  }));
  rows[2] = { ...rows[2]!, weightT: 80 };
  rows[5] = { ...rows[5]!, type: 'XX' };
  rows[8] = { ...rows[8]!, pod: 'SGSIN' };
  return {
    name: 'load-list.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)),
  };
}

/**
 * The key that moves focus to the next control. Safari, as shipped, moves Tab between fields only
 * and Option+Tab through every control; a keyboard user there presses Option+Tab (NFR-10).
 */
export function tabKey(browserName: string, shift = false): string {
  const tab = shift ? 'Shift+Tab' : 'Tab';
  return browserName === 'webkit' ? `Alt+${tab}` : tab;
}

/**
 * Lets a test read what the page copies. Chromium uses the real clipboard; Firefox and WebKit
 * have no permission to read it in automation, so the page's writeText is recorded instead.
 */
export async function readCopied(
  page: Page,
  browserName: string,
  copy: () => Promise<void>,
): Promise<string> {
  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await copy();
    return page.evaluate(() => navigator.clipboard.readText());
  }
  await page.evaluate(() => {
    const w = window as unknown as { __copied: string };
    w.__copied = '';
    navigator.clipboard.writeText = (text: string) => {
      w.__copied = text;
      return Promise.resolve();
    };
  });
  await copy();
  return page.evaluate(() => (window as unknown as { __copied: string }).__copied);
}

/**
 * Waits until the page is at rest: no finite CSS animation or transition is running, and the 3D
 * scene (rendered on demand) has drawn no frame for 3 browser frames in a row. Use it before a
 * screenshot or an axe scan, instead of a fixed wait.
 */
export async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let still = 0;
        let last = -1;
        const check = () => {
          const moving = document
            .getAnimations()
            .some(
              (a) =>
                a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity,
            );
          const frames = window.__stowViewport?.frames() ?? 0;
          still = !moving && frames === last ? still + 1 : 0;
          last = frames;
          if (still >= 3) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
  );
}
