import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, wait3D } from './helpers';

// M5: AT-04 and AT-07, and the behavior of the violations panel, the stability drawer and port
// playback in the browser.

const tabCount = (page: Page) =>
  page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/);
const panel = (page: Page) => page.getByRole('tabpanel', { name: /Violations/ });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
});

test('AT-04: Apply fix for the stack weight gives 6 violations and 79.3 t; Undo gives 7 (FR-44, FR-45)', async ({
  page,
}) => {
  await page.getByRole('tab', { name: /^Violations/ }).click();
  await expect(tabCount(page)).toHaveText('7 violations');
  const stack = panel(page).getByRole('article', { name: /Stack 18-04 deck/ });
  await expect(stack).toContainText(/Fix\s*Move NSPU 771032 1 \(17\.1 t\) to 180688/);
  await stack.getByRole('button', { name: /^Apply fix/ }).click();

  await expect(tabCount(page)).toHaveText('6 violations');
  await expect(panel(page).getByRole('article')).toHaveCount(6);
  await expect(page.locator('[title="Stack 18-04 deck: 79.3 t of 90.0 t"]')).toBeVisible();
  const toast = page.getByRole('status').filter({ hasText: 'Resolved · Stack weight' });
  await expect(toast).toContainText('Stack 18-04 deck back to 79.3 t of 90.0 t');

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(tabCount(page)).toHaveText('7 violations');
  await expect(panel(page).getByRole('article')).toHaveCount(7);
  await expect(page.locator('[title="Stack 18-04 deck: 96.4 t of 90.0 t"]')).toBeVisible();
});

test('Show focuses the violation in 3D and the bay view; Esc clears it (FR-43)', async ({
  page,
}) => {
  await wait3D(page);
  await page.getByRole('tab', { name: /^Violations/ }).click();
  await panel(page).getByRole('button', { name: 'Show error · dg segregation at 140284' }).click();
  const banner = page.getByRole('region', { name: '3D view' }).getByRole('status');
  await expect(banner).toContainText(
    'Focused on 2 containers · DG segregation · 140284 · others dimmed',
  );
  await expect(page.getByText(/^Bay 14$/).first()).toBeVisible();
  await expect(page.locator('#bay-cell-140284')).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('list', { name: 'Containers involved' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(banner).toHaveCount(0);
});

test('Validate runs in the worker and opens the violations panel (FR-41)', async ({ page }) => {
  await page.getByRole('button', { name: /^Validate/ }).click();
  // Errors remain, so the result is an alert.
  await expect(
    page.getByRole('alert').filter({ hasText: 'Validation complete · 7 issues' }),
  ).toContainText('6 errors, 1 warning');
  await expect(page.getByRole('tab', { name: /^Violations/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(panel(page)).toContainText(/6 errors block approval · checked \d\d:\d\d:\d\d/);
});

test('the stability drawer opens from the strip and shows design 05 (FR-53)', async ({ page }) => {
  await page.getByRole('button', { name: 'Stability', exact: true }).click();
  const drawer = page.getByRole('region', { name: 'Stability details' });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole('img', { name: /Bending moment peaks at 78 percent/ }),
  ).toBeVisible();
  for (const t of [
    /^12\.10\s*m$/,
    /^12\.41\s*m$/,
    /^12\.72\s*m$/,
    /^98,420 t$/,
    /^OK · min 1\.20 m$/,
  ])
    await expect(drawer.getByText(t)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
});

test('AT-07: port playback shows 2 restows at Colombo and 1 at Jebel Ali (FR-55, FR-56)', async ({
  page,
}) => {
  await wait3D(page);
  await page.getByRole('button', { name: 'Playback' }).click();
  const timeline = page.getByRole('group', { name: 'Port timeline' });
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole('button', { name: /^Colombo/ })).toContainText('2 restows');
  await expect(timeline.getByRole('button', { name: /^Jebel Ali/ })).toContainText('1 restow');
  await expect(timeline.getByRole('button', { name: /^Rotterdam/ })).not.toContainText('restow');
  await expect(page.getByRole('tab', { name: '3D', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // Play and pause; a stop can be chosen.
  await timeline.getByRole('button', { name: 'Pause' }).click();
  await timeline.getByRole('button', { name: /^Jebel Ali/ }).click();
  await expect(timeline.getByRole('slider', { name: 'Port playback' })).toHaveAttribute(
    'aria-valuetext',
    'Jebel Ali · discharging 674 boxes · 1 restow move',
  );
  await page.getByRole('button', { name: 'Playback' }).click();
  await expect(timeline).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Split', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
