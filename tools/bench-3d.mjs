// Measures /bench (NFR-01, NFR-05) on the production build, in a visible Chromium window so the
// real GPU draws. Headless Chromium draws WebGL in software and its numbers mean nothing here.
//
//   npm run build && npm run bench:3d
//   DPR=1 WIDTH=1920 HEIGHT=1080 SECONDS=20 npm run bench:3d
//
// Prints one JSON line. The frame rate cannot exceed the display refresh rate; GPU and CPU time
// per frame show the headroom.
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const width = Number(process.env.WIDTH ?? 1440);
const height = Number(process.env.HEIGHT ?? 900);
const dpr = Number(process.env.DPR ?? 2);
const seconds = Number(process.env.SECONDS ?? 10);

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ headless: false });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.goto('http://localhost:4174/bench');
  await page.waitForFunction(() => (window.__stowBench?.containers ?? 0) > 0, null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__stowBench.reset());
  await page.waitForTimeout(seconds * 1000);
  const report = await page.evaluate(() => {
    const { reset, ...rest } = window.__stowBench;
    void reset;
    return rest;
  });
  console.log(
    JSON.stringify({
      ...report,
      seconds,
      userAgent: await page.evaluate(() => navigator.userAgent),
    }),
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
