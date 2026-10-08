import { describe, expect, it } from 'vitest';
import { calibrateStability, computeStability } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { IDLE, marksFor, pendingCommand, step, type World } from '@/state/placement';
import { deltaLabels, previewDelta, signed } from './preview';

const { ctx, state } = sampleSetup();
const base = calibrateStability(state, ctx);
const current = computeStability(state, ctx, base);
const world: World = { state, ctx, bay: 18 };

describe('target marks (FR-34)', () => {
  it('marks nothing when nothing is held', () => {
    expect(marksFor(IDLE, world).size).toBe(0);
  });

  it('marks the next free slot of each stack, and the origin', () => {
    const held = step(IDLE, { type: 'pickFromSlot', key: '180488', via: 'keyboard' }, world).next;
    const marks = marksFor(held, world);
    expect(marks.get('180488')).toEqual({ mark: 'origin' });
    const kinds = new Set([...marks.values()].map((m) => m.mark));
    expect(kinds.has('valid')).toBe(true);
    expect(kinds.has('invalid')).toBe(true);
    for (const [key, m] of marks) if (m.mark !== 'origin') expect(key.startsWith('18')).toBe(true);
  });

  it('gives the reason of an invalid target, as the tooltip shows it', () => {
    const held = step(
      IDLE,
      { type: 'pickFromList', containerId: 'NSPU 551208 4', via: 'pointer' },
      world,
    ).next;
    expect(marksFor(held, world).get('180688')).toMatchObject({
      mark: 'invalid',
      reason: 'Stack limit: 96.4 t of 90.0 t',
    });
  });
});

describe('stability preview (FR-51)', () => {
  it('is empty when nothing is over a target', () => {
    expect(previewDelta(IDLE, state, ctx, base, current)).toBeNull();
    const held = step(
      IDLE,
      { type: 'pickFromList', containerId: 'NSPU 551208 4', via: 'pointer' },
      world,
    ).next;
    expect(previewDelta(held, state, ctx, base, current)).toBeNull();
    const notTarget = step(held, { type: 'hover', key: '180486' }, world).next;
    expect(pendingCommand(notTarget)).toBeNull();
  });

  it('is the model run on the plan with the candidate command, minus the plan now', () => {
    const held = step(
      IDLE,
      { type: 'pickFromList', containerId: 'NSPU 551208 4', via: 'pointer' },
      world,
    ).next;
    const over = step(held, { type: 'hover', key: '180688' }, world).next;
    const d = previewDelta(over, state, ctx, base, current)!;
    // Adding weight high up on deck lowers GM.
    expect(d.gm).toBeLessThan(0);
    expect(Number.isFinite(d.trim) && Number.isFinite(d.list)).toBe(true);
  });

  it('prints deltas as the design does', () => {
    expect(signed(0.04)).toBe('+0.04');
    expect(signed(-0.0021, 3)).toBe('−0.002');
    expect(deltaLabels({ gm: -0.0042, trim: 0.041, list: -0.01 })).toEqual({
      gm: '−0.004',
      trim: '+0.04 m',
      list: '−0.01°',
    });
  });
});
