import type { Page } from '@playwright/test';

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
  await page.getByRole('radio', { name: new RegExp(`^${label}`) }).click();
  await page.keyboard.press('Escape');
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
