import { expect, test } from '@playwright/test';
import type * as Client from '../src/worker/client';
import type * as Domain from '../src/domain';
import type {} from '../src/features/viewport3d/scene/Picking';

// FR-41 and NFR-04: full validation runs in a Web Worker, under 200 ms, with no main thread
// task over 50 ms. Uses the dev server, which serves unbundled modules: a conservative setting.

test('full validation of 10,000 containers runs in the worker', async ({ page }) => {
  await page.goto('/plans/042W-SGSIN');
  // Let the 3D view finish loading first: its start-up is not part of this measurement.
  await page.waitForFunction(() => window.__stowViewport !== undefined, null, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  const result = await page.evaluate(async () => {
    const clientUrl = '/src/worker/client.ts';
    const domainUrl = '/src/domain/index.ts';
    const { createValidationClient } = (await import(
      /* @vite-ignore */ clientUrl
    )) as typeof Client;
    const { generateBenchCall, generateSampleCall } = (await import(
      /* @vite-ignore */ domainUrl
    )) as typeof Domain;

    const client = createValidationClient();
    const sample = generateSampleCall();
    const golden = await client.api.validate({
      vessel: sample.vessel,
      containers: [...sample.containers, ...sample.loadList.map((x) => x.container)],
      placements: sample.plan.placements,
    });

    const bench = generateBenchCall();
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push(e.duration);
    });
    observer.observe({ type: 'longtask' });

    const runs: { roundTrip: number; worker: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const report = await client.api.validate(bench);
      runs.push({ roundTrip: performance.now() - t0, worker: report.durationMs });
    }
    await new Promise((r) => setTimeout(r, 100));
    observer.disconnect();
    client.terminate();
    return { golden: golden.violations.length, errors: golden.errors, runs, longTasks };
  });

  console.log(JSON.stringify(result));
  expect(result.golden).toBe(7);
  expect(result.errors).toBe(6);
  for (const run of result.runs) expect(run.roundTrip).toBeLessThan(200);
  expect(result.longTasks.filter((d) => d > 50)).toEqual([]);
});
