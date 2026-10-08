import { expect, test, type Page } from '@playwright/test';
import { loadListFile, openPlans, switchRole } from './helpers';

// The gate of M6: steps 1 to 11 of the PRD section "End-to-end business process", in order,
// in one run, with the three roles. Step 12 (Sail) has no requirement and is not built.

const toast = (page: Page, text: string | RegExp) =>
  page
    .getByRole('status')
    .filter({ has: page.getByRole('button', { name: 'Dismiss' }) })
    .filter({ hasText: text });
const violations = (page: Page) =>
  page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/);

test('the business process, steps 1 to 11', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Open the port call (vessel planner): the plans list shows voyages with ETD, progress,
  //    violations and status.
  await openPlans(page);
  const row = page.getByRole('row', { name: /MV Nusantara Pioneer/ });
  await expect(row).toContainText('08 Oct 22:00');
  await expect(row).toContainText('312 / 1,240');
  await expect(row).toContainText('6 err · 1 w');
  await expect(row).toContainText('Draft');
  await row.click();
  await page.getByRole('button', { name: 'Open plan' }).click();

  // 2. Load the arrival condition: the containers already on board from earlier ports.
  await expect(page.getByRole('heading', { name: 'Load list' })).toBeVisible();
  await expect(page).toHaveURL(/\/plans\/042W-SGSIN$/);
  await expect(page.getByText('312 / 1,240 planned')).toBeVisible();
  const legend = (await page.getByRole('group', { name: /^Legend/ }).innerText())
    .match(/\d+/g)!
    .map(Number);
  expect(legend.reduce((a, b) => a + b, 0)).toBe(2740);
  await page.locator('#bay-cell-180486').click();
  await expect(page.getByText('NSPU 482913 5', { exact: true }).first()).toBeVisible();

  // 3. Import the load list: each row is checked, the rejected ones are listed with a reason.
  await page.getByTestId('import-file').setInputFiles(loadListFile());
  const report = page.getByRole('dialog', { name: 'Import load list' });
  await expect(report.getByTestId('import-summary')).toContainText('7 rows accepted · 3 rejected');
  await expect(report.getByRole('table', { name: 'Rejected rows' }).getByRole('row')).toHaveCount(
    4,
  );
  await report.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(/SGSIN · 1,247/)).toBeVisible();

  // 4. Place containers: valid, warning and invalid slots are marked with the reason before
  //    the drop. Here with the keyboard, an imported container.
  await page.getByRole('textbox', { name: 'Search load list' }).fill('900000');
  const grid = page.getByRole('grid', { name: 'Containers to load' });
  await grid.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const bay = page.getByRole('grid', { name: /^Bay 18 cross section/ });
  await expect(bay).toBeFocused();
  await expect(page.locator('[data-slot][data-state~="valid"]').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText('313 / 1,247 planned')).toBeVisible();

  // 5. Check the rules: the plan is re-checked on every move and the violations are listed.
  await page.getByRole('tab', { name: /^Violations/ }).click();
  await expect(violations(page)).toHaveText('7 violations');
  await expect(page.getByTestId('violations-summary')).toContainText('6 errors block approval');

  // 6. Fix violations: Show moves the camera, Apply fix makes the suggested move.
  await page.getByRole('button', { name: 'Show error · dg segregation at 140284' }).click();
  await expect(
    page.getByRole('region', { name: '3D view' }).getByText(/Focused on 2 containers/),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  for (const name of [
    /Stack 18-04/,
    /Reefer NSPU 220417 3/,
    /IMDG 3 next to/,
    /Colombo box under Rotterdam/,
    /Jebel Ali box under Hamburg/,
    /20ft NSPU 318204 6/,
  ]) {
    await page
      .getByRole('article', { name })
      .getByRole('button', { name: /^(Apply fix|Unplace)/ })
      .click();
    await expect(toast(page, /Resolved|Unplaced|Moved|Swapped|Placed/)).toBeVisible();
  }
  await expect(violations(page)).toHaveText('1 violations');
  await expect(page.getByTestId('violations-summary')).toContainText('No errors block approval');

  // 7. Check stability: GM, trim, list, drafts, bending moment and shear force against limits.
  await page.getByRole('button', { name: 'Stability', exact: true }).click();
  const drawer = page.getByRole('region', { name: 'Stability details' });
  await expect(drawer.getByText(/^OK · min 1\.20 m$/)).toBeVisible();
  await expect(
    drawer.getByRole('img', { name: /Bending moment peaks at \d+ percent/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // 8. Play the port rotation: what leaves at each port, and how many restows it needs.
  await page.getByRole('button', { name: 'Playback' }).click();
  const timeline = page.getByRole('group', { name: 'Port timeline' });
  await expect(
    timeline.getByRole('button', { name: /^Colombo, \d+ containers discharged$/ }),
  ).toBeVisible();
  await expect(timeline.getByRole('button', { name: /^Hamburg/ })).toBeVisible();
  // The fixes took the restows away: Colombo discharges its boxes and needs none.
  await expect(timeline).toContainText('Colombo · discharging 563 boxes · no restows');
  await page.getByRole('button', { name: 'Playback' }).click();

  // 9. Save and send for review (vessel planner): a new version, and the status In review.
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(toast(page, 'Draft saved'))
    .toContainText('version 15')
    .catch(() => undefined);
  await expect(toast(page, 'Sent for review')).toBeVisible();
  await expect(page.getByTitle('Version 15')).toBeVisible();
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  // 10. Review (senior planner): approves, and the plan is locked.
  await switchRole(page, 'Senior planner');
  // Approve stays focusable when blocked (aria-disabled), so check that it is not blocked.
  await expect(page.getByRole('button', { name: 'Approve' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(toast(page, /^Approved/)).toContainText('is approved and read only.');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import load list' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  // 11. Hand over (terminal planner): exports the approved plan from the plans list.
  await switchRole(page, 'Terminal planner');
  await page.getByRole('link', { name: /all plans/ }).click();
  await page.getByRole('row', { name: /MV Nusantara Pioneer/ }).click();
  await expect(page.getByRole('row', { name: /MV Nusantara Pioneer/ })).toContainText('Approved');
  const download = page.waitForEvent('download');
  await page
    .getByRole('complementary', { name: 'Plan preview' })
    .getByRole('button', { name: 'Export' })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('stowline-plan-042W-SGSIN.json');
  const text = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
  const exported = JSON.parse(text) as {
    schema: string;
    plan: { id: string; status: string; version: number; placements: unknown[] };
    loadList: { plannedSlotKey: string }[];
  };
  expect(exported).toMatchObject({
    schema: 'stowline.plan/1',
    plan: { id: '042W-SGSIN', status: 'approved', version: 15 },
  });
  expect(exported.plan.placements).toHaveLength(2740); // one container placed, and the reefer without a plug unplaced
  expect(exported.loadList.filter((x) => x.plannedSlotKey !== '')).toHaveLength(312);
  // The terminal planner reads, and cannot change the plan.
  await expect(page.getByRole('button', { name: 'Send for review' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revise' })).toHaveCount(0);
});
