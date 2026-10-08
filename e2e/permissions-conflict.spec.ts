import { expect, test, type Page } from '@playwright/test';
import { openWorkspace, settle, switchRole, wait3D } from './helpers';

// M8: AT-11 to AT-14. One edit gate for every path (decisions 1, 2, 4), the workflow with
// errors (decision 3), and the save conflict with the server's changes (decision 6).

const violationsTab = (page: Page) =>
  page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/);
const version = (page: Page) => page.getByTitle(/^Version \d+ on the server$/);
const undo = (page: Page) => page.getByTitle('Undo (Ctrl+Z)');
const save = (page: Page) => page.getByRole('button', { name: /^Save/ });
const live = (page: Page) => page.getByRole('region', { name: 'Bay view' }).getByRole('status');
const toastWith = (page: Page, text: string | RegExp) =>
  page
    .getByRole('status')
    .filter({ has: page.getByRole('button', { name: 'Dismiss' }) })
    .filter({ hasText: text });

/** Presses and moves the mouse in steps, as a person drags. */
async function drag(page: Page, from: string, to: string) {
  const a = (await page.locator(from).boundingBox())!;
  const b = (await page.locator(to).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 4, { steps: 2 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await expect(page.getByTestId('drag-ghost')).toHaveCount(0);
  await page.mouse.up();
}

/** The fix of the stack weight error: Move NSPU 771032 1 to 180688 (AT-04). */
async function applyStackFix(page: Page) {
  await page.getByRole('tab', { name: /^Violations/ }).click();
  await page
    .getByRole('button', { name: /^Apply fix/ })
    .first()
    .click();
  await expect(violationsTab(page)).toHaveText('6 violations');
}

async function force409(page: Page) {
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('menuitemcheckbox', { name: /Next save returns/ }).click();
  await page.keyboard.press('Escape');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('AT-11: as Terminal planner on a Draft no edit path works, inspection does, and the unsaved change survives the switch', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  // An unsaved change as the vessel planner.
  await applyStackFix(page);
  await expect(undo(page)).toBeEnabled();

  await switchRole(page, 'Terminal planner');
  const strip = page.getByRole('note', { name: 'Read only' });
  await expect(strip).toContainText('Your role cannot change plans.');
  // What the cells hold: a refused edit leaves them as they are.
  const cells = () =>
    Promise.all(['#bay-cell-180688', '#bay-cell-180682'].map((c) => page.locator(c).innerText()));
  const before = await cells();

  // Drag a load list row and a bay cell: no ghost, nothing moves.
  await page.getByRole('tab', { name: 'Inspector' }).click();
  await drag(page, 'role=row[name=/NSPU/] >> nth=1', '#bay-cell-180682');
  await drag(page, '#bay-cell-180688', '#bay-cell-180682');
  // Keyboard pick-up: refused with the slot and the reason.
  await page.locator('#bay-cell-180688').click();
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText('Your role cannot change plans.');
  await expect(page.getByTestId('held-ghost')).toHaveCount(0);
  // Undo and Redo, by button and by key; Save; Import; Apply fix.
  await expect(undo(page)).toBeDisabled();
  await expect(page.getByTitle('Redo (Ctrl+Shift+Z)')).toBeDisabled();
  await page.keyboard.press('Control+Z');
  await expect(save(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import load list' })).toBeDisabled();
  await page.getByRole('tab', { name: /^Violations/ }).click();
  const fix = page.getByRole('button', { name: /^Apply fix/ }).first();
  await expect(fix).toBeDisabled();
  await expect(fix).toHaveAttribute('title', 'Your role cannot change plans.');
  expect(await cells()).toEqual(before);
  await expect(violationsTab(page)).toHaveText('6 violations');

  // Inspection still works: Show, the camera, the bay grid, the Inspector, playback.
  await page.getByRole('button', { name: /^Show/ }).first().click();
  await expect(page.getByText(/Focused on \d+ container/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  const toolbar = page.getByRole('toolbar', { name: '3D view controls' });
  await toolbar.getByRole('button', { name: 'Top', exact: true }).click();
  await expect(toolbar.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Show moved the view to that violation's bay; go back to bay 18 with the navigator.
  await page.getByRole('button', { name: /^Bay 18:/ }).click();
  await page.getByRole('tab', { name: 'Inspector' }).click();
  await page.locator('#bay-cell-180688').click();
  // The arrow keys still move through the bay grid.
  const grid = page.getByRole('grid', { name: /cross section/ });
  const at = await grid.getAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowUp');
  await expect(grid).not.toHaveAttribute('aria-activedescendant', at ?? '');
  await page.locator('#bay-cell-180688').click();
  await expect(
    page.getByRole('tabpanel').getByText('NSPU 771032 1', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Playback' }).click();
  await expect(page.getByRole('slider', { name: /Port/ })).toBeVisible();
  await page.getByRole('button', { name: 'Playback' }).click();

  // Back as the vessel planner: the unsaved change is still there, and can be saved.
  await switchRole(page, 'Vessel planner');
  await expect(strip).toHaveCount(0);
  await expect(undo(page)).toBeEnabled();
  await expect(save(page)).toBeEnabled();
  await expect(violationsTab(page)).toHaveText('6 violations');
});

test('AT-12: a plan sent for review with errors is read only for both planners; Approve is blocked, Return works with a comment', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  await expect(violationsTab(page)).toHaveText('7 violations');
  // Sending for review is allowed with errors (decision 4).
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
  const strip = page.getByRole('note', { name: 'Read only' });
  const why = 'This plan is in review and read only until it is returned or approved.';

  // Read only for the vessel planner.
  await expect(strip).toContainText(why);
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText(why);
  await expect(page.getByRole('button', { name: 'Import load list' })).toBeDisabled();

  // And for the senior planner. Approve stays focusable, blocked, with its reason (decision 3).
  await switchRole(page, 'Senior planner');
  await expect(strip).toContainText(why);
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText(why);
  const approve = page.getByRole('button', { name: 'Approve' });
  await expect(approve).toHaveAttribute('aria-disabled', 'true');
  await expect(approve).toHaveAccessibleDescription(
    '6 errors remain. Return the plan to fix them.',
  );
  // A person can still press it: nothing happens.
  await approve.dispatchEvent('click');
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();

  // Return needs a comment.
  await page.getByRole('button', { name: 'Return', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Return to Draft' });
  await dialog.getByRole('button', { name: 'Return to Draft' }).click();
  await expect(dialog.getByText('A comment is required when a plan is returned.')).toBeVisible();
  await dialog.getByRole('textbox').fill('Fix the stack weight in bay 18 first.');
  await page.keyboard.press('Control+Enter');
  await expect(dialog).toHaveCount(0);
  await expect(toastWith(page, /^Returned to Draft/)).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(strip).toHaveCount(0);
});

test('AT-13: with the 409 switch on, the review shows no overlap, and Apply saves the next version and re-runs the rules', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  await expect(version(page)).toHaveText('v14');
  await force409(page);
  await applyStackFix(page);
  await save(page).click();

  // The alert, "v14 → v15" and "Save · 1" (design 12).
  const alert = page.getByRole('alert').filter({ hasText: 'saved version 15' });
  await expect(alert).toContainText(/Dimas Hartono saved version 15 at \d\d:\d\d/);
  await expect(alert).toContainText('Your 1 change is kept here and not saved.');
  await expect(page.getByText(/v14 → v\s*15/)).toBeVisible();
  await expect(save(page)).toHaveText('Save · 1');

  // Review: the server's three changes from the 409, and no overlap with mine.
  await alert.getByRole('button', { name: 'Review changes' }).click();
  const review = page.getByRole('dialog', { name: 'Review changes' });
  const server = review.getByRole('region', { name: 'On the server' });
  await expect(server.getByRole('listitem')).toHaveCount(3);
  await expect(server).toContainText('Locked');
  await expect(review.getByTestId('overlap-check')).toContainText(
    "No overlap. Version 15 doesn't touch slots 180488 or 180688.",
  );
  await expect(review.locator('[data-overlap]')).toHaveCount(0);

  // Apply: saved as version 16, with the rules run on the result.
  await review.getByRole('button', { name: 'Apply my changes to version 15' }).click();
  await expect(toastWith(page, 'Draft saved')).toContainText('version 16');
  await expect(version(page)).toHaveText('v16');
  await expect(alert).toHaveCount(0);
  await expect(violationsTab(page)).toHaveText('6 violations');
  await expect(undo(page)).toBeDisabled();
});

test('AT-14: a kept change on a slot the server version also changed is marked with its reason, and nothing is saved', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  await force409(page);
  // Move the container on top of bay 30, row 01, deck: the colleague locks that slot.
  await page.getByRole('button', { name: /^Bay 30:/ }).click();
  await page.locator('#bay-cell-300188').click();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-ghost')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-ghost')).toHaveCount(0);
  await expect(undo(page)).toBeEnabled();
  await save(page).click();

  const alert = page.getByRole('alert').filter({ hasText: 'saved version 15' });
  await alert.getByRole('button', { name: 'Review changes' }).click();
  const review = page.getByRole('dialog', { name: 'Review changes' });
  const mine = review.getByRole('region', { name: 'Your kept changes' });
  await expect(review.getByTestId('overlap-check')).toContainText('1 change overlap.');
  await expect(mine.locator('[data-overlap]')).toContainText(
    'Version 15 also changed slot 300188.',
  );

  // Apply: the rules refuse it on version 15, nothing is saved, and the reason is shown.
  await review.getByRole('button', { name: 'Apply my changes to version 15' }).click();
  await expect(review).toContainText('Nothing was saved. Change 1 cannot go on version 15.');
  await expect(mine.locator('[data-overlap]')).toContainText(/at 300188 is locked\./);
  await expect(toastWith(page, 'Draft saved')).toHaveCount(0);
  await review.getByRole('button', { name: 'Cancel' }).click();
  await settle(page);
  await expect(page.getByText(/v14 → v\s*15/)).toBeVisible();
  await expect(save(page)).toHaveText('Save · 1');
  await expect(undo(page)).toBeEnabled();
});
