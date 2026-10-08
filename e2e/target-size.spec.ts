import { expect, test, type Page } from '@playwright/test';
import { openPlans, openWorkspace } from './helpers';

// NFR-13: every target is 24 x 24 px or more. A target may be smaller to look at when an
// invisible hit area makes it 24 px, so this checks the point 11 px from the center in each
// direction, not just the box.
//
// Not checked: the cells of the bay grid in Split are about 14 px high. The same function is
// in the Bay view (checked below) and on the keyboard, which is the "equivalent control"
// exception of WCAG 2.5.8. Rows of the load list are 32 px.

const TARGETS =
  'a[href], button, [role=tab], [role=checkbox], [role=menuitemradio], [role=menuitemcheckbox], [role=row][tabindex], input, textarea, select, [role=separator], [role=option], [id^="bay-cell-"]';

async function tooSmall(page: Page, includeCells: boolean, only = TARGETS) {
  return page.evaluate(
    ({ selector, includeCells }) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll(selector)) {
        if (!includeCells && el.id.startsWith('bay-cell-')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // A row that is only partly scrolled into view has its hit area cut off by the list.
        const scroller = el.closest('[role=grid]')?.getBoundingClientRect();
        if (scroller && (cy - 12 < scroller.top || cy + 12 > scroller.bottom)) continue;
        const hits = (x: number, y: number) => {
          const at = document.elementFromPoint(x, y);
          return at !== null && (el === at || el.contains(at));
        };
        const ok =
          (r.width >= 24 || (hits(cx - 11, cy) && hits(cx + 11, cy))) &&
          (r.height >= 24 || (hits(cx, cy - 11) && hits(cx, cy + 11)));
        if (!ok) {
          const name = el.getAttribute('aria-label') ?? el.textContent ?? el.tagName;
          out.push(
            `${el.getAttribute('role') ?? el.tagName} "${name.slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return out;
    },
    { selector: only, includeCells },
  );
}

test('workspace targets are 24 px or more, in Split', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  expect(await tooSmall(page, false)).toEqual([]);
  // An open filter list covers part of the load list, so check its options on their own.
  await page.getByRole('button', { name: 'POD' }).first().click();
  expect(await page.getByRole('listbox').getByRole('option').count()).toBe(5);
  expect(await tooSmall(page, false, '[role=listbox] [role=option]')).toEqual([]);
});

test('workspace targets, including every bay cell, are 24 px or more in the Bay view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await page.getByRole('tab', { name: 'Bay', exact: true }).click();
  expect(await tooSmall(page, true)).toEqual([]);
});

test('plans route targets, the New plan dialog and the account menu are 24 px or more', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlans(page);
  expect(await tooSmall(page, false)).toEqual([]);
  await page.getByRole('button', { name: /^Account:/ }).click();
  expect(await tooSmall(page, false, `[role=menu] :is(${TARGETS})`)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New plan' }).click();
  expect(await tooSmall(page, false, `[role=dialog] :is(${TARGETS})`)).toEqual([]);
});
