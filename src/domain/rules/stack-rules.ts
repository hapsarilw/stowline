import { toTenths } from '../constants';
import { pad } from '../geometry';
import { fmtTenths, plural } from '../format';
import { portName, portOrder, type StowContext } from '../plan/context';
import {
  entriesAbove,
  entriesBelow,
  parseStackId,
  stackEntries,
  type Entry,
  type StowState,
} from '../plan/state';
import type { Violation } from '../types';

// The rules that depend on one stack only: R1, R2, R4, R5 and R6.

const tenths = (e: Entry) => toTenths(e.container.weightT);

/** The lightest of the containers below; a 40ft on two 20ft is compared with the lighter one. */
export const lightest = (below: readonly Entry[]): Entry | undefined =>
  below.reduce<Entry | undefined>((m, e) => (!m || tenths(e) < tenths(m) ? e : m), undefined);

/** R5 for a container and the containers directly below it. Returns the reason or null. */
export function twentyFortyProblem(e: Pick<Entry, 'half'>, below: readonly Entry[]): string | null {
  if (below.length === 0) return null;
  if (e.half !== 'both') return below.some((b) => b.half === 'both') ? '20ft on 40ft stack' : null;
  const covered = below.some((b) => b.half === 'both') || below.length === 2;
  return covered ? null : '40ft on 20ft stack with an empty half';
}

export function checkStack(s: StowState, ctx: StowContext, stackId: string): Violation[] {
  const entries = stackEntries(s, ctx, stackId);
  if (entries.length === 0) return [];
  const ref = parseStackId(stackId);
  const { limits } = ctx.vessel;
  const out: Violation[] = [];

  // R1 stack weight
  const limit = toTenths(ref.deck ? limits.stackDeckT : limits.stackHoldT);
  const sum = entries.reduce((a, e) => a + tenths(e), 0);
  if (sum > limit) {
    const top = entries[entries.length - 1]!;
    out.push({
      id: `stack:${stackId}`,
      rule: 'stack',
      severity: 'error',
      slot: top.key,
      bay: ref.bay40,
      slotKeys: entries.map((e) => e.key),
      message: `Stack ${pad(ref.bay40)}-${pad(ref.row)} ${ref.deck ? 'deck' : 'hold'}: ${fmtTenths(sum)} t of ${fmtTenths(limit)} t limit`,
      data: { overT: (sum - limit) / 10 },
    });
  }

  for (const e of entries) {
    const c = e.container;

    // R2 reefer power
    if (c.type === 'RF' && !ctx.geometry.hasPlug(e.key)) {
      out.push({
        id: `reefer:${e.key}`,
        rule: 'reefer',
        severity: 'error',
        slot: e.key,
        bay: ref.bay40,
        slotKeys: [e.key],
        message: `Reefer ${c.id} at ${e.key} has no plug`,
      });
    }

    // R4 overstow: only the containers above that go to a later port count
    const order = portOrder(ctx, c.pod);
    const later = entriesAbove(entries, e).filter((x) => portOrder(ctx, x.container.pod) > order);
    if (later.length > 0) {
      const n = later.length;
      out.push({
        id: `overstow:${e.key}`,
        rule: 'overstow',
        severity: 'error',
        slot: e.key,
        bay: ref.bay40,
        slotKeys: [e.key, ...later.map((x) => x.key)],
        message: `${portName(ctx, c.pod)} box under ${portName(ctx, later[0]!.container.pod)} box at ${e.key}, ${plural(n, 'restow move')}`,
        data: { restows: n, port: c.pod },
      });
    }

    const below = entriesBelow(entries, e);

    // R5 20ft and 40ft
    const problem = twentyFortyProblem(e, below);
    if (problem) {
      out.push({
        id: `twenty:${e.key}`,
        rule: 'twenty',
        severity: 'error',
        slot: e.key,
        bay: ref.bay40,
        slotKeys: [e.key, ...below.map((x) => x.key)],
        message:
          e.half === 'both'
            ? `40ft ${c.id} at ${e.key} sits on 20ft stack with an empty half in bay ${pad(ref.bay40)}`
            : `20ft ${c.id} at ${e.key} sits on 40ft stack in bay ${pad(ref.bay40)}`,
      });
    }

    // R6 heavy over light
    const light = lightest(below);
    if (light && tenths(e) - tenths(light) > toTenths(limits.heavyDeltaT)) {
      out.push({
        id: `heavy:${e.key}`,
        rule: 'heavy',
        severity: 'warning',
        slot: e.key,
        bay: ref.bay40,
        slotKeys: [e.key, light.key],
        message: `Heavy over light at ${e.key}: ${fmtTenths(tenths(e))} t above ${fmtTenths(tenths(light))} t`,
      });
    }
  }
  return out;
}
