import { applyCommand } from '../commands/commands';
import { toTenths } from '../constants';
import { fmt1, plural } from '../format';
import { isDeckTier, pad, parseKey } from '../geometry';
import { portOrder, type StowContext } from '../plan/context';
import {
  entriesAbove,
  isTop,
  parseStackId,
  stackEntries,
  stackIdOf,
  stackTiers,
  type Entry,
  type StowState,
} from '../plan/state';
import type { Command, SlotKey, Violation } from '../types';
import { checkPlacement, nextFreeSlots } from './placement';
import { validateStacks } from './validate';

// Fix suggestions (FR-44). A fix is offered only when its command passes the rule check,
// creates no new error and resolves the violation. Targets are searched in every bay,
// nearest first. When nothing fits, the result says why, and offers Unplace when it can.

export type FixSuggestion =
  | { kind: 'fix'; text: string; command: Command }
  | { kind: 'none'; reason: string; alternative?: { text: string; command: Command } };

const none = (reason: string, alternative?: { text: string; command: Command }): FixSuggestion =>
  alternative ? { kind: 'none', reason, alternative } : { kind: 'none', reason };

/** Whether the command passes and the violation is gone afterwards. */
function resolves(s: StowState, ctx: StowContext, v: Violation, command: Command): boolean {
  const r = applyCommand(s, ctx, command);
  if (!r.ok) return false;
  const stacks = new Set([...r.touched, ...v.slotKeys.map(stackIdOf)]);
  return !validateStacks(r.state, ctx, stacks).some((x) => x.id === v.id);
}

function bayIndex(ctx: StowContext, key: SlotKey): number {
  const pos = ctx.geometry.slotPos(key);
  return pos.bayIndex;
}

/** Sort key for "nearest": same bay first, then same deck or hold, then rows, then tiers. */
function distance(ctx: StowContext, from: SlotKey, to: SlotKey): number {
  const a = parseKey(from);
  const b = parseKey(to);
  const rowGap = Math.abs(ctx.rowOrder.indexOf(a.row) - ctx.rowOrder.indexOf(b.row));
  return (
    Math.abs(bayIndex(ctx, from) - bayIndex(ctx, to)) * 10000 +
    (isDeckTier(a.tier) === isDeckTier(b.tier) ? 0 : 1000) +
    rowGap * 20 +
    Math.abs(a.tier - b.tier)
  );
}

/**
 * The nearest slot the container in `from` can move to with no error and no warning,
 * for which the move resolves the violation. Searches every bay.
 */
function nearestMove(
  s: StowState,
  ctx: StowContext,
  v: Violation,
  from: SlotKey,
  accept: (to: SlotKey) => boolean = () => true,
): SlotKey | undefined {
  const c = ctx.containers.get(s.placements.get(from)!.containerId)!;
  const candidates = nextFreeSlots(s, ctx, c.lengthFt, { ignoreKey: from })
    .filter((to) => to !== from && accept(to))
    .sort((a, b) => distance(ctx, from, a) - distance(ctx, from, b));
  for (const to of candidates) {
    const pc = checkPlacement(s, ctx, c, to, from);
    if (!pc.valid || pc.warnings.length > 0) continue;
    if (resolves(s, ctx, v, { kind: 'move', from, to })) return to;
  }
  return undefined;
}

/** Why the container in a slot cannot be moved, or null when it can. */
function blockedReason(s: StowState, ctx: StowContext, key: SlotKey): string | null {
  const p = s.placements.get(key);
  if (!p) return 'The container is no longer there';
  if (p.locked) return 'The container to move is locked';
  if (!isTop(s, ctx, key)) return 'The container to move is under other containers';
  return null;
}

function unplaceOffer(s: StowState, ctx: StowContext, key: SlotKey) {
  const p = s.placements.get(key);
  if (!p || p.locked || p.origin !== 'thisCall' || !isTop(s, ctx, key)) return undefined;
  return { text: `Unplace ${p.containerId}`, command: { kind: 'unplace', from: key } as Command };
}

function fixStack(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const blocked = blockedReason(s, ctx, v.slot);
  if (blocked) return none(blocked);
  const ref = parseStackId(stackIdOf(v.slot));
  const entries = stackEntries(s, ctx, ref.id);
  const limit = toTenths(ref.deck ? ctx.vessel.limits.stackDeckT : ctx.vessel.limits.stackHoldT);
  const rest = entries
    .filter((e) => e.key !== v.slot)
    .reduce((a, e) => a + toTenths(e.container.weightT), 0);
  if (rest > limit)
    return none('Moving the top container is not enough to bring the stack under its limit');
  const to = nearestMove(s, ctx, v, v.slot);
  if (!to) return none('No valid slot on board for the top container');
  const c = ctx.containers.get(s.placements.get(v.slot)!.containerId)!;
  return {
    kind: 'fix',
    text: `Move ${c.id} (${fmt1(c.weightT)} t) to ${to}`,
    command: { kind: 'move', from: v.slot, to },
  };
}

function fixReefer(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const blocked = blockedReason(s, ctx, v.slot);
  if (blocked) return none(blocked, unplaceOffer(s, ctx, v.slot));
  const to = nearestMove(s, ctx, v, v.slot, (k) => ctx.geometry.hasPlug(k));
  if (!to) return none('No free slot with a reefer plug on board', unplaceOffer(s, ctx, v.slot));
  return {
    kind: 'fix',
    text: `Move to plug slot ${to}`,
    command: { kind: 'move', from: v.slot, to },
  };
}

function fixDg(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const [a, b] = v.slotKeys as [SlotKey, SlotKey];
  // Try the second container first, as the design did for the 5.1 box.
  for (const [move, stay] of [
    [b, a],
    [a, b],
  ] as const) {
    if (blockedReason(s, ctx, move)) continue;
    const away = (to: SlotKey) =>
      isDeckTier(parseKey(to).tier) && Math.abs(bayIndex(ctx, to) - bayIndex(ctx, stay)) >= 2;
    const to = nearestMove(s, ctx, v, move, away);
    if (!to) continue;
    const c = ctx.containers.get(s.placements.get(move)!.containerId)!;
    const n = Math.abs(bayIndex(ctx, to) - bayIndex(ctx, stay));
    return {
      kind: 'fix',
      text: `Move IMDG ${c.imdgClass ?? ''} ${c.id} to ${to} (separated by ${n} bays)`,
      command: { kind: 'move', from: move, to },
    };
  }
  return none('Neither container can move to a deck slot two bays away');
}

function fixOverstow(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const ref = parseStackId(stackIdOf(v.slot));
  const entries = stackEntries(s, ctx, ref.id);
  const blocked = entries.find((e) => e.key === v.slot)!;
  const group: Entry[] = [blocked, ...entriesAbove(entries, blocked)];
  if (group.some((e) => e.container.lengthFt !== blocked.container.lengthFt)) {
    return none('The stack mixes 20ft and 40ft containers, so it cannot be reordered by swaps');
  }
  if (group.some((e) => e.placement.locked)) return none('A container in the stack is locked');

  const order = (e: Entry) => portOrder(ctx, e.container.pod);
  const sorted = (list: Entry[]) =>
    list.every((e, i) => i === 0 || order(e) <= order(list[i - 1]!));

  // One swap of the blocked container with the top one, when that orders the stack.
  const top = group[group.length - 1]!;
  const swapped = [top, ...group.slice(1, -1), blocked];
  if (group.length > 1 && sorted(swapped)) {
    const command: Command = { kind: 'swap', a: blocked.key, b: top.key };
    if (resolves(s, ctx, v, command)) {
      return {
        kind: 'fix',
        text: `Swap with ${top.container.id} at ${top.key}, 0 restows`,
        command,
      };
    }
  }

  // Otherwise reorder: later ports lower, as one command made of swaps.
  const keys = group.map((e) => e.key);
  const current = group.map((e) => e.container.id);
  const target = [...group].sort((x, y) => order(y) - order(x)).map((e) => e.container.id);
  const swaps: Command[] = [];
  for (let i = 0; i < keys.length; i++) {
    if (current[i] === target[i]) continue;
    const j = current.indexOf(target[i]!);
    swaps.push({ kind: 'swap', a: keys[i]!, b: keys[j]! });
    [current[i], current[j]] = [current[j]!, current[i]!];
  }
  const command: Command = { kind: 'batch', commands: swaps };
  if (swaps.length > 0 && resolves(s, ctx, v, command)) {
    return {
      kind: 'fix',
      text: `Reorder stack ${pad(ref.bay40)}-${pad(ref.row)} ${ref.deck ? 'deck' : 'hold'}: ${plural(swaps.length, 'swap')}, 0 restows`,
      command,
    };
  }
  return none('Reordering the stack would break another rule');
}

function fixTwenty(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const blocked = blockedReason(s, ctx, v.slot);
  if (blocked) return none(blocked, unplaceOffer(s, ctx, v.slot));
  const c = ctx.containers.get(s.placements.get(v.slot)!.containerId)!;
  const to = nearestMove(s, ctx, v, v.slot);
  if (!to) return none(`No valid ${c.lengthFt}ft slot on board`, unplaceOffer(s, ctx, v.slot));
  const tier = parseKey(to).tier;
  const lowest = stackTiers(ctx, parseStackId(stackIdOf(to)))[0] === tier;
  const where =
    c.lengthFt === 40
      ? `${c.id} to ${to}`
      : lowest
        ? isDeckTier(tier)
          ? `to empty deck stack ${to} (on hatch)`
          : `to empty hold stack ${to}`
        : `to ${to}, on a 20ft stack`;
  return { kind: 'fix', text: `Move ${where}`, command: { kind: 'move', from: v.slot, to } };
}

function fixHeavy(s: StowState, ctx: StowContext, v: Violation): FixSuggestion {
  const [upper, lower] = v.slotKeys as [SlotKey, SlotKey];
  const pu = s.placements.get(upper);
  const pl = s.placements.get(lower);
  if (!pu || !pl) return none('The containers are no longer there');
  if (pu.locked || pl.locked) return none('One of the two containers is locked');
  const cu = ctx.containers.get(pu.containerId)!;
  const cl = ctx.containers.get(pl.containerId)!;
  if (cu.lengthFt !== cl.lengthFt) {
    return none('The lighter container below is a different length, so they cannot be swapped');
  }
  const command: Command = { kind: 'swap', a: upper, b: lower };
  if (!resolves(s, ctx, v, command)) return none('Swapping the two would break another rule');
  return { kind: 'fix', text: `Swap with ${cl.id} at ${lower}, heavy box below`, command };
}

export function suggestFix(v: Violation, s: StowState, ctx: StowContext): FixSuggestion {
  switch (v.rule) {
    case 'stack':
      return fixStack(s, ctx, v);
    case 'reefer':
      return fixReefer(s, ctx, v);
    case 'dg':
      return fixDg(s, ctx, v);
    case 'overstow':
      return fixOverstow(s, ctx, v);
    case 'twenty':
      return fixTwenty(s, ctx, v);
    case 'heavy':
      return fixHeavy(s, ctx, v);
  }
}
