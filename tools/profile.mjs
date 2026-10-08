// Profiles the main thread while a scenario runs, and prints where the time goes (M7, NFR-01 to
// NFR-08). Runs in a visible Chromium so the real GPU draws.
//
//   node tools/profile.mjs plans|workspace|commands|bench   (dev server: readable names)
//   npm run build:e2e && PROD=1 node tools/profile.mjs ...  (production code: real numbers)
//
// plans, workspace and bench profile a page load until it is ready; commands profiles 20
// keyboard moves and 20 undos in a loaded workspace. Prints one JSON object: wall time, long
// tasks, and the self time of the top functions and source files, from the V8 sampling profiler
// (0.1 ms interval). PROD serves dist-e2e: production code with the test hooks.
import { existsSync, readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { chromium } from '@playwright/test';
import { createServer, preview } from 'vite';

const scenario = process.argv[2] ?? 'workspace';
const prod = process.env.PROD === '1';
const port = 4175;
const server = prod
  ? await preview({
      build: { outDir: 'dist-e2e' },
      preview: { port, strictPort: true },
      logLevel: 'error',
    })
  : await (await createServer({ server: { port, strictPort: true }, logLevel: 'error' })).listen();
const base = `http://localhost:${port}`;

const SCENARIOS = {
  plans: {
    url: '/plans',
    ready: (page) => page.getByRole('row', { name: /MV Nusantara Pioneer/ }).waitFor(),
  },
  workspace: {
    url: '/plans/042W-SGSIN',
    ready: async (page) => {
      await page.waitForFunction(() => window.__stowViewport !== undefined, null, {
        timeout: 60_000,
      });
      await idle(page);
    },
  },
  commands: {
    url: '/plans/042W-SGSIN',
    ready: async (page) => {
      await page.waitForFunction(() => window.__stowViewport !== undefined, null, {
        timeout: 60_000,
      });
      await idle(page);
      await page.locator('#bay-cell-180488').click();
    },
    act: async (page) => {
      const ghost = page.getByTestId('held-ghost');
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Enter');
        await ghost.waitFor();
        await page.keyboard.press('Enter');
        await ghost.waitFor({ state: 'detached' });
      }
      for (let i = 0; i < 20; i++) await page.keyboard.press('Control+Z');
      await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled();
      await idle(page);
    },
  },
  bench: {
    url: '/bench',
    ready: async (page) => {
      await page.waitForFunction(() => (window.__stowBench?.containers ?? 0) > 0, null, {
        timeout: 60_000,
      });
      // Five seconds of orbiting frames.
      await page.waitForTimeout(5000);
    },
  },
};

/** Resolves when the main thread has been idle once (no task pending). */
const idle = (page) =>
  page.evaluate(() => new Promise((r) => requestIdleCallback(() => r(null), { timeout: 20_000 })));

const maps = new Map();
/** The source map of a built script, from dist-e2e. */
function sourceMap(path) {
  if (!maps.has(path)) {
    const file = `dist-e2e${path}.map`;
    maps.set(path, existsSync(file) ? new SourceMap(JSON.parse(readFileSync(file, 'utf8'))) : null);
  }
  return maps.get(path);
}

const s = SCENARIOS[scenario];
if (!s) throw new Error(`Unknown scenario ${scenario}: ${Object.keys(SCENARIOS).join(', ')}`);

const browser = await chromium.launch({ headless: false });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // A first visit installs the mock API's service worker; profile the second, as a person
  // coming back would see it.
  const warm = await context.newPage();
  await warm.goto(base + s.url);
  await s.ready(warm);
  await warm.close();

  const page = await context.newPage();
  await page.addInitScript(() => {
    const w = window;
    w.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  if (s.act) {
    await page.goto(base + s.url);
    await s.ready(page);
    await page.evaluate(() => (window.__long.length = 0));
  }
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  if (s.act) await s.act(page);
  else {
    await page.goto(base + s.url);
    await s.ready(page);
  }
  const wall = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const longTasks = await page.evaluate(() => window.__long);

  // Self time per node: samples times the interval between them.
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i + 1] ?? 0) / 1000));
  const byFn = new Map();
  const byFile = new Map();
  for (const n of profile.nodes) {
    const ms = self.get(n.id) ?? 0;
    if (!ms) continue;
    const f = n.callFrame;
    let file = f.url
      ? f.url.replace(base, '').replace(/\?.*$/, '')
      : `(${f.functionName || 'native'})`;
    let fn = `${f.functionName || '(anonymous)'} ${file}:${f.lineNumber + 1}`;
    // Production code: the source map gives the source file and line (build with --sourcemap).
    // findEntry takes the 0-based line and column the profiler reports.
    const entry = prod && f.url ? sourceMap(file)?.findEntry(f.lineNumber, f.columnNumber) : null;
    if (entry && 'originalSource' in entry) {
      file = entry.originalSource.replace(/^.*?\/(src|node_modules)\//, '$1/');
      fn = `${entry.name || f.functionName || '(anonymous)'} ${file}:${entry.originalLine + 1}`;
    }
    byFn.set(fn, (byFn.get(fn) ?? 0) + ms);
    byFile.set(file, (byFile.get(file) ?? 0) + ms);
  }
  const top = (m, n) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${v.toFixed(1)} ms  ${k}`);
  const busy = [...byFile]
    .filter(([k]) => k !== '(idle)' && k !== '(program)')
    .reduce((a, [, v]) => a + v, 0);
  console.log(
    JSON.stringify(
      {
        scenario,
        build: prod ? 'production' : 'dev server',
        wall_ms: wall,
        script_ms: Math.round(busy),
        long_tasks: {
          count: longTasks.length,
          total_ms: longTasks.reduce((a, b) => a + b, 0),
          max_ms: Math.max(0, ...longTasks),
        },
        top_files: top(byFile, 12),
        top_functions: top(byFn, 20),
        userAgent: await page.evaluate(() => navigator.userAgent),
      },
      null,
      1,
    ),
  );
} finally {
  await browser.close();
  await (server.close?.() ?? server.httpServer.close());
}
