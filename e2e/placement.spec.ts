import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, wait3D } from './helpers';

// M4 Placement: AT-02, AT-03 (without the save step), the undo part of AT-04, AT-09, and drags
// from cell to cell and onto a 3D target. Seeded plan: 312 of 1,240 planned, 7 violations.

const planned = (page: Page) => page.getByText(/[\d,]+ \/ 1,240 planned/);
const violationCount = (page: Page) =>
  page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/);
const bayStatus = (page: Page) =>
  page.getByRole('region', { name: 'Bay view' }).getByRole('status');

/** Presses and moves the mouse in steps, as a person drags. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 4, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

const centre = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
});

test('AT-02: a drag of NSPU 551208 4 onto 180688 is refused, with the reason, and the list is unchanged', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Search load list' }).fill('551208');
  const row = page.getByRole('row', { name: /NSPU 551208 4/ });
  await expect(row).toBeVisible();

  await drag(
    page,
    await centre(page, 'role=row[name=/NSPU 551208 4/]'),
    await centre(page, '#bay-cell-180688'),
  );
  // FR-34: the targets are marked, and the hovered one shows its reason.
  await expect(page.locator('[data-slot][data-state~="valid"]').first()).toBeVisible();
  const tip = page.locator('#bay-cell-180688').getByRole('tooltip');
  await expect(tip).toContainText('Stack limit: 96.4 t of 90.0 t');
  await expect(tip).toContainText('Drop disabled at 180688');
  await expect(page.getByTestId('drag-ghost')).toBeVisible();
  await page.mouse.up();

  // FR-35: refused, with the reason in an alert, and the container back in the list.
  await expect(page.getByRole('alert')).toContainText("Can't place NSPU 551208 4 at 180688");
  await expect(page.getByRole('alert')).toContainText(
    'Stack limit: 96.4 t of 90.0 t. Container returned to the load list.',
  );
  await expect(planned(page)).toHaveText('312 / 1,240 planned');
  await expect(row).toBeVisible();
  await expect(page.locator('#bay-cell-180688')).toHaveAttribute('data-state', /empty/);
  await expect(page.getByTestId('drag-ghost')).toHaveCount(0);
});

test('AT-03: with the keyboard only, a load list row is picked up and placed in the bay grid (FR-17, FR-36, FR-37)', async ({
  page,
}) => {
  // Keyboard only: "/" goes to the search, Tab to the list.
  await page.keyboard.press('/');
  await expect(page.getByRole('textbox', { name: 'Search load list' })).toBeFocused();
  const list = page.getByRole('grid', { name: 'Containers to load' });
  for (let i = 0; i < 20 && !(await list.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(list).toBeFocused();

  // The second heaviest unplanned row, NSPU 300653 4, has a valid target in bay 18.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');

  const grid = page.getByRole('grid', { name: /^Bay 18 cross section/ });
  await expect(grid).toBeFocused();
  await expect(bayStatus(page)).toContainText(
    'Picked up NSPU 300653 4 from the load list. 1 valid target in bay 18.',
  );
  await expect(page.getByTestId('held-ghost')).toBeVisible();
  await expect(grid).toHaveAttribute('aria-activedescendant', 'bay-cell-180286');

  // Arrow keys read each slot and its rule result, and come back.
  await page.keyboard.press('ArrowRight');
  await expect(bayStatus(page)).toContainText(/\d{6}: /);
  await page.keyboard.press('ArrowLeft');
  await expect(bayStatus(page)).toContainText('180286: empty. Valid target, stack');

  await page.keyboard.press('Enter');
  await expect(bayStatus(page)).toContainText('Placed NSPU 300653 4 at 180286.');
  await expect(planned(page)).toHaveText('313 / 1,240 planned');
  await expect(page.locator('#bay-cell-180286')).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('status').filter({ hasText: 'Placed NSPU 300653 4' }).first(),
  ).toBeVisible();
});

test('Esc in the grid puts a container back where it was (FR-36)', async ({ page }) => {
  await page.locator('#bay-cell-180488').click();
  const grid = page.getByRole('grid', { name: /^Bay 18 cross section/ });
  await expect(grid).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(bayStatus(page)).toContainText('Picked up NSPU 771032 1 from 180488.');
  await expect(page.locator('#bay-cell-180488')).toHaveAttribute('data-state', /origin/);
  await page.keyboard.press('Escape');
  await expect(bayStatus(page)).toContainText('Cancelled. Container returned to its slot.');
  await expect(page.locator('#bay-cell-180488')).not.toHaveAttribute('data-state', /origin/);
});

test('AT-04, undo: a move resolves the 18-04 stack weight, and Undo brings 7 violations back (FR-33, FR-57, FR-58)', async ({
  page,
}) => {
  await expect(violationCount(page)).toHaveText('7 violations');
  // The fix for stack 18-04 deck: move NSPU 771032 1 from 180488 to 180688, here by a drag.
  await drag(page, await centre(page, '#bay-cell-180488'), await centre(page, '#bay-cell-180688'));
  await expect(page.locator('#bay-cell-180688').getByRole('tooltip')).toContainText(
    'Valid · stack',
  );
  await page.mouse.up();

  const toast = page.getByRole('status').filter({ hasText: 'Resolved · Stack weight' });
  await expect(toast).toContainText('Stack 18-04 deck back to 79.3 t of 90.0 t');
  await expect(violationCount(page)).toHaveText('6 violations');
  await expect(page.locator('#bay-cell-180688')).toHaveAttribute('data-state', /occupied/);

  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(violationCount(page)).toHaveText('7 violations');
  await expect(page.locator('#bay-cell-180488')).toHaveAttribute('data-state', /occupied/);
  await expect(page.locator('#bay-cell-180688')).toHaveAttribute('data-state', /empty/);
  await expect(
    page.getByRole('status').filter({ has: page.getByText('Undone', { exact: true }) }),
  ).toContainText('Moved NSPU 771032 1 from 180488 to 180688');

  // Redo with Ctrl+Shift+Z, and undo again with Ctrl+Z.
  await page.keyboard.press('Control+Shift+Z');
  await expect(violationCount(page)).toHaveText('6 violations');
  await page.keyboard.press('Control+Z');
  await expect(violationCount(page)).toHaveText('7 violations');
});

test('AT-09: with reduced motion, no animation of a placement runs longer than 100 ms (FR-66)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
  // Record every animation and transition that starts, with its length.
  await page.evaluate(() => {
    const w = window as unknown as { __longest: number; __seen: number };
    w.__longest = 0;
    w.__seen = 0;
    const scan = () => {
      for (const a of document.getAnimations()) {
        const t = a.effect?.getComputedTiming();
        const ms = Number(t?.duration ?? 0) * Number(t?.iterations ?? 1) + Number(t?.delay ?? 0);
        w.__seen++;
        w.__longest = Math.max(w.__longest, ms);
      }
      requestAnimationFrame(scan);
    };
    scan();
  });

  // A refused drop (shake, return) and a valid one (settle), by drag; a keyboard pick-up (ghost).
  await page.getByRole('textbox', { name: 'Search load list' }).fill('551208');
  await drag(
    page,
    await centre(page, 'role=row[name=/NSPU 551208 4/]'),
    await centre(page, '#bay-cell-180688'),
  );
  await page.mouse.up();
  await expect(page.getByRole('alert')).toBeVisible();
  await drag(page, await centre(page, '#bay-cell-180488'), await centre(page, '#bay-cell-180688'));
  await page.mouse.up();
  await expect(page.getByRole('status').filter({ hasText: 'Resolved' })).toBeVisible();
  await page.locator('#bay-cell-180688').click();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-ghost')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const { longest, seen } = await page.evaluate(() => {
    const w = window as unknown as { __longest: number; __seen: number };
    return { longest: w.__longest, seen: w.__seen };
  });
  expect(seen).toBeGreaterThan(0);
  expect(longest).toBeLessThanOrEqual(100);
});

test('a drop on a 3D target in the selected bay places the container (FR-32, FR-38)', async ({
  page,
}) => {
  await wait3D(page);
  await page.getByRole('textbox', { name: 'Search load list' }).fill('300653');
  const from = await centre(page, 'role=row[name=/NSPU 300653 4/]');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 4, { steps: 2 });
  // Find where target 180286 is drawn, now that the targets are on screen.
  const at = await page.evaluate(() => window.__stowViewport!.findTarget('180286'));
  expect(at).not.toBeNull();
  await page.mouse.move(at!.x, at!.y, { steps: 12 });
  await expect(page.getByTestId('drag-ghost')).toBeVisible();
  await page.mouse.up();
  await expect(planned(page)).toHaveText('313 / 1,240 planned');
  await expect(page.locator('#bay-cell-180286')).toHaveAttribute('data-state', /occupied/);
});

test('NFR-02: the pick-up is timed until the bay shows its target marks', async ({ page }) => {
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-slot][data-state~="valid"]').first()).toBeVisible();
  const ms = await page.waitForFunction(() => {
    const e = performance.getEntriesByName('nfr-02 target marks');
    return e.length ? e[0]!.duration : null;
  });
  expect(await ms.jsonValue()).toBeGreaterThan(0);
});
