import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openWorkspace } from './helpers';

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
    expect(blocking(await scan(page))).toEqual([]);
  });

  test(`bay view, collapsed panels and violations tab, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await page.getByRole('tab', { name: 'Bay', exact: true }).click();
    await page.getByRole('tab', { name: /Violations/ }).click();
    expect(blocking(await scan(page))).toEqual([]);
    await page.getByRole('button', { name: 'Collapse load list' }).click();
    await page.getByRole('button', { name: 'Collapse panel' }).click();
    expect(blocking(await scan(page))).toEqual([]);
  });
}
