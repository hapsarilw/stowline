import { expect, test, type Page } from '@playwright/test';
import { openPlans, openWorkspace, wait3D } from './helpers';

// NFR-10: a keyboard walk through each route. Tab goes through every control and comes back to
// the start (no trap), each stop shows a focus ring, and the order goes region by region,
// never back to a region it has left.

interface Stop {
  name: string;
  region: string;
  ring: boolean;
  visible: boolean;
}

async function walk(page: Page, limit = 400): Promise<Stop[]> {
  await page.locator('body').focus();
  const stops: Stop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const hasRing = (x: Element | null) => {
        if (!x) return false;
        const s = getComputedStyle(x);
        return (
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
        );
      };
      // The ring may be on the control, on the field around an input, or on the active cell or
      // row of a grid (aria-activedescendant).
      const active = el.getAttribute('aria-activedescendant');
      const ring =
        hasRing(el) ||
        hasRing(el.closest('label')) ||
        (active !== null && hasRing(document.getElementById(active)));
      const r = el.getBoundingClientRect();
      // The outermost landmark: a nav in the header, or the 3D view in the workspace, is part
      // of it, so moving between them is not leaving it.
      let outer: Element | null = null;
      for (let x: Element | null = el; x; x = x.parentElement)
        if (x.matches('header, nav, main, aside, footer, [role=region], section')) outer = x;
      const region = outer
        ? (outer.getAttribute('aria-label') ?? outer.tagName.toLowerCase())
        : 'page';
      const name = (
        el.getAttribute('aria-label') ??
        el.textContent ??
        el.getAttribute('placeholder') ??
        el.tagName
      )
        .trim()
        .slice(0, 40);
      if (!el.dataset.walk) el.dataset.walk = String(Math.random());
      return {
        id: el.dataset.walk,
        name: `${el.getAttribute('role') ?? el.tagName.toLowerCase()} "${name}"`,
        region,
        ring,
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (!stop) {
      // Focus left the page content: the walk has wrapped round.
      if (stops.length) break;
      continue;
    }
    if (seen.has(stop.id)) break;
    seen.add(stop.id);
    stops.push(stop);
  }
  return stops;
}

/** The regions in the order the walk entered them. A region entered twice is out of order. */
function revisits(stops: Stop[]): string[] {
  const order: string[] = [];
  for (const s of stops) if (order.at(-1) !== s.region) order.push(s.region);
  return order.filter((r, i) => order.indexOf(r) !== i);
}

const problems = (stops: Stop[]) =>
  stops.filter((s) => !s.ring || !s.visible).map((s) => `${s.name} in ${s.region}`);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('plans list: Tab reaches every control, shows a focus ring and wraps round (NFR-10)', async ({
  page,
}) => {
  await openPlans(page);
  // Focus rings are drawn for keyboard focus only (:focus-visible); the walk is keyboard.
  const stops = await walk(page);
  expect(stops.length).toBeGreaterThan(10);
  expect(stops.length).toBeLessThan(400);
  expect(problems(stops)).toEqual([]);
  expect(revisits(stops)).toEqual([]);
  const names = stops.map((s) => s.name).join('\n');
  for (const control of ['New plan', 'Search', 'Open plan', 'Account'])
    expect(names).toContain(control);
});

test('workspace: Tab reaches every control, shows a focus ring and wraps round (NFR-10)', async ({
  page,
}) => {
  await openWorkspace(page);
  await wait3D(page);
  const stops = await walk(page);
  expect(stops.length).toBeLessThan(400);
  expect(problems(stops)).toEqual([]);
  expect(revisits(stops)).toEqual([]);
  const names = stops.map((s) => s.name).join('\n');
  // Undo, Redo and Save are disabled until there is a change; AT-03 reaches Save by keyboard.
  for (const control of [
    'Validate',
    'Send for review',
    'Account',
    'Import load list',
    'Search load list',
    'Containers to load',
    'Split',
    'Iso',
    'Playback',
    'Resize 3D and bay view',
    'Bay 18 cross section',
    'Inspector',
    'Bay 02',
    'Stability',
  ])
    expect(names).toContain(control);
});

test('a dialog keeps focus inside until Esc, then gives it back (NFR-10)', async ({ page }) => {
  await openPlans(page);
  const opener = page.getByRole('button', { name: 'New plan' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'New plan' });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('with no pointer: choose a plan, open it, resize the views and switch theme (NFR-10)', async ({
  page,
}) => {
  await openPlans(page);
  const row = page.getByRole('row', { name: /MV Arafura Dawn/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-selected', 'true');
  const first = page.getByRole('row', { name: /MV Nusantara Pioneer/ });
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  const open = page.getByRole('button', { name: 'Open plan' });
  for (let i = 0; i < 30 && !(await open.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Load list' }).waitFor();

  const bar = page.getByRole('separator', { name: 'Resize 3D and bay view' });
  await bar.focus();
  const before = Number(await bar.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowDown');
  await expect(bar).toHaveAttribute('aria-valuenow', String(before + 2));
  await page.keyboard.press('Home');
  await expect(bar).toHaveAttribute('aria-valuenow', (await bar.getAttribute('aria-valuemin'))!);

  await page.getByRole('button', { name: 'Switch to light theme' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
