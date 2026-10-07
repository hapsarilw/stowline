// Random command picks for property tests. Not used by the app.
import fc from 'fast-check';
import type { StowContext } from '../plan/context';
import { toPlacements, type StowState } from '../plan/state';
import { nextFreeSlots } from '../rules/placement';
import type { Command } from '../types';

export type Pick = [number, number, number];

export const pickArb: fc.Arbitrary<Pick> = fc.tuple(fc.nat(5), fc.nat(), fc.nat());

/** Builds a command from random picks. Many are refused, which is part of the test. */
export function pickCommand(s: StowState, ctx: StowContext, [kind, i, j]: Pick): Command {
  const keys = [...s.placements.keys()];
  const at = keys[i % keys.length]!;
  const other = keys[j % keys.length]!;
  switch (kind % 6) {
    case 0: {
      const unplaced = [...ctx.containers.keys()].filter((id) => !s.slotOf.has(id));
      const id = unplaced[i % unplaced.length]!;
      const free = nextFreeSlots(s, ctx, ctx.containers.get(id)!.lengthFt);
      return { kind: 'place', containerId: id, to: free[j % free.length]! };
    }
    case 1: {
      const len = ctx.containers.get(s.placements.get(at)!.containerId)!.lengthFt;
      const free = nextFreeSlots(s, ctx, len);
      return { kind: 'move', from: at, to: free[j % free.length]! };
    }
    case 2:
      return { kind: 'unplace', from: at };
    case 3:
      return { kind: 'swap', a: at, b: other };
    case 4:
      return { kind: 'lock', at };
    default:
      return { kind: 'unlock', at };
  }
}

/** A plain, order-independent view of a state for equality checks. */
export const snapshot = (s: StowState) => ({
  placements: toPlacements(s),
  slotOf: [...s.slotOf.entries()].sort(),
  shiftCount: s.shiftCount,
});
