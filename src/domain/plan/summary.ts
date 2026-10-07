import { toTenths } from '../constants';
import { slot40Key } from '../geometry';
import type { StowContext } from './context';
import { parseStackId, stackEntries, type StowState } from './state';

// Counts for the bay navigator, the bay view and the plans preview.

export interface BayOccupancy {
  bay: number;
  index: number;
  /** Filled 40ft slots. A slot holding 20ft containers counts once. */
  deck: number;
  deckCapacity: number;
  hold: number;
  holdCapacity: number;
}

export function bayOccupancy(s: StowState, ctx: StowContext): BayOccupancy[] {
  const filled = new Set<string>();
  for (const key of s.placements.keys()) filled.add(slot40Key(key));
  const counts = new Map<string, number>();
  for (const key of filled) {
    const part = `${+key.slice(0, 2)}-${+key.slice(4, 6) >= 82 ? 'D' : 'H'}`;
    counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  return ctx.vessel.bays.map((b) => ({
    bay: b.bay,
    index: b.index,
    deck: counts.get(`${b.bay}-D`) ?? 0,
    deckCapacity: b.deckRows * b.deckTiers.length,
    hold: counts.get(`${b.bay}-H`) ?? 0,
    holdCapacity: b.holdRows * b.holdTiers.length,
  }));
}

/** The weight of a stack in whole tenths of a tonne. */
export function stackWeightTenths(s: StowState, ctx: StowContext, stackId: string): number {
  return stackEntries(s, ctx, stackId).reduce((a, e) => a + toTenths(e.container.weightT), 0);
}

export function stackLimitTenths(ctx: StowContext, stackId: string): number {
  const { limits } = ctx.vessel;
  return toTenths(parseStackId(stackId).deck ? limits.stackDeckT : limits.stackHoldT);
}
