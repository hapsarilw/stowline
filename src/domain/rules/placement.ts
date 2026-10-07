import { toTenths } from '../constants';
import { fmtTenths, plural } from '../format';
import { halfOfKey, parseKey, slotKeyFor } from '../geometry';
import { portOrder, portShort, type StowContext } from '../plan/context';
import {
  columnHeights,
  entriesAbove,
  entriesBelow,
  overlaps,
  parseStackId,
  stackEntries,
  stackIdOf,
  stackTiers,
  type Entry,
  type StowState,
} from '../plan/state';
import type { Container, RuleId, SlotKey } from '../types';
import { buildDgIndex, dgNeighbours } from './dg';
import { incompatible } from './segregation';
import { lightest, twentyFortyProblem } from './stack-rules';

export interface PlacementIssue {
  rule: RuleId;
  message: string;
}

export interface PlacementCheck {
  /** The slot can take the container at all: it exists, is free and is supported. */
  target: boolean;
  /** A target with no error. It may still have warnings. */
  valid: boolean;
  errors: PlacementIssue[];
  warnings: PlacementIssue[];
  /** The stack weight after the drop, in tonnes. */
  stackWeightT: number;
  limitT: number;
  /** The first structural failure, the first error, or the first warning. */
  reason?: string;
}

function notATarget(reason: string): PlacementCheck {
  return {
    target: false,
    valid: false,
    errors: [],
    warnings: [],
    stackWeightT: 0,
    limitT: 0,
    reason,
  };
}

/**
 * Can this container go into this slot? SRS "Placement check". It runs in order and stops at
 * the first structural failure. from is the container's current slot when it is moved.
 */
export function checkPlacement(
  s: StowState,
  ctx: StowContext,
  container: Container,
  to: SlotKey,
  from: SlotKey | null = null,
): PlacementCheck {
  // 1. The slot exists in the bay geometry, for this length of container.
  if (!ctx.geometry.slotExists(to)) return notATarget('Slot does not exist');
  const half = halfOfKey(to);
  if (container.lengthFt === 40 && half !== 'both')
    return notATarget('A 40ft container needs a 40ft slot');
  if (container.lengthFt === 20 && half === 'both')
    return notATarget('A 20ft container needs a 20ft slot');

  // 2. The slot is empty, apart from the container being moved.
  const stackId = stackIdOf(to);
  const ref = parseStackId(stackId);
  const entries = stackEntries(s, ctx, stackId, from);
  const { tier } = parseKey(to);
  const level = stackTiers(ctx, ref).indexOf(tier);
  const me: Entry = {
    key: to,
    tier,
    level,
    half,
    container,
    placement: { containerId: container.id, slotKey: to, half, locked: false, origin: 'thisCall' },
  };
  if (entries.some((e) => e.level === level && overlaps(e, me)))
    return notATarget('Slot is occupied');

  // 3. The slot is the lowest tier of its stack, or the slot directly below is filled.
  const below = entriesBelow(entries, me);
  if (level > 0 && below.length === 0) return notATarget('No container below this slot');

  // 4. Rules R1 to R5 on the stack as it would be after the drop.
  const { limits } = ctx.vessel;
  const errors: PlacementIssue[] = [];
  const warnings: PlacementIssue[] = [];
  const w = toTenths(container.weightT);
  const limit = toTenths(ref.deck ? limits.stackDeckT : limits.stackHoldT);
  const sum = entries.reduce((a, e) => a + toTenths(e.container.weightT), 0) + w;

  if (sum > limit) {
    errors.push({
      rule: 'stack',
      message: `Stack limit: ${fmtTenths(sum)} t of ${fmtTenths(limit)} t`,
    });
  }
  if (container.type === 'RF' && !ctx.geometry.hasPlug(to)) {
    errors.push({ rule: 'reefer', message: `No reefer plug at ${to}` });
  }
  if (container.imdgClass) {
    const index = buildDgIndex(s, ctx, container.id);
    for (const y of dgNeighbours(index, to, ctx, container.id)) {
      if (incompatible(container.imdgClass, y.cls)) {
        errors.push({ rule: 'dg', message: `IMDG ${container.imdgClass} next to IMDG ${y.cls}` });
      }
    }
  }
  const order = portOrder(ctx, container.pod);
  const earlier = entries.filter(
    (e) => e.level < level && overlaps(e, me) && portOrder(ctx, e.container.pod) < order,
  );
  const blocked = earlier[0];
  if (blocked) {
    const after = [...entries, me];
    const bo = portOrder(ctx, blocked.container.pod);
    const n = entriesAbove(after, blocked).filter(
      (x) => portOrder(ctx, x.container.pod) > bo,
    ).length;
    errors.push({
      rule: 'overstow',
      message: `Overstow: ${portShort(ctx, blocked.container.pod)} box below, ${plural(n, 'restow')}`,
    });
  }
  const problem = twentyFortyProblem(me, below);
  if (problem) errors.push({ rule: 'twenty', message: problem });

  // 5. Rule R6 gives a warning.
  const light = lightest(below);
  if (light && w - toTenths(light.container.weightT) > toTenths(limits.heavyDeltaT)) {
    warnings.push({
      rule: 'heavy',
      message: `Heavy over light: ${fmtTenths(w)} t over ${fmtTenths(toTenths(light.container.weightT))} t`,
    });
  }

  return {
    target: true,
    valid: errors.length === 0,
    errors,
    warnings,
    stackWeightT: sum / 10,
    limitT: limit / 10,
    reason: (errors[0] ?? warnings[0])?.message,
  };
}

export interface FreeSlotOptions {
  /** Only these 40ft bays. Default: every bay. */
  bays?: readonly number[];
  /** Treat this slot as empty, for the container being moved. */
  ignoreKey?: SlotKey | null;
}

/**
 * The next free slot of each stack for a container of this length: one per stack for 40ft,
 * one per half for 20ft. These are the only slots a drop can target.
 */
export function nextFreeSlots(
  s: StowState,
  ctx: StowContext,
  lengthFt: 20 | 40,
  options: FreeSlotOptions = {},
): SlotKey[] {
  const out: SlotKey[] = [];
  for (const bay of ctx.vessel.bays) {
    if (options.bays && !options.bays.includes(bay.bay)) continue;
    for (const deck of [true, false]) {
      const rows = deck ? bay.deckRows : bay.holdRows;
      const tiers = deck ? bay.deckTiers : bay.holdTiers;
      for (let row = 1; row <= rows; row++) {
        const id = `${bay.bay}-${row}-${deck ? 'D' : 'H'}`;
        const h = columnHeights(stackEntries(s, ctx, id, options.ignoreKey ?? null));
        if (lengthFt === 40) {
          const lvl = Math.max(h.fore, h.aft);
          const tier = tiers[lvl];
          if (tier !== undefined) out.push(slotKeyFor(bay.bay, row, tier, 'both'));
        } else {
          for (const half of ['fore', 'aft'] as const) {
            const tier = tiers[h[half]];
            if (tier !== undefined) out.push(slotKeyFor(bay.bay, row, tier, half));
          }
        }
      }
    }
  }
  return out;
}
