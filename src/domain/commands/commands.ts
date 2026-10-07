import { halfOfKey } from '../geometry';
import type { StowContext } from '../plan/context';
import { isTop, stackIdOf, type StowState } from '../plan/state';
import { checkPlacement } from '../rules/placement';
import { validateStacks } from '../rules/validate';
import type { Command, Placement, RuleId, SlotKey } from '../types';

// Commands (FR-57). Drag, click and keyboard all end in one of these. Each one returns the new
// state and its inverse. With check on (the default) a command must pass the placement check
// and may not create a new error. Undo and redo apply commands that were already checked, so
// they pass check: false. The physical rules always hold: a slot exists and is free, a stack
// has no gaps, only the top of a stack is lifted (BR-03), locked containers stay put (BR-04),
// and containers loaded at an earlier port are not unplaced (D3).

export interface ApplyOptions {
  check?: boolean;
}

export type CommandResult =
  | { ok: true; state: StowState; inverse: Command; touched: string[] }
  | { ok: false; reason: string; rule?: RuleId };

type Failure = { ok: false; reason: string; rule?: RuleId };

/** A working copy of the state that sub-commands change in place. */
interface Draft {
  placements: Map<SlotKey, Placement>;
  slotOf: Map<string, SlotKey>;
  shiftCount: number;
}

const fail = (reason: string, rule?: RuleId): Failure =>
  rule ? { ok: false, reason, rule } : { ok: false, reason };

/** Stack ids a command changes. Lock and unlock change no rule result. */
export function touchedStacks(cmd: Command): string[] {
  const keys: SlotKey[] = [];
  const walk = (c: Command) => {
    switch (c.kind) {
      case 'place':
        keys.push(c.to);
        break;
      case 'move':
        keys.push(c.from, c.to);
        break;
      case 'unplace':
        keys.push(c.from);
        break;
      case 'swap':
        keys.push(c.a, c.b);
        break;
      case 'batch':
        c.commands.forEach(walk);
        break;
      default:
        break;
    }
  };
  walk(cmd);
  return [...new Set(keys.map(stackIdOf))];
}

/** +1 when a container loaded at an earlier port leaves its arrival slot, -1 when it returns. */
function shiftDelta(ctx: StowContext, id: string, from: SlotKey, to: SlotKey): number {
  const home = ctx.arrival.get(id);
  if (home === undefined) return 0;
  return (to !== home ? 1 : 0) - (from !== home ? 1 : 0);
}

function remove(d: Draft, key: SlotKey): Placement {
  const p = d.placements.get(key)!;
  d.placements.delete(key);
  d.slotOf.delete(p.containerId);
  return p;
}

function put(d: Draft, key: SlotKey, p: Omit<Placement, 'slotKey' | 'half'>): void {
  const placement: Placement = { ...p, slotKey: key, half: halfOfKey(key) };
  d.placements.set(key, placement);
  d.slotOf.set(p.containerId, key);
}

/** The container in a slot, or a failure when the slot is empty or the container is locked. */
function liftable(d: Draft, ctx: StowContext, key: SlotKey, mustBeTop: boolean, verb: string) {
  const p = d.placements.get(key);
  if (!p) return fail(`No container at ${key}`);
  if (p.locked) return fail(`${p.containerId} at ${key} is locked`);
  if (mustBeTop && !isTop(d, ctx, key)) {
    return fail(
      `${p.containerId} is under other containers. Only the top of a stack can be ${verb}.`,
    );
  }
  return p;
}

function run(d: Draft, ctx: StowContext, cmd: Command, check: boolean): Failure | Command {
  switch (cmd.kind) {
    case 'place': {
      const c = ctx.containers.get(cmd.containerId);
      if (!c) return fail(`Unknown container ${cmd.containerId}`);
      if (d.slotOf.has(c.id)) return fail(`${c.id} is already placed`);
      const pc = checkPlacement(d, ctx, c, cmd.to);
      if (!pc.target) return fail(pc.reason ?? 'Not a valid slot');
      if (check && !pc.valid) return fail(pc.reason ?? 'Not a valid slot', pc.errors[0]?.rule);
      put(d, cmd.to, {
        containerId: c.id,
        locked: false,
        origin: ctx.arrival.has(c.id) ? 'onboard' : 'thisCall',
      });
      return { kind: 'unplace', from: cmd.to };
    }
    case 'move': {
      if (cmd.from === cmd.to) return fail('The container is already in that slot');
      const p = liftable(d, ctx, cmd.from, true, 'moved');
      if ('ok' in p) return p;
      const c = ctx.containers.get(p.containerId)!;
      const pc = checkPlacement(d, ctx, c, cmd.to, cmd.from);
      if (!pc.target) return fail(pc.reason ?? 'Not a valid slot');
      if (check && !pc.valid) return fail(pc.reason ?? 'Not a valid slot', pc.errors[0]?.rule);
      remove(d, cmd.from);
      put(d, cmd.to, p);
      d.shiftCount += shiftDelta(ctx, p.containerId, cmd.from, cmd.to);
      return { kind: 'move', from: cmd.to, to: cmd.from };
    }
    case 'unplace': {
      const p = liftable(d, ctx, cmd.from, true, 'unplaced');
      if ('ok' in p) return p;
      if (p.origin === 'onboard') {
        return fail(`${p.containerId} was loaded at an earlier port and cannot be unplaced`);
      }
      remove(d, cmd.from);
      return { kind: 'place', containerId: p.containerId, to: cmd.from };
    }
    case 'swap': {
      if (cmd.a === cmd.b) return fail('Pick two different containers to swap');
      // Swap is exempt from the top-of-stack rule (D2), not from locks.
      const pa = liftable(d, ctx, cmd.a, false, 'swapped');
      if ('ok' in pa) return pa;
      const pb = liftable(d, ctx, cmd.b, false, 'swapped');
      if ('ok' in pb) return pb;
      const la = ctx.containers.get(pa.containerId)!.lengthFt;
      const lb = ctx.containers.get(pb.containerId)!.lengthFt;
      if (la !== lb) return fail('Only containers of the same length can be swapped');
      remove(d, cmd.a);
      remove(d, cmd.b);
      put(d, cmd.b, pa);
      put(d, cmd.a, pb);
      d.shiftCount +=
        shiftDelta(ctx, pa.containerId, cmd.a, cmd.b) +
        shiftDelta(ctx, pb.containerId, cmd.b, cmd.a);
      return { kind: 'swap', a: cmd.a, b: cmd.b };
    }
    case 'lock':
    case 'unlock': {
      const p = d.placements.get(cmd.at);
      if (!p) return fail(`No container at ${cmd.at}`);
      const lock = cmd.kind === 'lock';
      if (p.locked === lock)
        return fail(`${p.containerId} is already ${lock ? 'locked' : 'unlocked'}`);
      d.placements.set(cmd.at, { ...p, locked: lock });
      return { kind: lock ? 'unlock' : 'lock', at: cmd.at };
    }
    case 'batch': {
      if (cmd.commands.length === 0) return fail('Nothing to do');
      const inverses: Command[] = [];
      for (const sub of cmd.commands) {
        const r = run(d, ctx, sub, check);
        if ('ok' in r) return r;
        inverses.push(r);
      }
      return { kind: 'batch', commands: inverses.reverse() };
    }
  }
}

export function applyCommand(
  s: StowState,
  ctx: StowContext,
  cmd: Command,
  options: ApplyOptions = {},
): CommandResult {
  const check = options.check ?? true;
  const d: Draft = {
    placements: new Map(s.placements),
    slotOf: new Map(s.slotOf),
    shiftCount: s.shiftCount,
  };
  const inverse = run(d, ctx, cmd, check);
  if ('ok' in inverse) return inverse;
  const state: StowState = d;
  const touched = touchedStacks(cmd);

  if (check && touched.length > 0) {
    const before = new Set(
      validateStacks(s, ctx, touched)
        .filter((v) => v.severity === 'error')
        .map((v) => v.id),
    );
    const added = validateStacks(state, ctx, touched).find(
      (v) => v.severity === 'error' && !before.has(v.id),
    );
    if (added) return fail(added.message, added.rule);
  }
  return { ok: true, state, inverse, touched };
}
