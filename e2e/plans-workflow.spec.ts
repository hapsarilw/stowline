import { expect, test, type Page } from '@playwright/test';
import { loadListFile, openPlanFromList, openPlans, openWorkspace, switchRole } from './helpers';

// M6: AT-01, AT-03 in full, AT-05, AT-06, AT-10, and the plans list (FR-01 to FR-05).

const planned = (page: Page) => page.getByText(/[\d,]+ \/ 1,240 planned/);
const version = (page: Page) => page.getByTitle(/^Version \d+ on the server$/);
const violationsTab = (page: Page) =>
  page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/);
const bayStatus = (page: Page) =>
  page.getByRole('region', { name: 'Bay view' }).getByRole('status');
// A message (the toast has a Dismiss button), not the live region that repeats it.
const toastWith = (page: Page, text: string | RegExp) =>
  page
    .getByRole('status')
    .filter({ has: page.getByRole('button', { name: 'Dismiss' }) })
    .filter({ hasText: text });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.describe('plans list (FR-01 to FR-05)', () => {
  test('shows the 12 voyages of design 07 with their columns (FR-01)', async ({ page }) => {
    await openPlans(page);
    await expect(page.getByRole('row').filter({ has: page.getByRole('progressbar') })).toHaveCount(
      12,
    );
    await expect(page.getByText('12 voyages · 9 need work')).toBeVisible();
    const row = page.getByRole('row', { name: /MV Nusantara Pioneer/ });
    await expect(row).toContainText('8,500 TEU · IMO 9000000');
    await expect(row).toContainText('042W');
    await expect(row).toContainText('08 Oct 22:00');
    await expect(row).toContainText('Tomorrow');
    await expect(row).toContainText('312 / 1,240');
    await expect(row).toContainText('25%');
    await expect(row).toContainText('6 err · 1 w');
    await expect(row).toContainText('Draft');
    await expect(row).toContainText('Rina Adiputri');
    await expect(page.getByRole('row', { name: /Andaman Reach/ })).toContainText('Unassigned');
    await expect(page.getByRole('row', { name: /Arafura Dawn/ })).toContainText('Clear');
  });

  test('filters by status, assigned to me and violations, searches and sorts by ETD (FR-02)', async ({
    page,
  }) => {
    await openPlans(page);
    const rows = page.getByRole('row').filter({ has: page.getByRole('progressbar') });
    await page.getByRole('tab', { name: /^Approved/ }).click();
    await expect(rows).toHaveCount(3);
    await page.getByRole('tab', { name: /^All/ }).click();
    await page.getByRole('button', { name: 'Assigned to me' }).click();
    await expect(rows).toHaveCount(3);
    await page.getByRole('button', { name: 'Assigned to me' }).click();
    await page.getByRole('button', { name: 'Has violations' }).click();
    await expect(rows).toHaveCount(6);
    await page.getByRole('button', { name: 'Has violations' }).click();
    await page.getByRole('textbox', { name: 'Search plans' }).fill('dawn');
    await expect(rows).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Search plans' }).fill('zzz');
    await expect(page.getByText('No plans match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows).toHaveCount(12);
    await expect(rows.first()).toContainText('MV Nusantara Pioneer');
    await page.getByRole('button', { name: /^ETD/ }).click();
    await expect(rows.first()).toContainText('MV Riau Spirit');
    await expect(page.getByRole('columnheader', { name: /ETD/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  test('a row opens a preview of the plan, with its activity (FR-03)', async ({ page }) => {
    await openPlans(page);
    const preview = page.getByRole('complementary', { name: 'Plan preview' });
    await expect(preview).toContainText('MV Nusantara Pioneer');
    await expect(preview).toContainText('Voy 042W · SGSIN · ETD 08 Oct 22:00');
    await expect(preview.getByRole('img', { name: 'Bay fill profile' })).toBeVisible();
    await expect(preview.getByText('1.84 m')).toBeVisible();
    await expect(preview.getByText('0.62 m S')).toBeVisible();
    for (const t of [
      'Overstow',
      'Stack weight',
      'Reefer power',
      'DG segregation',
      '20ft on 40ft',
      'Heavy over light',
    ])
      await expect(preview.getByText(t, { exact: true })).toBeVisible();
    await expect(
      preview.getByText('Rina Adiputri validated the plan: 6 errors, 1 warning'),
    ).toBeVisible();
    await page.getByRole('row', { name: /MV Arafura Dawn/ }).click();
    await expect(preview).toContainText('All rule checks pass');
    await expect(preview.getByRole('button', { name: 'Open plan' })).toBeDisabled();
    await expect(preview).toContainText('no vessel geometry in the demo');
  });

  test('New plan creates a Draft from the arrival condition (FR-05)', async ({ page }) => {
    await openPlans(page);
    await page.getByRole('button', { name: 'New plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'New plan' });
    await dialog.getByLabel('Voyage').fill('abc');
    await dialog.getByRole('button', { name: 'Create plan' }).click();
    await expect(dialog.getByRole('alert')).toContainText('3 digits and a direction');
    await dialog.getByLabel('Voyage').fill('043W');
    await dialog.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Plan created' })).toContainText(
      'MV Nusantara Pioneer · 043W-LKCMB · starts from the arrival condition',
    );
    await expect(page.getByText('13 voyages')).toBeVisible();
    await page
      .getByRole('complementary', { name: 'Plan preview' })
      .getByRole('button', { name: 'Open plan' })
      .click();
    await expect(page).toHaveURL(/\/plans\/043W-LKCMB$/);
    await expect(page.getByText(/[\d,]+ \/ [\d,]+ planned/)).toBeVisible();
  });
});

test('AT-01: opening 042W from the plans list shows 312 of 1,240, 2,740 containers and 7 violations', async ({
  page,
}) => {
  await openPlans(page);
  await openPlanFromList(page);
  await expect(page).toHaveURL(/\/plans\/042W-SGSIN$/);
  await expect(planned(page)).toHaveText('312 / 1,240 planned');
  await expect(violationsTab(page)).toHaveText('7 violations');
  const legend = page.getByRole('group', { name: /^Legend/ });
  const counts = (await legend.innerText()).match(/\d+/g)!.map(Number);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(2740);
});

test('AT-03 in full: keyboard only, pick up, place and save: planned 313 and version 15', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect(version(page)).toHaveText('v14');
  await page.keyboard.press('/');
  const list = page.getByRole('grid', { name: 'Containers to load' });
  for (let i = 0; i < 20 && !(await list.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(bayStatus(page)).toContainText('Picked up NSPU 300653 4 from the load list.');
  await page.keyboard.press('Enter');
  await expect(planned(page)).toHaveText('313 / 1,240 planned');
  // Save is reached with Tab, from the workspace.
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();
  for (let i = 0; i < 80 && !(await save.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toastWith(page, 'Draft saved')).toContainText(
    '042W-SGSIN · version 15 · 313 of 1,240 planned',
  );
  await expect(version(page)).toHaveText('v15');
  await expect(save).toBeDisabled();
});

test('unsaved commands survive a reload and are saved after it (FR-61, NFR-16)', async ({
  page,
}) => {
  await openWorkspace(page);
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
  const kept = await page.evaluate(() => localStorage.getItem('stowline.unsaved.042W-SGSIN'));
  expect(kept).toContain('"baseVersion":14');
  await page.reload();
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
  await expect(toastWith(page, 'Unsaved changes restored')).toContainText(
    '1 change from your last session is back. Save to keep it.',
  );
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(toastWith(page, 'Draft saved')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('stowline.unsaved.042W-SGSIN'))).toBeNull();
  // The saved plan is what a reload loads now, with nothing to restore.
  await page.reload();
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
  await expect(version(page)).toHaveText('v15');
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeDisabled();
});

test('AT-05: a forced conflict shows who saved and when, and the commands stay in the history (FR-60)', async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('menuitemcheckbox', { name: /Next save returns/ }).click();
  await page.keyboard.press('Escape');
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'saved version 15' });
  await expect(alert).toContainText(/Dimas Hartono saved version 15 at \d\d:\d\d/);
  await expect(alert).toContainText('Your 1 change is kept here and not saved.');
  await expect(page.getByTitle('Undo (Ctrl+Z)')).toBeEnabled();
  // The top bar shows the version gap, and Save counts the kept change.
  await expect(page.getByText('v14 → v15')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save/ })).toContainText('Save · 1');
  // Review changes, then put them on the newest version and save.
  await alert.getByRole('button', { name: 'Review changes' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review changes' });
  await expect(dialog).toContainText('v15 · Dimas Hartono');
  await expect(dialog).toContainText('Moved NSPU 771032 1 from 180488 to');
  await expect(
    dialog.getByRole('button', { name: 'Apply my changes to version 15' }),
  ).toBeFocused();
  await expect(dialog).toContainText('Nothing is saved until you confirm.');
  await dialog.getByRole('button', { name: 'Apply my changes to version 15' }).click();
  // Apply loads version 15, puts the change on top with the rule check, and saves it.
  await expect(toastWith(page, 'Draft saved')).toContainText('version 16');
  await expect(version(page)).toHaveText('v16');
});

test('AT-05: Retry saves again after a conflict', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('menuitemcheckbox', { name: /Next save returns/ }).click();
  await page.keyboard.press('Escape');
  await page.locator('#bay-cell-180488').click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'saved version 15' })
    .getByRole('button', { name: 'Retry' })
    .click();
  // The base is still version 14, so the server refuses again, until the changes are reviewed.
  await expect(page.getByRole('alert').filter({ hasText: 'saved version 15' })).toBeVisible();
  await expect(page.getByText('v14 → v15')).toBeVisible();
});

async function applyFix(page: Page, name: RegExp) {
  await page
    .getByRole('article', { name })
    .getByRole('button', { name: /^(Apply fix|Unplace)/ })
    .click();
}

async function fixAllErrors(page: Page) {
  await page.getByRole('tab', { name: /^Violations/ }).click();
  const panel = page.getByRole('tabpanel', { name: /Violations/ });
  for (const name of [
    /Stack 18-04/,
    /Reefer NSPU 220417 3/,
    /IMDG 3 next to/,
    /Colombo box under Rotterdam/,
    /Jebel Ali box under Hamburg/,
    /20ft NSPU 318204 6/,
  ]) {
    await applyFix(page, name);
    await expect(toastWith(page, /Resolved|Unplaced|Moved|Swapped|Placed/)).toBeVisible();
  }
  await expect(panel.getByRole('article')).toHaveCount(1);
}

test('AT-06: Approve is not offered to a planner, is blocked with errors, then approves and locks the plan', async ({
  page,
}) => {
  await openWorkspace(page);
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(toastWith(page, 'Sent for review')).toContainText(
    'read only until it is returned or approved',
  );
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
  // In review the plan is locked, as design 11, and a planner still has no Approve.
  await expect(page.getByRole('note', { name: 'Read only' })).toContainText(
    'This plan is in review and read only until it is returned or approved.',
  );
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await switchRole(page, 'Senior planner');
  const approve = page.getByRole('button', { name: 'Approve' });
  await expect(approve).toHaveAttribute('aria-disabled', 'true');
  await approve.focus();
  await expect(page.getByRole('tooltip')).toHaveText('6 errors remain: fix them to approve');
  // The senior planner returns it with a comment; the planner fixes the errors and sends it again.
  await page.getByRole('button', { name: 'Return' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Fix the six errors first');
  await page.getByRole('dialog').getByRole('button', { name: 'Return to Draft' }).click();
  await expect(toastWith(page, 'Returned to Draft')).toContainText(
    'back with Rina Adiputri, with your comment',
  );
  await switchRole(page, 'Vessel planner');
  await fixAllErrors(page);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(toastWith(page, 'Sent for review')).toBeVisible();
  await switchRole(page, 'Senior planner');
  await expect(approve).not.toHaveAttribute('aria-disabled', 'true');
  await approve.click();
  await expect(toastWith(page, 'Approved')).toContainText('is approved and read only.');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  // Read only: no Approve, the strip says who approved, and the actions that change the plan are off.
  await expect(approve).toHaveCount(0);
  await expect(page.getByRole('note', { name: 'Read only' })).toContainText(
    'Approved by Hendra Wirawan',
  );
  await expect(page.getByRole('button', { name: 'Import load list' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.locator('#bay-cell-180486').click();
  await page.keyboard.press('Enter');
  await expect(bayStatus(page)).toContainText('This plan is approved and read only.');
  await expect(page.getByRole('button', { name: 'Revise' }).first()).toBeVisible();
});

test('Return needs a comment; Revise makes a new Draft version (FR-62, FR-63)', async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(toastWith(page, 'Sent for review')).toBeVisible();
  await switchRole(page, 'Senior planner');
  await page.getByRole('button', { name: 'Return' }).click();
  const dialog = page.getByRole('dialog', { name: 'Return to Draft' });
  await dialog.getByRole('button', { name: 'Return to Draft' }).click();
  await expect(dialog.getByRole('alert')).toContainText('A comment is required');
  await dialog.getByRole('textbox').fill('Fix the DG first');
  await dialog.getByRole('button', { name: 'Return to Draft' }).click();
  await expect(toastWith(page, 'Returned to Draft')).toContainText(
    'Version 14 is back with Rina Adiputri, with your comment.',
  );
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  // The comment is in the activity log the plans list shows.
  await page.getByRole('link', { name: /all plans/ }).click();
  await expect(
    page.getByText('Hendra Wirawan returned the plan to Draft: Fix the DG first'),
  ).toBeVisible();
});

test('AT-10: a file with 10 rows, 3 invalid: 7 accepted and 3 listed with a reason (FR-64)', async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByTestId('import-file').setInputFiles(loadListFile());
  const dialog = page.getByRole('dialog', { name: 'Import load list' });
  await expect(dialog.getByTestId('import-summary')).toContainText(
    '7 rows accepted · 3 rejected from load-list.json',
  );
  const table = dialog.getByRole('table', { name: 'Rejected rows' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table).toContainText('Weight must be between 2.0 and 35.0 t.');
  await expect(table).toContainText('Type must be one of 20GP, 40GP, 40HC, RF, TK, OT.');
  await expect(table).toContainText('POD must be a port after SGSIN in the rotation.');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await dialog.getByRole('button', { name: 'Copy report' }).click();
  await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Row 3');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('PRO · 1,247').or(page.getByText(/SGSIN · 1,247/))).toBeVisible();
});

test('a file that is not JSON is refused with a message (422), and hostile text stays text (NFR-19)', async ({
  page,
}) => {
  await openWorkspace(page);
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('<html>') });
  await expect(
    page
      .getByRole('alert')
      .or(page.getByRole('status'))
      .filter({ hasText: 'The file is not valid JSON.' }),
  ).toBeVisible();
  const hostile = [
    { id: '<img src=x onerror="window.__pwned=1">', type: '40GP', weightT: 8, pod: 'LKCMB' },
  ];
  await page.getByTestId('import-file').setInputFiles({
    name: 'h.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(hostile)),
  });
  const dialog = page.getByRole('dialog', { name: 'Import load list' });
  await expect(dialog.getByRole('table', { name: 'Rejected rows' })).toContainText('<img src=x');
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
  ).toBeUndefined();
  await expect(dialog.locator('img')).toHaveCount(0);
});

test('every failed request shows a message with Retry (NFR-18)', async ({ page }) => {
  await openPlans(page);
  // Let the preview's own request finish first, so the forced failure meets the list.
  await expect(
    page
      .getByRole('complementary', { name: 'Plan preview' })
      .getByText('Rina Adiputri validated the plan: 6 errors, 1 warning'),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as {
        __stowMock: { control: { getState: () => { setFailNext: (s: number) => void } } };
      }
    ).__stowMock.control
      .getState()
      .setFailNext(503),
  );
  await page.getByRole('button', { name: 'Has violations' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Request failed' });
  await expect(alert).toContainText('The server failed on purpose (503)');
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('row').filter({ has: page.getByRole('progressbar') })).toHaveCount(6);
});
