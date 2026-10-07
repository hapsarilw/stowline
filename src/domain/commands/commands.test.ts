import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StowContext } from '../plan/context';
import type { StowState } from '../plan/state';
import { pickArb, pickCommand, snapshot } from '../testing/commands';
import { box, customSetup, sampleSetup } from '../testing/fixtures';
import type { Command } from '../types';
import { applyCommand, touchedStacks } from './commands';

function ok(s: StowState, ctx: StowContext, cmd: Command, check = true) {
  const r = applyCommand(s, ctx, cmd, { check });
  if (!r.ok) throw new Error(`Refused: ${r.reason}`);
  return r;
}

describe('commands', () => {
  const a = box({ id: 'NSPU 100001 1', weightT: 20 });
  const b = box({ id: 'NSPU 100002 2', weightT: 18 });
  const spare = box({ id: 'NSPU 100003 3', weightT: 15 });
  const setup = () =>
    customSetup(
      [
        { key: '180282', c: a },
        { key: '180284', c: b },
      ],
      [spare],
    );

  it('place puts a container in a slot; its inverse is unplace', () => {
    const { ctx, state } = setup();
    const r = ok(state, ctx, { kind: 'place', containerId: spare.id, to: '180286' });
    expect(r.state.placements.get('180286')).toEqual({
      containerId: spare.id,
      slotKey: '180286',
      half: 'both',
      locked: false,
      origin: 'thisCall',
    });
    expect(r.state.slotOf.get(spare.id)).toBe('180286');
    expect(r.inverse).toEqual({ kind: 'unplace', from: '180286' });
    expect(r.touched).toEqual(['18-2-D']);
    expect(snapshot(ok(r.state, ctx, r.inverse, false).state)).toEqual(snapshot(state));
  });

  it('refuses to place a container that is already on board, or unknown', () => {
    const { ctx, state } = setup();
    expect(applyCommand(state, ctx, { kind: 'place', containerId: a.id, to: '180682' })).toEqual({
      ok: false,
      reason: 'NSPU 100001 1 is already placed',
    });
    expect(applyCommand(state, ctx, { kind: 'place', containerId: 'X', to: '180682' })).toEqual({
      ok: false,
      reason: 'Unknown container X',
    });
  });

  it('move takes the top container to another slot; its inverse moves it back', () => {
    const { ctx, state } = setup();
    const r = ok(state, ctx, { kind: 'move', from: '180284', to: '220282' });
    expect(r.state.placements.has('180284')).toBe(false);
    expect(r.state.placements.get('220282')?.containerId).toBe(b.id);
    expect(r.inverse).toEqual({ kind: 'move', from: '220282', to: '180284' });
    expect(r.touched).toEqual(['18-2-D', '22-2-D']);
    expect(snapshot(ok(r.state, ctx, r.inverse, false).state)).toEqual(snapshot(state));
  });

  it('refuses to move or unplace a container that is not on top (BR-03)', () => {
    const { ctx, state } = setup();
    expect(applyCommand(state, ctx, { kind: 'move', from: '180282', to: '220282' })).toEqual({
      ok: false,
      reason: 'NSPU 100001 1 is under other containers. Only the top of a stack can be moved.',
    });
    expect(applyCommand(state, ctx, { kind: 'unplace', from: '180282' }).ok).toBe(false);
  });

  it('refuses to move, unplace or swap a locked container (BR-04)', () => {
    const { ctx, state } = setup();
    const locked = ok(state, ctx, { kind: 'lock', at: '180284' });
    expect(locked.inverse).toEqual({ kind: 'unlock', at: '180284' });
    expect(locked.touched).toEqual([]);
    const s = locked.state;
    expect(s.placements.get('180284')?.locked).toBe(true);
    for (const cmd of [
      { kind: 'move', from: '180284', to: '220282' },
      { kind: 'unplace', from: '180284' },
      { kind: 'swap', a: '180282', b: '180284' },
    ] as Command[]) {
      const r = applyCommand(s, ctx, cmd);
      expect(r).toEqual({ ok: false, reason: 'NSPU 100002 2 at 180284 is locked' });
    }
    expect(applyCommand(s, ctx, { kind: 'lock', at: '180284' }).ok).toBe(false);
    expect(snapshot(ok(s, ctx, locked.inverse).state)).toEqual(snapshot(state));
  });

  it('swap exchanges two containers, also below the top (D2), and is its own inverse', () => {
    const { ctx, state } = setup();
    const r = ok(state, ctx, { kind: 'swap', a: '180282', b: '180284' });
    expect(r.state.placements.get('180282')?.containerId).toBe(b.id);
    expect(r.state.placements.get('180284')?.containerId).toBe(a.id);
    expect(r.inverse).toEqual({ kind: 'swap', a: '180282', b: '180284' });
    expect(snapshot(ok(r.state, ctx, r.inverse).state)).toEqual(snapshot(state));
  });

  it('refuses to swap containers of different lengths', () => {
    const { ctx, state } = customSetup([
      { key: '180282', c: a },
      { key: '210282', c: box({ type: '20GP' }) },
    ]);
    expect(applyCommand(state, ctx, { kind: 'swap', a: '180282', b: '210282' })).toEqual({
      ok: false,
      reason: 'Only containers of the same length can be swapped',
    });
  });

  it('refuses a command that creates a new error, with the reason', () => {
    const early = box({ pod: 'LKCMB' });
    const late = box({ pod: 'DEHAM' });
    const { ctx, state } = customSetup([
      { key: '180282', c: late },
      { key: '180284', c: early },
    ]);
    expect(applyCommand(state, ctx, { kind: 'swap', a: '180282', b: '180284' })).toEqual({
      ok: false,
      reason: 'Colombo box under Hamburg box at 180282, 1 restow move',
      rule: 'overstow',
    });
    // Without the check (undo and redo), the same command is applied.
    expect(
      applyCommand(state, ctx, { kind: 'swap', a: '180282', b: '180284' }, { check: false }).ok,
    ).toBe(true);
  });

  it('counts a move of a container loaded at an earlier port as a shift (BR-17)', () => {
    const old = box({ pol: 'IDJKT' });
    const { ctx, state } = customSetup([{ key: '180282', c: old, origin: 'onboard' }]);
    const r = ok(state, ctx, { kind: 'move', from: '180282', to: '220282' });
    expect(r.state.shiftCount).toBe(1);
    const r2 = ok(r.state, ctx, { kind: 'move', from: '220282', to: '260282' });
    expect(r2.state.shiftCount).toBe(1);
    const back = ok(r2.state, ctx, { kind: 'move', from: '260282', to: '180282' });
    expect(back.state.shiftCount).toBe(0);
    expect(back.state.placements.get('180282')?.origin).toBe('onboard');
  });

  it('refuses to unplace a container loaded at an earlier port (D3)', () => {
    const old = box({ id: 'NSPU 100009 9', pol: 'IDJKT' });
    const { ctx, state } = customSetup([{ key: '180282', c: old, origin: 'onboard' }]);
    expect(applyCommand(state, ctx, { kind: 'unplace', from: '180282' })).toEqual({
      ok: false,
      reason: 'NSPU 100009 9 was loaded at an earlier port and cannot be unplaced',
    });
  });

  it('runs a batch as one command, all or nothing, with one inverse', () => {
    const { ctx, state } = setup();
    const batch: Command = {
      kind: 'batch',
      commands: [
        { kind: 'move', from: '180284', to: '220282' },
        { kind: 'move', from: '180282', to: '260282' },
      ],
    };
    const r = ok(state, ctx, batch);
    expect(r.state.placements.size).toBe(2);
    expect(r.touched).toEqual(['18-2-D', '22-2-D', '26-2-D']);
    expect(r.inverse).toEqual({
      kind: 'batch',
      commands: [
        { kind: 'move', from: '260282', to: '180282' },
        { kind: 'move', from: '220282', to: '180284' },
      ],
    });
    expect(snapshot(ok(r.state, ctx, r.inverse, false).state)).toEqual(snapshot(state));
    const bad: Command = {
      kind: 'batch',
      commands: [
        { kind: 'move', from: '180284', to: '220282' },
        { kind: 'move', from: '180284', to: '260282' },
      ],
    };
    expect(applyCommand(state, ctx, bad)).toEqual({ ok: false, reason: 'No container at 180284' });
    expect(applyCommand(state, ctx, { kind: 'batch', commands: [] }).ok).toBe(false);
  });

  it('names the stacks a command touches', () => {
    expect(touchedStacks({ kind: 'swap', a: '290284', b: '180202' })).toEqual(['30-2-D', '18-2-H']);
    expect(touchedStacks({ kind: 'lock', at: '180202' })).toEqual([]);
  });
});

// Property: any command followed by its inverse returns the same plan (SRS test plan).

const { ctx: sctx, state: seed } = sampleSetup();

describe('property: command then inverse returns the same plan', () => {
  it('holds for single commands on the seeded plan, checked and unchecked', () => {
    const before = snapshot(seed);
    fc.assert(
      fc.property(pickArb, fc.boolean(), (p, check) => {
        const cmd = pickCommand(seed, sctx, p);
        const r = applyCommand(seed, sctx, cmd, { check });
        if (!r.ok) return;
        const back = applyCommand(r.state, sctx, r.inverse, { check: false });
        expect(back.ok).toBe(true);
        if (back.ok) expect(snapshot(back.state)).toEqual(before);
      }),
      { numRuns: 300 },
    );
  });

  it('holds for sequences: undo in reverse order returns to the start', () => {
    const before = snapshot(seed);
    fc.assert(
      fc.property(fc.array(pickArb, { maxLength: 12 }), (picks) => {
        let s = seed;
        const inverses: Command[] = [];
        for (const p of picks) {
          const r = applyCommand(s, sctx, pickCommand(s, sctx, p));
          if (!r.ok) continue;
          s = r.state;
          inverses.push(r.inverse);
        }
        for (const inv of inverses.reverse()) {
          const r = applyCommand(s, sctx, inv, { check: false });
          expect(r.ok).toBe(true);
          if (r.ok) s = r.state;
        }
        expect(snapshot(s)).toEqual(before);
      }),
      { numRuns: 60 },
    );
  });
});
