import { expect, test } from '@playwright/test';
import { openWorkspace } from './helpers';

test('design tokens reach the page in both themes', async ({ page }) => {
  await openWorkspace(page);

  const token = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  expect(await token('--bg')).toBe('#0b1220');
  expect(await bodyBg()).toBe('rgb(11, 18, 32)');

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await token('--bg')).toBe('#edf1f6');
  expect(await bodyBg()).toBe('rgb(237, 241, 246)');
  expect(await token('--pod-nlrtm')).toBe('#009e73');

  // The choice persists across a reload (FR-11).
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bodyBg()).toBe('rgb(237, 241, 246)');
});
