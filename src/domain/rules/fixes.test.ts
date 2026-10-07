import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/commands';
import { box, customSetup, sampleSetup, type Setup } from '../testing/fixtures';
import type { Violation } from '../types';
import { suggestFix } from './fixes';
import { revalidate, validateAll } from './validate';

/** Applies the fix with the rule check, and returns the violations after it. */
function applyFix(setup: Setup, v: Violation, all: Violation[]) {
  const fix = suggestFix(v, setup.state, setup.ctx);
  if (fix.kind !== 'fix') throw new Error(`No fix: ${fix.reason}`);
  const r = applyCommand(setup.state, setup.ctx, fix.command);
  if (!r.ok) throw new Error(`Fix refused: ${r.reason}`);
  return { fix, after: revalidate(all, r.state, setup.ctx, r.touched) };
}

describe('fix suggestions for the golden fixture', () => {
  const setup = sampleSetup();
  const all = validateAll(setup.state, setup.ctx);
  const v = (id: string) => all.find((x) => x.id === id)!;

  it.each([
    'stack:18-4-D',
    'dg:140284-140484',
    'overstow:100382',
    'overstow:420882',
    'twenty:290284',
    'heavy:460612',
  ])('%s: the fix resolves it and creates no new error', (id) => {
    const { after } = applyFix(setup, v(id), all);
    expect(after.some((x) => x.id === id)).toBe(false);
    const before = new Set(all.map((x) => x.id));
    expect(after.filter((x) => x.severity === 'error' && !before.has(x.id))).toEqual([]);
  });

  it('R1 moves the top container to the nearest valid slot, same bay first', () => {
    const { fix } = applyFix(setup, v('stack:18-4-D'), all);
    expect(fix.text).toMatch(/^Move NSPU 771032 1 \(17\.1 t\) to 18\d{4}$/);
    expect(fix.command).toMatchObject({ kind: 'move', from: '180488' });
  });

  it('R2 says why when no plug slot is free, and offers Unplace', () => {
    expect(suggestFix(v('reefer:220610'), setup.state, setup.ctx)).toEqual({
      kind: 'none',
      reason: 'No free slot with a reefer plug on board',
      alternative: { text: 'Unplace NSPU 220417 3', command: { kind: 'unplace', from: '220610' } },
    });
  });

  it('R3 moves one of the two to a deck slot at least two bays away', () => {
    const { fix } = applyFix(setup, v('dg:140284-140484'), all);
    expect(fix.text).toMatch(
      /^Move IMDG (3|5\.1) NSPU \d{6} \d to \d{6} \(separated by \d+ bays\)$/,
    );
    if (fix.command.kind !== 'move') throw new Error('expected a move');
    expect(Number(fix.command.to.slice(4))).toBeGreaterThanOrEqual(82);
  });

  it('R4 swaps the blocked container with the top one when that orders the stack', () => {
    expect(suggestFix(v('overstow:100382'), setup.state, setup.ctx)).toMatchObject({
      kind: 'fix',
      text: 'Swap with NSPU 905127 3 at 100386, 0 restows',
      command: { kind: 'swap', a: '100382', b: '100386' },
    });
    expect(suggestFix(v('overstow:420882'), setup.state, setup.ctx)).toMatchObject({
      text: 'Swap with NSPU 552870 6 at 420884, 0 restows',
    });
  });

  it('R5 moves the 20ft container to an empty deck stack or a 20ft stack', () => {
    const { fix } = applyFix(setup, v('twenty:290284'), all);
    expect(fix.text).toMatch(
      /^Move to (empty deck stack \d{6} \(on hatch\)|empty hold stack \d{6}|\d{6}, on a 20ft stack)$/,
    );
    if (fix.command.kind !== 'move') throw new Error('expected a move');
    expect(Number(fix.command.to.slice(0, 2)) % 2).toBe(1);
  });

  it('R6 swaps the two containers', () => {
    expect(suggestFix(v('heavy:460612'), setup.state, setup.ctx)).toMatchObject({
      kind: 'fix',
      text: 'Swap with NSPU 640033 2 at 460610, heavy box below',
      command: { kind: 'swap', a: '460612', b: '460610' },
    });
  });
});

describe('fix suggestions, other cases', () => {
  it('R4 reorders the stack as one batch command when one swap is not enough', () => {
    const setup = customSetup([
      { key: '180282', c: box({ pod: 'LKCMB' }) },
      { key: '180284', c: box({ pod: 'AEJEA' }) },
      { key: '180286', c: box({ pod: 'NLRTM' }) },
      { key: '180288', c: box({ pod: 'DEHAM' }) },
    ]);
    const all = validateAll(setup.state, setup.ctx);
    const first = all.find((x) => x.slot === '180282')!;
    const { fix, after } = applyFix(setup, first, all);
    expect(fix.command.kind).toBe('batch');
    expect(fix.text).toBe('Reorder stack 18-02 deck: 2 swaps, 0 restows');
    expect(after.filter((x) => x.rule === 'overstow')).toEqual([]);
  });

  it('gives no fix, with a reason, when the container to move is locked', () => {
    const setup = customSetup([
      { key: '180282', c: box({ weightT: 30 }) },
      { key: '180284', c: box({ weightT: 30 }) },
      { key: '180286', c: box({ weightT: 30.1 }), locked: true },
    ]);
    const [v] = validateAll(setup.state, setup.ctx);
    expect(suggestFix(v!, setup.state, setup.ctx)).toEqual({
      kind: 'none',
      reason: 'The container to move is locked',
    });
  });

  it('gives no fix when moving the top container does not bring the stack under the limit', () => {
    const setup = customSetup([
      { key: '180282', c: box({ weightT: 35 }) },
      { key: '180284', c: box({ weightT: 35 }) },
      { key: '180286', c: box({ weightT: 25 }) },
      { key: '180288', c: box({ weightT: 5 }) },
    ]);
    const [v] = validateAll(setup.state, setup.ctx);
    expect(suggestFix(v!, setup.state, setup.ctx)).toEqual({
      kind: 'none',
      reason: 'Moving the top container is not enough to bring the stack under its limit',
    });
  });

  it('R6 gives no fix when the lighter container below is a different length', () => {
    const setup = customSetup([
      { key: '170282', c: box({ type: '20GP', weightT: 5 }) },
      { key: '190282', c: box({ type: '20GP', weightT: 20 }) },
      { key: '180284', c: box({ weightT: 25 }) },
    ]);
    const [v] = validateAll(setup.state, setup.ctx);
    expect(v?.rule).toBe('heavy');
    expect(suggestFix(v!, setup.state, setup.ctx)).toEqual({
      kind: 'none',
      reason: 'The lighter container below is a different length, so they cannot be swapped',
    });
  });
});
