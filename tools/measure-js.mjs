// Measures the JavaScript a route loads, in gzip bytes, on the production build (NFR-06).
//
//   npm run build && npm run measure:js            (the plans route)
//   npm run build && npm run measure:js /plans/042W-SGSIN
//
// Prints each script the page requests, the app alone and the total, and fails when a limit is
// passed. Limits (owner decision D14, Oct 8, 2026): the app 200 kB gzip; the whole route 300 kB
// while the mock API (Mock Service Worker) is in the browser.
import { readFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const route = process.argv[2] ?? '/plans';
const APP_LIMIT = 200_000;
const TOTAL_LIMIT = 300_000;

// The chunk of the mock API, from the build manifest.
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const mockFile = manifest['src/api/mock/browser.ts']?.file?.split('/').pop();
if (!mockFile)
  throw new Error('No mock chunk in dist/.vite/manifest.json. Run npm run build first.');
const server = await preview({ preview: { port: 4177, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const bodies = new Map();
  page.on('response', async (res) => {
    if (res.request().resourceType() === 'script' && res.url().includes('/assets/'))
      bodies.set(res.url(), await res.body());
  });
  await page.goto(`http://localhost:4177${route}`);
  await page.getByRole('heading').first().waitFor();
  await page.waitForTimeout(1500);
  const sizes = [];
  for (const [url, body] of bodies) {
    const chunks = [];
    await new Promise((resolve) =>
      Readable.from(body)
        .pipe(createGzip())
        .on('data', (c) => chunks.push(c))
        .on('end', resolve),
    );
    sizes.push([url.split('/').pop(), Buffer.concat(chunks).length]);
  }
  sizes.sort((a, b) => b[1] - a[1]);
  const total = sizes.reduce((n, [, s]) => n + s, 0);
  const mock = sizes.filter(([n]) => n === mockFile).reduce((n, [, s]) => n + s, 0);
  const app = total - mock;
  const kB = (n) => +(n / 1000).toFixed(1);
  // NFR-06 limits the plans route; the workspace adds the 3D chunk, which has its own limit.
  const checked = route === '/plans';
  const ok = !checked || (app <= APP_LIMIT && total <= TOTAL_LIMIT);
  console.log(
    JSON.stringify(
      {
        route,
        app_kB_gzip: kB(app),
        mock_kB_gzip: kB(mock),
        total_kB_gzip: kB(total),
        limits_kB_gzip: checked
          ? { app: kB(APP_LIMIT), total: kB(TOTAL_LIMIT) }
          : 'none for this route',
        result: checked ? (ok ? 'pass' : 'fail') : 'not checked',
        scripts: sizes.map(
          ([n, s]) => `${n} ${(s / 1000).toFixed(1)}${n === mockFile ? ' (mock API)' : ''}`,
        ),
      },
      null,
      1,
    ),
  );
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.httpServer.close();
}
