import { test } from 'vitest';
import { applyCommand } from '../commands/commands';
import { createStowContext } from '../plan/context';
import { createStowState } from '../plan/state';
import { generateBenchCall } from '../sample/bench';
import type { Command } from '../types';
import { nextFreeSlots } from './placement';
import { revalidate, validateAll } from './validate';

// NFR-03: rule check after one command, under 10 ms.
// NFR-04: full validation, under 200 ms (here on the main thread of Node, without the worker).
// Benchmark vessel with 10,000 containers.

const call = generateBenchCall();
const ctx = createStowContext({
  vessel: call.vessel,
  containers: call.containers,
  placements: call.placements,
});
const state = createStowState(call.placements);
const violations = validateAll(state, ctx);

// A valid move of a deck top container to the next free slot in a nearby bay.
const from = call.placements.filter((p) => p.slotKey.slice(4) === '96')[0]!.slotKey;
const move: Command = (() => {
  for (const to of nextFreeSlots(state, ctx, 40)) {
    const cmd: Command = { kind: 'move', from, to };
    if (applyCommand(state, ctx, cmd).ok) return cmd;
  }
  throw new Error('No valid move on the benchmark vessel');
})();

test('rule engine, 10,000 containers', async ({ bench }) => {
  const incremental = bench(
    'one command: apply with the rule check, then incremental check',
    () => {
      const r = applyCommand(state, ctx, move);
      if (!r.ok) throw new Error(r.reason);
      revalidate(violations, r.state, ctx, r.touched);
    },
  );
  const full = bench('full validation', () => {
    validateAll(state, ctx);
  });
  const results = await bench.compare(incremental, full);
  for (const name of [incremental.name, full.name]) {
    const { latency } = results.get(name);
    const ms = (n: number) => `${n.toFixed(3)} ms`;
    console.log(
      `${name}: mean ${ms(latency.mean)}, p99 ${ms(latency.p99)}, max ${ms(latency.max)}`,
    );
  }
});
