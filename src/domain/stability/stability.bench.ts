import { test } from 'vitest';
import { createStowContext } from '../plan/context';
import { createStowState } from '../plan/state';
import { generateBenchCall } from '../sample/bench';
import { sampleSetup } from '../testing/fixtures';
import { calibrateStability, computeStability } from './model';

// The stability model runs from the whole plan after each command, and once per hovered
// slot in a drag preview (FR-51), so its cost matters for M4.

const sample = sampleSetup();
const sampleBase = calibrateStability(sample.state, sample.ctx);
const big = generateBenchCall();
const bigCtx = createStowContext({
  vessel: big.vessel,
  containers: big.containers,
  placements: big.placements,
});
const bigState = createStowState(big.placements);
const bigBase = calibrateStability(bigState, bigCtx);

test('stability model', async ({ bench }) => {
  const a = bench('sample plan, 2,740 containers', () => {
    computeStability(sample.state, sample.ctx, sampleBase);
  });
  const b = bench('benchmark vessel, 10,000 containers', () => {
    computeStability(bigState, bigCtx, bigBase);
  });
  await bench.compare(a, b);
});
