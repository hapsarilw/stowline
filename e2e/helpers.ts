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
