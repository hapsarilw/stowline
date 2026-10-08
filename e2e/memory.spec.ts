import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { openWorkspace, settle, wait3D } from './helpers';

// NFR-08: the heap grows less than 10% after 200 commands and 200 undos. Chromium only (the heap
// is read through the DevTools protocol, after a forced garbage collection). The commands are
// keyboard moves in the bay grid, so every layer runs: the store, the rule check, the bay view
// and the 3D instances.

async function heap(cdp: CDPSession): Promise<number> {
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize;
}

const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true });

/** One command: pick up the focused container; focus goes to the first valid target; place it. */
async function move(page: Page) {
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-ghost')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('held-ghost')).toHaveCount(0);
}

/** 200 commands, then 200 undos. Returns how many commands were made. */
async function round(page: Page): Promise<number> {
  await page.locator('#bay-cell-180488').click();
  let commands = 0;
  for (let i = 0; i < 200; i++) {
    await move(page);
    commands++;
  }
  for (let i = 0; i < 200; i++) await page.keyboard.press('Control+Z');
  await expect(undo(page)).toBeDisabled();
  await expect(
    page.getByRole('tab', { name: /^Violations/ }).getByText(/^\d+ violations$/),
  ).toHaveText('7 violations');
  await settle(page);
  return commands;
}

test('the heap grows less than 10% after 200 commands and 200 undos (NFR-08)', async ({ page }) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);
  await wait3D(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  await settle(page);

  // The first round is a warm-up: V8 compiles the hot paths then, about 3.6 MB of optimized
  // code that it keeps (heap snapshot, M7). The second round shows what the app itself keeps.
  const cold = await heap(cdp);
  await round(page);
  const before = await heap(cdp);
  const commands = await round(page);
  const after = await heap(cdp);

  const growth = (after - before) / before;
  console.log(
    JSON.stringify({
      commands,
      undos: 200,
      heap_cold_MB: +(cold / 1e6).toFixed(2),
      heap_after_warm_up_MB: +(before / 1e6).toFixed(2),
      heap_after_MB: +(after / 1e6).toFixed(2),
      warm_up_growth_percent: +(((before - cold) / cold) * 100).toFixed(2),
      growth_percent: +(growth * 100).toFixed(2),
    }),
  );
  expect(commands).toBe(200);
  expect(growth).toBeLessThan(0.1);
});
