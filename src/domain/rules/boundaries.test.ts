import { describe, expect, it } from 'vitest';
import { box, customSetup } from '../testing/fixtures';
import { checkPlacement } from './placement';
import { validateAll } from './validate';

// SRS "Test plan and acceptance": boundary values. The stability ones are in stability.test.ts.

const deck = (weights: number[]) =>
  customSetup(
    weights.map((w, i) => ({ key: `1802${String(82 + 2 * i)}`, c: box({ weightT: w }) })),
  );

describe('stack weight limit', () => {
  it('passes a deck stack at exactly 90.0 t', () => {
    const { ctx, state } = deck([22.5, 22.5, 22.5, 22.5]);
    expect(validateAll(state, ctx)).toEqual([]);
  });

  it('fails a deck stack at 90.1 t', () => {
    const { ctx, state } = deck([22.6, 22.5, 22.5, 22.5]);
    const v = validateAll(state, ctx);
    expect(v.map((x) => x.message)).toEqual(['Stack 18-02 deck: 90.1 t of 90.0 t limit']);
  });

  it('passes a hold stack at exactly 210.0 t and fails at 210.1 t', () => {
    const hold = (top: number) =>
      customSetup(
        [30, 30, 30, 30, 30, 30, top].map((w, i) => ({
          key: `1802${String(2 + 2 * i).padStart(2, '0')}`,
          c: box({ weightT: w }),
        })),
      );
    let s = hold(30);
    expect(validateAll(s.state, s.ctx)).toEqual([]);
    s = hold(30.1);
    expect(validateAll(s.state, s.ctx).map((x) => x.message)).toEqual([
      'Stack 18-02 hold: 210.1 t of 210.0 t limit',
    ]);
  });

  it('lets the placement check accept 90.0 t and refuse 90.1 t', () => {
    const { ctx, state } = deck([22.5, 22.5, 22.5]);
    expect(checkPlacement(state, ctx, box({ weightT: 22.5 }), '180288')).toMatchObject({
      valid: true,
      stackWeightT: 90,
      limitT: 90,
    });
    expect(checkPlacement(state, ctx, box({ weightT: 22.6 }), '180288')).toMatchObject({
      valid: false,
      reason: 'Stack limit: 90.1 t of 90.0 t',
    });
  });
});

describe('heavy over light', () => {
  it('passes a container exactly 10.0 t heavier than the one below', () => {
    const { ctx, state } = deck([8.4, 18.4]);
    expect(validateAll(state, ctx)).toEqual([]);
  });

  it('warns for a container 10.1 t heavier', () => {
    const { ctx, state } = deck([8.4, 18.5]);
    const v = validateAll(state, ctx);
    expect(v.map((x) => [x.severity, x.message])).toEqual([
      ['warning', 'Heavy over light at 180284: 18.5 t above 8.4 t'],
    ]);
  });

  it('makes the slot valid with a warning in the placement check', () => {
    const { ctx, state } = deck([8.4]);
    expect(checkPlacement(state, ctx, box({ weightT: 18.4 }), '180284')).toMatchObject({
      valid: true,
      warnings: [],
    });
    const c = checkPlacement(state, ctx, box({ weightT: 18.5 }), '180284');
    expect(c.valid).toBe(true);
    expect(c.warnings).toEqual([{ rule: 'heavy', message: 'Heavy over light: 18.5 t over 8.4 t' }]);
    expect(c.reason).toBe('Heavy over light: 18.5 t over 8.4 t');
  });
});
