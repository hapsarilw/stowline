import { bay40Of, isDeckTier, parseKey, slotKeyFor } from '../geometry';
import type { Container, Half, Placement, SlotKey } from '../types';
import type { StowContext } from './context';

/** The part of a plan that commands change. Immutable: a command returns a new state. */
export interface StowState {
  readonly placements: ReadonlyMap<SlotKey, Placement>;
  /** Container ID to slot key. */
  readonly slotOf: ReadonlyMap<string, SlotKey>;
  /** Containers loaded at an earlier port that are not in their arrival slot (BR-17). */
  readonly shiftCount: number;
}

export function createStowState(placements: Iterable<Placement>, shiftCount = 0): StowState {
  const byKey = new Map<SlotKey, Placement>();
  const slotOf = new Map<string, SlotKey>();
  for (const p of placements) {
    if (byKey.has(p.slotKey)) throw new Error(`Two containers in slot ${p.slotKey}`);
    if (slotOf.has(p.containerId)) throw new Error(`Container ${p.containerId} placed twice`);
    byKey.set(p.slotKey, p);
    slotOf.set(p.containerId, p.slotKey);
  }
  return { placements: byKey, slotOf, shiftCount };
}

/** Placements sorted by slot key, for saving and comparing. */
export const toPlacements = (s: StowState): Placement[] =>
  [...s.placements.values()].sort((a, b) => a.slotKey.localeCompare(b.slotKey));

// A stack is all slots with the same 40ft bay and row, on deck or in the hold. Its id is
// 'bay-row-D' or 'bay-row-H' without padding, as in the violation id 'stack:18-4-D'.

export interface StackRef {
  id: string;
  bay40: number;
  row: number;
  deck: boolean;
}

export function stackIdOf(key: SlotKey): string {
  const { bay, row, tier } = parseKey(key);
  return `${bay40Of(bay)}-${row}-${isDeckTier(tier) ? 'D' : 'H'}`;
}

export function parseStackId(id: string): StackRef {
  const [bay, row, part] = id.split('-');
  return { id, bay40: Number(bay), row: Number(row), deck: part === 'D' };
}

export function stackTiers(ctx: StowContext, ref: StackRef): readonly number[] {
  const bay = ctx.geometry.bayByNum(ref.bay40);
  if (!bay) return [];
  return ref.deck ? bay.deckTiers : bay.holdTiers;
}

/** Stack ids that hold at least one container. */
export function stackIdsInUse(s: StowState): Set<string> {
  const ids = new Set<string>();
  for (const key of s.placements.keys()) ids.add(stackIdOf(key));
  return ids;
}

/** One container in a stack. level is the index of its tier in the stack, 0 at the bottom. */
export interface Entry {
  key: SlotKey;
  tier: number;
  level: number;
  half: Half;
  placement: Placement;
  container: Container;
}

const HALVES: readonly Half[] = ['both', 'fore', 'aft'];

/** The containers of a stack from the bottom up, optionally leaving one slot out. */
export function stackEntries(
  s: StowState,
  ctx: StowContext,
  stackId: string,
  ignoreKey: SlotKey | null = null,
): Entry[] {
  const ref = parseStackId(stackId);
  const out: Entry[] = [];
  stackTiers(ctx, ref).forEach((tier, level) => {
    for (const half of HALVES) {
      const key = slotKeyFor(ref.bay40, ref.row, tier, half);
      if (key === ignoreKey) continue;
      const placement = s.placements.get(key);
      if (!placement) continue;
      const container = ctx.containers.get(placement.containerId);
      if (!container) throw new Error(`Unknown container ${placement.containerId}`);
      out.push({ key, tier, level, half, placement, container });
    }
  });
  return out;
}

/** Whether two slots of the same stack share any length of the ship. */
export const overlaps = (a: { half: Half }, b: { half: Half }): boolean =>
  a.half === 'both' || b.half === 'both' || a.half === b.half;

/** Containers above e that sit over it, bottom up. */
export const entriesAbove = (entries: readonly Entry[], e: Entry): Entry[] =>
  entries.filter((x) => x.level > e.level && overlaps(x, e));

/** Containers in the tier directly below e that carry it. */
export const entriesBelow = (entries: readonly Entry[], e: Entry): Entry[] =>
  entries.filter((x) => x.level === e.level - 1 && overlaps(x, e));

/** Number of filled levels in the fore and aft halves of a stack. */
export function columnHeights(entries: readonly Entry[]): { fore: number; aft: number } {
  let fore = 0;
  let aft = 0;
  for (const e of entries) {
    if (e.half !== 'aft') fore = Math.max(fore, e.level + 1);
    if (e.half !== 'fore') aft = Math.max(aft, e.level + 1);
  }
  return { fore, aft };
}

/** Whether nothing sits on the container in this slot (BR-03). */
export function isTop(s: StowState, ctx: StowContext, key: SlotKey): boolean {
  const entries = stackEntries(s, ctx, stackIdOf(key));
  const e = entries.find((x) => x.key === key);
  return e !== undefined && entriesAbove(entries, e).length === 0;
}
