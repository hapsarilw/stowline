import { test } from 'vitest';
import { SAMPLE_GEOMETRY as G } from './geometry';

const keys = G.slots40();

test('geometry lookups', async ({ bench }) => {
  const exists = bench('slotExists over every slot', () => {
    for (const k of keys) G.slotExists(k);
  });
  const pos = bench('slotPos over every slot', () => {
    for (const k of keys) G.slotPos(k);
  });
  await bench.compare(exists, pos);
});
