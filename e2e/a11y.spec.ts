import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, wait3D } from './helpers';

// NFR-09: no critical or serious axe findings, in both themes. Gate for M2.

const scan = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

const blocking = (results: Awaited<ReturnType<typeof scan>>) =>
  results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1] ?? ''}`),
    }));

for (const theme of ['dark', 'light'] as const) {
  test(`workspace has no critical or serious axe findings, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    expect(blocking(await scan(page))).toEqual([]);
  });

  test(`bay view, collapsed panels and violations tab, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    await page.getByRole('tab', { name: 'Bay', exact: true }).click();
    await page.getByRole('tab', { name: /Violations/ }).click();
    expect(blocking(await scan(page))).toEqual([]);
    await page.getByRole('button', { name: 'Collapse load list' }).click();
    await page.getByRole('button', { name: 'Collapse panel' }).click();
    expect(blocking(await scan(page))).toEqual([]);
  });
}

// Pending the owner's decision (BUILD_NOTES, M4 "Accessibility findings for decision"): the
// design draws these below 4.5:1. Excluded by name so that anything else still fails.
const PENDING = ['[data-held]', '[data-testid="held-pill"]', '[data-testid="stability-delta"]'];
const scanHeld = (page: Page) => {
  const b = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
  for (const sel of PENDING) b.exclude(sel);
  return b.analyze();
};

for (const theme of ['dark', 'light'] as const) {
  test(`a held container: marks, tooltip, Inspector and refusal, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    // From the keyboard: marks, the held ghost, "Picked up", Cancel and Place.
    await page.locator('#bay-cell-180488').click();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('held-ghost')).toBeVisible();
    expect(blocking(await scanHeld(page))).toEqual([]);
    // A refused keyboard drop: the alert.
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Search load list' }).fill('551208');
    const row = (await page.getByRole('row', { name: /NSPU 551208 4/ }).boundingBox())!;
    const cell = (await page.locator('#bay-cell-180688').boundingBox())!;
    await page.mouse.move(row.x + 60, row.y + row.height / 2);
    await page.mouse.down();
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 10 });
    await expect(page.locator('#bay-cell-180688').getByRole('tooltip')).toBeVisible();
    expect(blocking(await scanHeld(page))).toEqual([]);
    await page.mouse.up();
    await expect(page.getByRole('alert')).toBeVisible();
    // After the toast's 160 ms entrance: axe reads colors mid-fade as blended.
    await page.waitForTimeout(400);
    expect(blocking(await scanHeld(page))).toEqual([]);
  });
}
