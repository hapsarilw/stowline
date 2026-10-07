import { describe, expect, it } from 'vitest';
import { box, customSetup, sampleSetup } from '../testing/fixtures';
import { checkPlacement, nextFreeSlots } from './placement';

// SRS "Placement check": it runs in order and stops at the first structural failure.

describe('placement check, structure', () => {
  const { ctx, state } = customSetup([{ key: '180282', c: box({ weightT: 20 }) }]);

  it('1. refuses a slot that does not exist', () => {
    expect(checkPlacement(state, ctx, box(), '021186')).toMatchObject({
      target: false,
      valid: false,
      reason: 'Slot does not exist',
    });
  });

  it('1. refuses a 40ft container in a 20ft slot, and a 20ft in a 40ft slot', () => {
    expect(checkPlacement(state, ctx, box(), '170482').reason).toBe(
      'A 40ft container needs a 40ft slot',
    );
    expect(checkPlacement(state, ctx, box({ type: '20GP' }), '180482').reason).toBe(
      'A 20ft container needs a 20ft slot',
    );
  });
});

describe('placement check, occupancy and support', () => {
  const a = box({ id: 'NSPU 100001 1' });
  const t = box({ id: 'NSPU 100002 2', type: '20GP' });
  const { ctx, state } = customSetup([
    { key: '180282', c: a },
    { key: '170482', c: t },
  ]);

  it('2. refuses an occupied slot, including one half of it', () => {
    expect(checkPlacement(state, ctx, box(), '180282').reason).toBe('Slot is occupied');
    expect(checkPlacement(state, ctx, box({ type: '20GP' }), '170282').reason).toBe(
      'Slot is occupied',
    );
    expect(checkPlacement(state, ctx, box(), '180482').reason).toBe('Slot is occupied');
  });

  it('2. ignores the container being moved', () => {
    expect(checkPlacement(state, ctx, a, '180282', '180282').target).toBe(true);
  });

  it('3. needs the lowest tier or a container directly below', () => {
    expect(checkPlacement(state, ctx, box(), '180286').reason).toBe('No container below this slot');
    expect(checkPlacement(state, ctx, box(), '180284').target).toBe(true);
    expect(checkPlacement(state, ctx, box(), '180682').target).toBe(true);
    // A 20ft needs its own half filled below: the aft half of 18-04 is empty.
    expect(checkPlacement(state, ctx, box({ type: '20GP' }), '190484').reason).toBe(
      'No container below this slot',
    );
    expect(checkPlacement(state, ctx, box({ type: '20GP' }), '170484').target).toBe(true);
  });

  it('3. does not count the container being moved as support', () => {
    expect(checkPlacement(state, ctx, a, '180284', '180282').reason).toBe(
      'No container below this slot',
    );
  });
});

describe('placement check, rules', () => {
  it('4. reports the first failing rule from R1 to R5 as the reason', () => {
    const { ctx, state } = customSetup([
      { key: '020182', c: box({ weightT: 30, pod: 'LKCMB' }) },
      { key: '020184', c: box({ weightT: 30, pod: 'LKCMB' }) },
    ]);
    const c = checkPlacement(state, ctx, box({ type: 'RF', weightT: 31, pod: 'DEHAM' }), '020186');
    expect(c.valid).toBe(false);
    expect(c.errors.map((e) => e.rule)).toEqual(['stack', 'reefer', 'overstow']);
    expect(c.reason).toBe('Stack limit: 91.0 t of 90.0 t');
    expect(c.errors[2]!.message).toBe('Overstow: CMB box below, 1 restow');
  });

  it('4. checks dangerous goods against the neighbours, across bays', () => {
    const { ctx, state } = customSetup([{ key: '180282', c: box({ imdgClass: '3' }) }]);
    const c = checkPlacement(state, ctx, box({ imdgClass: '5.1' }), '220282');
    expect(c.errors).toEqual([{ rule: 'dg', message: 'IMDG 5.1 next to IMDG 3' }]);
  });

  it('4. checks 20ft on 40ft and 40ft on a half-empty 20ft tier', () => {
    const one = customSetup([{ key: '180282', c: box() }]);
    expect(checkPlacement(one.state, one.ctx, box({ type: '20GP' }), '170284').errors).toEqual([
      { rule: 'twenty', message: '20ft on 40ft stack' },
    ]);
    const half = customSetup([{ key: '170282', c: box({ type: '20GP' }) }]);
    expect(checkPlacement(half.state, half.ctx, box(), '180284').errors).toEqual([
      { rule: 'twenty', message: '40ft on 20ft stack with an empty half' },
    ]);
  });

  it('returns the new stack weight and the limit', () => {
    const { ctx, state } = customSetup([{ key: '180202', c: box({ weightT: 25 }) }]);
    expect(checkPlacement(state, ctx, box({ weightT: 20 }), '180204')).toMatchObject({
      target: true,
      valid: true,
      errors: [],
      warnings: [],
      stackWeightT: 45,
      limitT: 210,
    });
  });
});

describe('next free slots', () => {
  it('lists the next free slot of each stack', () => {
    const { ctx, state } = customSetup([
      { key: '180282', c: box() },
      { key: '170482', c: box({ type: '20GP' }) },
    ]);
    const forty = nextFreeSlots(state, ctx, 40, { bays: [18] });
    expect(forty).toContain('180284');
    expect(forty).toContain('180182');
    expect(forty).toContain('180202');
    expect(forty).not.toContain('180282');
    const twenty = nextFreeSlots(state, ctx, 20, { bays: [18] });
    expect(twenty).toContain('170284');
    expect(twenty).toContain('190284');
    expect(twenty).toContain('190482');
    expect(twenty).toContain('170484');
  });

  it('covers every bay of the sample vessel', () => {
    const { ctx, state } = sampleSetup();
    const keys = nextFreeSlots(state, ctx, 40);
    expect(new Set(keys.map((k) => k.slice(0, 2))).size).toBeGreaterThan(15);
    expect(keys.every((k) => !state.placements.has(k))).toBe(true);
  });
});
