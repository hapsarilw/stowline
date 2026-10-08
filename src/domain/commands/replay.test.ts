import { describe, expect, it } from 'vitest';
import { box, customSetup } from '../testing/fixtures';
import type { Command } from '../types';
import { applyCommand } from './commands';
import { overlapsBySlot, replayOnto, slotsOf } from './replay';

// The conflict review (decision 6, FR-60): which kept changes touch a slot the server version
// also changed, and the kept changes put on top of the server version with the rule check.

const a = box({ id: 'NSPU 100001 1', weightT: 20 });
const b = box({ id: 'NSPU 100002 2', weightT: 18 });
const mine = box({ id: 'NSPU 100003 3', weightT: 15 });
const theirs = box({ id: 'NSPU 100004 4', weightT: 15 });

/** v14: a and b in stack 18-02 deck; two containers on the load list. */
const v14 = () =>
  customSetup(
    [
      { key: '180282', c: a },
      { key: '180284', c: b },
    ],
    [mine, theirs],
  );

/** v15 on the server: a colleague's commands applied to v14. */
function serverVersion(commands: readonly Command[]) {
  const { ctx, state } = v14();
  let s = state;
  for (const c of commands) {
    const r = applyCommand(s, ctx, c);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return { ctx, state: s };
}

describe('slotsOf', () => {
  it('lists the slots each kind of command touches, once', () => {
    expect(slotsOf({ kind: 'place', containerId: 'x', to: '180286' })).toEqual(['180286']);
    expect(slotsOf({ kind: 'move', from: '180284', to: '220282' })).toEqual(['180284', '220282']);
    expect(slotsOf({ kind: 'unplace', from: '180284' })).toEqual(['180284']);
    expect(slotsOf({ kind: 'swap', a: '180282', b: '220282' })).toEqual(['180282', '220282']);
    expect(slotsOf({ kind: 'lock', at: '180282' })).toEqual(['180282']);
    expect(slotsOf({ kind: 'unlock', at: '180282' })).toEqual(['180282']);
    expect(
      slotsOf({
        kind: 'batch',
        commands: [
          { kind: 'swap', a: '180282', b: '180284' },
          { kind: 'swap', a: '180284', b: '180286' },
        ],
      }),
    ).toEqual(['180282', '180284', '180286']);
  });
});

describe('replay of kept changes on the server version', () => {
  const server: Command[] = [{ kind: 'place', containerId: theirs.id, to: '220282' }];

  it('no overlap: the kept changes apply, and nothing is marked', () => {
    const kept: Command[] = [{ kind: 'place', containerId: mine.id, to: '180286' }];
    expect(overlapsBySlot(kept, server)).toEqual([]);
    const { ctx, state } = serverVersion(server);
    const r = replayOnto(state, ctx, kept);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.placements.get('180286')?.containerId).toBe(mine.id);
      expect(r.state.placements.get('220282')?.containerId).toBe(theirs.id);
    }
  });

  it('overlap: a kept change on a slot the server filled is marked, and refused with its reason', () => {
    const kept: Command[] = [
      { kind: 'move', from: '180284', to: '180682' },
      { kind: 'place', containerId: mine.id, to: '220282' },
    ];
    expect(overlapsBySlot(kept, server)).toEqual([{ index: 1, slots: ['220282'] }]);
    const { ctx, state } = serverVersion(server);
    const before = state;
    const r = replayOnto(state, ctx, kept);
    expect(r).toMatchObject({ ok: false, index: 1, command: kept[1] });
    // The reason is the rule check's own words for that slot.
    const direct = applyCommand(
      (applyCommand(state, ctx, kept[0]!) as { state: typeof state }).state,
      ctx,
      kept[1]!,
    );
    expect(direct.ok).toBe(false);
    if (!r.ok && !direct.ok) expect(r.reason).toBe(direct.reason);
    // Nothing applied: the server version is untouched.
    expect(state).toBe(before);
    expect(state.placements.get('180682')).toBeUndefined();
  });

  it('a change the rules refuse stops the replay at that change, with nothing applied', () => {
    // b is on top of a, so a cannot be lifted (BR-03): the second kept change breaks a rule.
    const kept: Command[] = [
      { kind: 'place', containerId: mine.id, to: '180682' },
      { kind: 'move', from: '180282', to: '180684' },
      { kind: 'unplace', from: '180284' },
    ];
    expect(overlapsBySlot(kept, server)).toEqual([]);
    const { ctx, state } = serverVersion(server);
    const r = replayOnto(state, ctx, kept);
    expect(r).toMatchObject({ ok: false, index: 1, command: kept[1] });
    if (!r.ok) expect(r.reason).toMatch(/\w/);
    expect(state.placements.get('180682')).toBeUndefined();
  });
});
