import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/commands';
import { stackEntries } from '../plan/state';
import { sampleSetup } from '../testing/fixtures';
import { suggestFix } from './fixes';
import { checkPlacement } from './placement';
import { revalidate, summarize, validateAll } from './validate';

const { ctx, state } = sampleSetup();

describe('golden fixture (SRS "Golden fixture")', () => {
  const violations = validateAll(state, ctx);

  it('gives exactly the 7 violations, errors first, in rule order R1 to R6', () => {
    expect(violations.map((v) => [v.rule, v.slot, v.severity, v.message])).toEqual([
      ['stack', '180488', 'error', 'Stack 18-04 deck: 96.4 t of 90.0 t limit'],
      ['reefer', '220610', 'error', 'Reefer NSPU 220417 3 at 220610 has no plug'],
      ['dg', '140284', 'error', 'IMDG 3 next to IMDG 5.1 in bay 14'],
      ['overstow', '100382', 'error', 'Colombo box under Rotterdam box at 100382, 2 restow moves'],
      ['overstow', '420882', 'error', 'Jebel Ali box under Hamburg box at 420882, 1 restow move'],
      ['twenty', '290284', 'error', '20ft NSPU 318204 6 at 290284 sits on 40ft stack in bay 30'],
      ['heavy', '460612', 'warning', 'Heavy over light at 460612: 30.2 t above 8.4 t'],
    ]);
    expect(summarize(violations)).toEqual({ errors: 6, warnings: 1 });
  });

  it('gives stable ids, the containers involved and the data', () => {
    const byRule = (slot: string) => violations.find((v) => v.slot === slot)!;
    expect(violations.map((v) => v.id)).toEqual([
      'stack:18-4-D',
      'reefer:220610',
      'dg:140284-140484',
      'overstow:100382',
      'overstow:420882',
      'twenty:290284',
      'heavy:460612',
    ]);
    expect(byRule('180488').slotKeys.sort()).toEqual(['180482', '180484', '180486', '180488']);
    expect(byRule('180488').data?.overT).toBeCloseTo(6.4, 9);
    expect(byRule('140284').slotKeys).toEqual(['140284', '140484']);
    expect(byRule('100382').data).toEqual({ restows: 2, port: 'LKCMB' });
    expect(byRule('420882').data).toEqual({ restows: 1, port: 'AEJEA' });
    expect(byRule('290284').slotKeys).toEqual(['290284', '300282']);
    expect(byRule('460612').slotKeys).toEqual(['460612', '460610']);
    expect(violations.map((v) => v.bay)).toEqual([18, 22, 14, 10, 42, 30, 46]);
  });
});

describe('acceptance scenarios on the rule engine', () => {
  it('AT-02: NSPU 551208 4 on 180688 is refused on stack weight', () => {
    const c = ctx.containers.get('NSPU 551208 4')!;
    const check = checkPlacement(state, ctx, c, '180688');
    expect(check).toMatchObject({
      target: true,
      valid: false,
      reason: 'Stack limit: 96.4 t of 90.0 t',
    });
    const res = applyCommand(state, ctx, { kind: 'place', containerId: c.id, to: '180688' });
    expect(res).toEqual({ ok: false, reason: 'Stack limit: 96.4 t of 90.0 t', rule: 'stack' });
  });

  it('AT-04: the stack weight fix takes 7 violations to 6 and 18-04 to 79.3 t; undo gives 7', () => {
    const before = validateAll(state, ctx);
    const fix = suggestFix(before[0]!, state, ctx);
    expect(fix.kind).toBe('fix');
    if (fix.kind !== 'fix') return;
    const res = applyCommand(state, ctx, fix.command);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const after = revalidate(before, res.state, ctx, res.touched);
    expect(after).toHaveLength(6);
    expect(after.some((v) => v.id === 'stack:18-4-D')).toBe(false);
    const sum = stackEntries(res.state, ctx, '18-4-D').reduce((a, e) => a + e.container.weightT, 0);
    expect(sum.toFixed(1)).toBe('79.3');

    const undo = applyCommand(res.state, ctx, res.inverse, { check: false });
    expect(undo.ok).toBe(true);
    if (!undo.ok) return;
    expect(validateAll(undo.state, ctx)).toEqual(before);
    expect(undo.state).toEqual(state);
  });
});
