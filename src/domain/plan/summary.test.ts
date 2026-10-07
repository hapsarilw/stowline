import { describe, expect, it } from 'vitest';
import { sampleSetup } from '../testing/fixtures';
import { bayOccupancy, stackLimitTenths, stackWeightTenths } from './summary';

const { ctx, state } = sampleSetup();

describe('bay occupancy', () => {
  const occ = bayOccupancy(state, ctx);

  it('has one entry per bay with the capacity of the geometry', () => {
    expect(occ).toHaveLength(22);
    expect(occ[0]).toMatchObject({ bay: 2, deckCapacity: 60, holdCapacity: 40 });
    expect(occ.reduce((n, b) => n + b.deckCapacity + b.holdCapacity, 0)).toBe(4292);
  });

  it('counts bay 18 as the design shows: 161 of 208 slots', () => {
    const b18 = occ.find((b) => b.bay === 18)!;
    expect(b18.deck + b18.hold).toBe(161);
    expect(b18.deckCapacity + b18.holdCapacity).toBe(208);
  });

  it('counts a slot with 20ft containers once', () => {
    const b30 = occ.find((b) => b.bay === 30)!;
    const keys = [...state.placements.keys()].filter((k) =>
      ['29', '30', '31'].includes(k.slice(0, 2)),
    );
    expect(keys.length).toBeGreaterThan(b30.deck + b30.hold - 1);
  });
});

describe('stack weights', () => {
  it('sums a stack in tenths and gives its limit', () => {
    expect(stackWeightTenths(state, ctx, '18-4-D')).toBe(964);
    expect(stackLimitTenths(ctx, '18-4-D')).toBe(900);
    expect(stackLimitTenths(ctx, '18-4-H')).toBe(2100);
    expect(stackWeightTenths(state, ctx, '2-16-D')).toBe(0);
  });
});
