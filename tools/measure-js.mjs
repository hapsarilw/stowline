// Measures the JavaScript a route loads, in gzip bytes, on the production build (NFR-06).
//
//   npm run build && node tools/measure-js.mjs /plans
//
// Prints each script the page requests and the total.
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const route = process.argv[2] ?? '/plans';
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
  console.log(
    JSON.stringify(
      {
        route,
        total_kB_gzip: +(total / 1000).toFixed(1),
        scripts: sizes.map(([n, s]) => `${n} ${(s / 1000).toFixed(1)}`),
      },
      null,
      1,
    ),
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
