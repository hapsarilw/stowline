// Times the workspace load on the end-to-end build: when each request and script starts and
// ends, and when the 3D view is ready (M7). Run npm run build:e2e first. The mock API waits
// 150 to 400 ms per request at random, so the result is the median of RUNS loads (default 15).
//
//   RUNS=15 node tools/load-waterfall.mjs
//   NETWORK=fast4g node tools/load-waterfall.mjs   (165 ms round trip, 9 Mbps down, 1.5 Mbps up)
//   COLD=1 node tools/load-waterfall.mjs           (a first visit each time)
import { chromium } from '@playwright/test';
import { preview } from 'vite';
const server = await preview({
  root: process.cwd(),
  build: { outDir: 'dist-e2e' },
  preview: { port: 4176, strictPort: true },
  logLevel: 'error',
});
const browser = await chromium.launch({ headless: false });
try {
  // COLD=1: a new browser profile for every load, as a first visit (empty cache, no service
  // worker yet). Otherwise one warmed profile, as a person coming back.
  const cold = process.env.COLD === '1';
  const fresh = () => browser.newContext({ viewport: { width: 1440, height: 900 } });
  let context = await fresh();
  if (!cold) {
    const warm = await context.newPage();
    await warm.goto('http://localhost:4176/plans/042W-SGSIN');
    await warm.waitForFunction(() => window.__stowViewport !== undefined, null, {
      timeout: 60000,
    });
    await warm.close();
  }
  const runs = Number(process.env.RUNS ?? 15);
  const ready = [];
  for (let run = 0; run < runs; run++) {
    if (cold && run > 0) {
      await context.close();
      context = await fresh();
    }
    const page = await context.newPage();
    if (process.env.NETWORK === 'fast4g') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 165,
        downloadThroughput: (9000 * 1000) / 8,
        uploadThroughput: (1500 * 1000) / 8,
      });
    }
    await page.goto('http://localhost:4176/plans/042W-SGSIN');
    await page.waitForFunction(() => window.__stowViewport !== undefined, null, { timeout: 60000 });
    const out = await page.evaluate(() => {
      const rows = performance
        .getEntriesByType('resource')
        .filter((e) => /\/api\/|\/assets\/.*\.js/.test(e.name))
        .map(
          (e) =>
            `${e.startTime.toFixed(0).padStart(5)} → ${e.responseEnd.toFixed(0).padStart(5)}  ${e.name.replace(location.origin, '')}`,
        );
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        ready: performance.now().toFixed(0),
        dcl: nav.domContentLoadedEventEnd.toFixed(0),
        rows,
      };
    });
    ready.push(Number(out.ready));
    if (run === 0) console.log(out.rows.join('\n'));
    await page.close();
  }
  ready.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      runs,
      network: process.env.NETWORK ?? 'none',
      visit: cold ? 'first' : 'returning',
      ready_ms_median: ready[Math.floor(runs / 2)],
      ready_ms_min: ready[0],
      ready_ms_max: ready[runs - 1],
    }),
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
