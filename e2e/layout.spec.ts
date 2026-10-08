import { expect, test } from '@playwright/test';
import { openWorkspace } from './helpers';

// FR-06: the layout works at 1440 x 900 and 1920 x 1080. The supported minimum is 1280 x 720.

for (const [width, height] of [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`every top bar control fits at ${width} x ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWorkspace(page);
    const header = page.getByRole('banner');
    expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const name of ['Undo', 'Validate', 'Save', 'Switch to light theme']) {
      const box = await page.getByRole('button', { name: new RegExp(`^${name}`) }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.x + box!.width, name).toBeLessThanOrEqual(width);
    }
    const avatar = await page.getByRole('button', { name: /^Account/ }).boundingBox();
    expect(avatar!.x + avatar!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('the load list scrolls through all 928 rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  const grid = page.getByRole('grid', { name: 'Containers to load' });
  const rendered = () => grid.getByRole('row').count();
  expect(await rendered()).toBeLessThan(60);
  await grid.focus();
  await page.keyboard.press('End');
  await expect(grid.getByRole('row').last()).toHaveAttribute('aria-rowindex', '929');
  expect(await rendered()).toBeLessThan(60);
  await page.keyboard.press('Home');
  await expect(grid.getByRole('row').nth(1)).toHaveAttribute('aria-rowindex', '2');
});

test('keyboard only: arrow keys move through the bay grid and the Inspector follows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  const grid = page.getByRole('grid', { name: /cross section/ });
  await grid.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText('NSPU 771032 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bay view' }).getByRole('status')).toContainText(
    '180488, NSPU 771032 1, Colombo, 17.1 tonnes',
  );
});
