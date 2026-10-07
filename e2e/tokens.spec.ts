import { expect, test } from '@playwright/test';

test('design tokens reach the page in both themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stowline' })).toBeVisible();

  const token = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  expect(await token('--bg')).toBe('#0b1220');
  expect(await bodyBg()).toBe('rgb(11, 18, 32)');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  expect(await token('--bg')).toBe('#edf1f6');
  expect(await bodyBg()).toBe('rgb(237, 241, 246)');
  expect(await token('--pod-nlrtm')).toBe('#009e73');
});
