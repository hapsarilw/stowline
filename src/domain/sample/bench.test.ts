import { describe, expect, it } from 'vitest';
import { createGeometry } from '../geometry';
import { createStowContext } from '../plan/context';
import { createStowState } from '../plan/state';
import { validateAll } from '../rules/validate';
import { generateBenchCall } from './bench';

describe('benchmark vessel', () => {
  const call = generateBenchCall();

  it('holds 10,000 containers in 10,200 forty-foot slots', () => {
    expect(createGeometry(call.vessel).slotCount40()).toBe(10200);
    expect(call.containers).toHaveLength(10000);
    expect(new Set(call.containers.map((c) => c.id)).size).toBe(10000);
    expect(call.placements.filter((p) => p.half !== 'both').length).toBeGreaterThan(0);
  });

  it('is a valid plan: no stack, reefer, overstow or 20/40 errors', () => {
    const ctx = createStowContext({
      vessel: call.vessel,
      containers: call.containers,
      placements: call.placements,
    });
    const geometry = ctx.geometry;
    expect(call.placements.every((p) => geometry.slotExists(p.slotKey))).toBe(true);
    const v = validateAll(createStowState(call.placements), ctx);
    expect(v.filter((x) => x.rule !== 'dg' && x.rule !== 'heavy')).toEqual([]);
  });

  it('is deterministic', () => {
    expect(generateBenchCall()).toEqual(call);
  });
});
