import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadListFile, openPlans, openWorkspace, switchRole, wait3D } from './helpers';

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
    // The Bay tab collapses both panels (screen 03).
    await page.getByRole('tab', { name: 'Bay', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Expand load list' })).toBeVisible();
    expect(blocking(await scan(page))).toEqual([]);
    await page.getByRole('button', { name: 'Expand details panel' }).click();
    await page.getByRole('tab', { name: /Violations/ }).click();
    expect(blocking(await scan(page))).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`a held container: marks, tooltip, Inspector and refusal, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    // From the keyboard: marks, the held ghost, "Picked up", Cancel and Place.
    await page.locator('#bay-cell-180488').click();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('held-ghost')).toBeVisible();
    expect(blocking(await scan(page))).toEqual([]);
    // A refused keyboard drop: the alert.
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Search load list' }).fill('551208');
    const row = (await page.getByRole('row', { name: /NSPU 551208 4/ }).boundingBox())!;
    const cell = (await page.locator('#bay-cell-180688').boundingBox())!;
    await page.mouse.move(row.x + 60, row.y + row.height / 2);
    await page.mouse.down();
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 10 });
    await expect(page.locator('#bay-cell-180688').getByRole('tooltip')).toBeVisible();
    expect(blocking(await scan(page))).toEqual([]);
    await page.mouse.up();
    await expect(page.getByRole('alert')).toBeVisible();
    // After the toast's 160 ms entrance: axe reads colors mid-fade as blended.
    await page.waitForTimeout(400);
    expect(blocking(await scan(page))).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`violations with Show, the stability drawer and playback, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    await page.getByRole('tab', { name: /^Violations/ }).click();
    await page.getByRole('button', { name: 'Show error · stack weight at 180488' }).click();
    await page.waitForTimeout(300);
    expect(blocking(await scan(page))).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Stability', exact: true }).click();
    await page.waitForTimeout(400);
    expect(blocking(await scan(page))).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Playback' }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    expect(blocking(await scan(page))).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`plans list, dialogs and the account menu, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlans(page, theme);
    expect(blocking(await scan(page))).toEqual([]);
    await page.getByRole('button', { name: /^Account:/ }).click();
    expect(blocking(await scan(page))).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'New plan' }).click();
    await page.getByRole('dialog', { name: 'New plan' }).getByLabel('Voyage').fill('x');
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    expect(blocking(await scan(page))).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test(`import report, conflict and review states, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, theme);
    await wait3D(page);
    await page.getByTestId('import-file').setInputFiles(loadListFile());
    await expect(page.getByRole('dialog', { name: 'Import load list' })).toBeVisible();
    expect(blocking(await scan(page))).toEqual([]);
    await page.getByRole('button', { name: 'Done' }).click();
    // A conflict, with its review dialog.
    await page.getByRole('button', { name: /^Account:/ }).click();
    await page.getByLabel('Next save returns 409').check();
    await page.keyboard.press('Escape');
    await page.locator('#bay-cell-180488').click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Save' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'saved version 15' });
    await expect(alert).toBeVisible();
    await page.waitForTimeout(300);
    expect(blocking(await scan(page))).toEqual([]);
    await alert.getByRole('button', { name: 'Review changes' }).click();
    expect(blocking(await scan(page))).toEqual([]);
    await page.keyboard.press('Escape');
    // The workflow buttons and the read only state.
    await switchRole(page, 'Senior planner');
    await page.getByRole('button', { name: 'Return' }).count();
    expect(blocking(await scan(page))).toEqual([]);
  });
}
