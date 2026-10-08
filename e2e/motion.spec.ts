import { expect, test, type Page } from '@playwright/test';
import { openPlanFromList, openPlans, settle, wait3D } from './helpers';

// NFR-15: with reduced motion, every animation on both routes is an instant change or a fade of
// 100 ms or less (FR-66), and the 3D camera jumps instead of flying. AT-09 checks a placement.

/** Records the length of every CSS and Web animation that starts, from the first page load. */
async function recordAnimations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __longest: number; __seen: number; __names: string[] };
    w.__longest = 0;
    w.__seen = 0;
    w.__names = [];
    const scan = () => {
      for (const a of document.getAnimations()) {
        const t = a.effect?.getComputedTiming();
        const ms = Number(t?.duration ?? 0) * Number(t?.iterations ?? 1) + Number(t?.delay ?? 0);
        w.__seen++;
        if (ms > w.__longest) {
          w.__longest = ms;
          w.__names.push(`${(a as CSSAnimation).animationName ?? a.id ?? 'web'} ${ms}`);
        }
      }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  });
}

const longest = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __longest: number; __seen: number; __names: string[] };
    return { longest: w.__longest, seen: w.__seen, names: w.__names };
  });

/** Frames the 3D view draws for one action, until it is at rest. */
async function framesFor(page: Page, action: () => Promise<void>): Promise<number> {
  await settle(page);
  const before = await page.evaluate(() => window.__stowViewport!.frames());
  await action();
  await settle(page);
  return (await page.evaluate(() => window.__stowViewport!.frames())) - before;
}

test('with reduced motion, nothing on either route animates for more than 100 ms (NFR-15)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordAnimations(page);

  // Plans route: the account menu and a dialog.
  await openPlans(page);
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.keyboard.press('Escape');

  // Workspace: the drawer, a violation's Show (camera flight and banner), a preset, playback,
  // the bay gap, and a toast.
  await openPlanFromList(page);
  await wait3D(page);
  await page.getByRole('button', { name: 'Stability', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Stability details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: /^Violations/ }).click();
  const show = await framesFor(page, () =>
    page.getByRole('button', { name: 'Show error · stack weight at 180488' }).click(),
  );
  await page.keyboard.press('Escape');
  const toolbar = page.getByRole('toolbar', { name: '3D view controls' });
  const preset = await framesFor(page, () =>
    toolbar.getByRole('button', { name: 'Top', exact: true }).click(),
  );
  await page.getByRole('button', { name: 'Playback' }).click();
  await page.getByRole('button', { name: /^Jebel Ali/ }).click();
  await page.getByRole('button', { name: 'Playback' }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  await settle(page);

  const { longest: ms, seen, names } = await longest(page);
  expect(seen).toBeGreaterThan(0);
  expect(ms, names.join(', ')).toBeLessThanOrEqual(100);
  // A 600 ms flight draws about 36 frames; a jump draws a handful.
  expect(show).toBeLessThanOrEqual(6);
  expect(preset).toBeLessThanOrEqual(6);
});

test('without reduced motion, the same camera move is animated (control)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlans(page);
  await openPlanFromList(page);
  await wait3D(page);
  const toolbar = page.getByRole('toolbar', { name: '3D view controls' });
  const preset = await framesFor(page, () =>
    toolbar.getByRole('button', { name: 'Top', exact: true }).click(),
  );
  expect(preset).toBeGreaterThan(6);
});
