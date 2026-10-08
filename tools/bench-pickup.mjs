// Measures NFR-02 (target marks within 100 ms of a pick-up) on the production build, in a
// visible Chromium window.
//
//   npm run build && npm run bench:pickup
//   RUNS=40 npm run bench:pickup
//
// Each run picks up a container and waits for the "nfr-02 target marks" measure the bay view
// records two frames after the marks render. Two numbers per run:
//   handler: from the pick-up handler to that frame (the app's own work and the paint);
//   input:   from the input event's timestamp to that frame (adds the browser's input delay).
// Three paths: Enter on a load list row, Enter on a bay cell, and a pointer drag from a row.
// Prints one JSON line.
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const runs = Number(process.env.RUNS ?? 20);
const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ headless: false });

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    runs: s.length,
    median: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
  };
};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // The input that picks up: a key press, or the first pointer move after a press.
  await page.addInitScript(() => {
    window.__input = 0;
    let armed = false;
    window.addEventListener('keydown', (e) => (window.__input = e.timeStamp), true);
    window.addEventListener('pointerdown', () => (armed = true), true);
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!armed) return;
        armed = false;
        window.__input = e.timeStamp;
      },
      true,
    );
  });
  await page.goto('http://localhost:4175/plans/042W-SGSIN');
  await page.getByRole('heading', { name: 'Load list' }).waitFor();
  await page.waitForTimeout(1500);

  const take = async (label) => {
    if (process.env.DEBUG)
      console.error(
        label,
        await page.evaluate(
          () => document.querySelector('[aria-label="Bay view"] [role=status]')?.textContent,
        ),
      );
    const h = await page.waitForFunction(() => {
      const e = performance.getEntriesByName('nfr-02 target marks').at(-1);
      return e ? { handler: e.duration, input: e.startTime + e.duration - window.__input } : null;
    });
    const r = await h.jsonValue();
    await page.evaluate(() => performance.clearMeasures('nfr-02 target marks'));
    return r;
  };
  const result = {};
  const list = page.getByRole('grid', { name: 'Containers to load' });

  // 1. Enter on a load list row (FR-17).
  const fromList = [];
  for (let i = 0; i < runs; i++) {
    await list.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    fromList.push(await take(`list ${i}`));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  // 2. Enter on a bay cell (FR-36).
  const fromSlot = [];
  for (let i = 0; i < runs; i++) {
    await page.locator('#bay-cell-180488').click();
    await page.keyboard.press('Enter');
    fromSlot.push(await take(`slot ${i}`));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  // 3. A pointer drag from a load list row (FR-31). Back to the top of the list first.
  await list.focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(200);
  const drag = [];
  for (let i = 0; i < runs; i++) {
    const b = await page.locator('#ll-row-1').boundingBox();
    await page.mouse.move(b.x + 60, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 72, b.y + b.height / 2 + 4, { steps: 2 });
    drag.push(await take(`drag ${i}`));
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(250);
  }

  for (const [name, xs] of Object.entries({ fromList, fromSlot, drag }))
    result[name] = {
      handler: stats(xs.map((x) => x.handler)),
      input: stats(xs.map((x) => x.input)),
    };
  console.log(
    JSON.stringify({ ...result, userAgent: await page.evaluate(() => navigator.userAgent) }),
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
