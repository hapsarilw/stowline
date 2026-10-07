import { describe, expect, it } from 'vitest';
import { box, customSetup, type Item } from '../testing/fixtures';
import {
  indexViolations,
  revalidate,
  sortViolations,
  validateAll,
  validateStacks,
} from './validate';

const run = (items: Item[]) => {
  const { ctx, state } = customSetup(items);
  return validateAll(state, ctx);
};
const messages = (items: Item[]) => run(items).map((v) => v.message);

describe('R1 stack weight', () => {
  it('counts both 20ft containers in a tier', () => {
    const items: Item[] = [
      { key: '170282', c: box({ type: '20GP', weightT: 25 }) },
      { key: '190282', c: box({ type: '20GP', weightT: 25 }) },
      { key: '180284', c: box({ weightT: 25 }) },
      { key: '180286', c: box({ weightT: 15.1 }) },
    ];
    expect(messages(items)).toEqual(['Stack 18-02 deck: 90.1 t of 90.0 t limit']);
    expect(run(items)[0]).toMatchObject({ id: 'stack:18-2-D', slot: '180286', bay: 18 });
  });
});

describe('R2 reefer power', () => {
  it('passes a reefer in a plug slot and fails one without', () => {
    // Plugs: deck tiers 82 and 84 in bays 14 to 50 (index 3 to 12).
    expect(run([{ key: '140282', c: box({ type: 'RF' }) }])).toEqual([]);
    expect(messages([{ key: '020182', c: box({ id: 'NSPU 111111 1', type: 'RF' }) }])).toEqual([
      'Reefer NSPU 111111 1 at 020182 has no plug',
    ]);
  });

  it('ignores containers that are not reefers', () => {
    expect(run([{ key: '020182', c: box({ type: '40HC' }) }])).toEqual([]);
  });
});

describe('R3 dangerous goods segregation', () => {
  const dg = (key: string, cls: string): Item => ({ key, c: box({ imdgClass: cls }) });

  it('flags incompatible classes left, right, above and below in the same bay', () => {
    expect(run([dg('180282', '3'), dg('180482', '5.1')])).toHaveLength(1); // rows 02 and 04
    expect(run([dg('180282', '3'), dg('180182', '2.1')])).toHaveLength(1); // rows 02 and 01
    expect(run([dg('180282', '1.4'), dg('180284', '3')])).toHaveLength(1); // tiers 82 and 84
  });

  it('flags the same row and tier in the next 40ft bay, forward and aft (D5)', () => {
    const v = run([dg('180282', '3'), dg('220282', '5.1')]);
    expect(v.map((x) => [x.id, x.message])).toEqual([
      ['dg:180282-220282', 'IMDG 3 next to IMDG 5.1 in bay 18'],
    ]);
    expect(run([dg('180282', '3'), dg('140282', '5.1')])).toHaveLength(1);
  });

  it('does not flag two bays away, diagonals, or compatible classes', () => {
    expect(run([dg('180282', '3'), dg('260282', '5.1')])).toEqual([]);
    expect(run([dg('180282', '3'), dg('220482', '5.1')])).toEqual([]);
    expect(run([dg('180282', '3'), dg('180682', '5.1')])).toEqual([]);
    expect(run([dg('180282', '3'), dg('180482', '9')])).toEqual([]);
    expect(run([dg('180282', '5.1'), dg('180482', '1.4')])).toEqual([]);
  });

  it('treats 20ft halves as their own bays: ±2 for 20ft (D5)', () => {
    const t = (key: string, cls: string): Item => ({
      key,
      c: box({ type: '20GP', imdgClass: cls }),
    });
    // Fore and aft halves of the same 40ft slot sit end to end.
    expect(run([t('170282', '3'), t('190282', '5.1')]).map((x) => x.message)).toEqual([
      'IMDG 3 next to IMDG 5.1 in bay 17',
    ]);
    // Aft half of bay 18 (19) and fore half of bay 22 (21).
    expect(run([t('190282', '3'), t('210282', '5.1')])).toHaveLength(1);
    // Fore half of bay 18 (17) and fore half of bay 22 (21) are not neighbours.
    expect(run([t('170282', '3'), t('210282', '5.1')])).toEqual([]);
  });
});

describe('R4 overstow', () => {
  const stack = (pods: string[]): Item[] =>
    pods.map((pod, i) => ({ key: `1802${82 + 2 * i}`, c: box({ pod, weightT: 20 }) }));

  it('counts only the containers above that go to a later port', () => {
    const v = run(stack(['AEJEA', 'LKCMB', 'DEHAM']));
    expect(v.map((x) => [x.slot, x.message, x.data?.restows])).toEqual([
      ['180282', 'Jebel Ali box under Hamburg box at 180282, 1 restow move', 1],
      ['180284', 'Colombo box under Hamburg box at 180284, 1 restow move', 1],
    ]);
  });

  it('passes a stack with later ports lower', () => {
    expect(run(stack(['DEHAM', 'NLRTM', 'NLRTM', 'LKCMB']))).toEqual([]);
  });

  it('only counts containers over the same half', () => {
    const items: Item[] = [
      { key: '170282', c: box({ type: '20GP', pod: 'LKCMB' }) },
      { key: '190282', c: box({ type: '20GP', pod: 'DEHAM' }) },
      { key: '190284', c: box({ type: '20GP', pod: 'DEHAM' }) },
    ];
    expect(run(items)).toEqual([]);
  });
});

describe('R5 20ft and 40ft', () => {
  it('flags a 20ft on a 40ft', () => {
    const v = run([
      { key: '180282', c: box() },
      { key: '170284', c: box({ id: 'NSPU 222222 2', type: '20GP' }) },
    ]);
    expect(v.map((x) => [x.id, x.message])).toEqual([
      ['twenty:170284', '20ft NSPU 222222 2 at 170284 sits on 40ft stack in bay 18'],
    ]);
  });

  it('passes a 40ft on two 20ft, and 20ft on 20ft in the same half', () => {
    expect(
      run([
        { key: '170282', c: box({ type: '20GP' }) },
        { key: '190282', c: box({ type: '20GP' }) },
        { key: '180284', c: box() },
      ]),
    ).toEqual([]);
    expect(
      run([
        { key: '170282', c: box({ type: '20GP' }) },
        { key: '170284', c: box({ type: 'TK' }) },
      ]),
    ).toEqual([]);
  });

  it('flags a 40ft on 20ft containers when one half below is empty', () => {
    const v = run([
      { key: '170282', c: box({ type: '20GP' }) },
      { key: '180284', c: box({ id: 'NSPU 333333 3' }) },
    ]);
    expect(v.map((x) => x.message)).toEqual([
      '40ft NSPU 333333 3 at 180284 sits on 20ft stack with an empty half in bay 18',
    ]);
  });
});

describe('R6 heavy over light', () => {
  it('compares a 40ft on two 20ft with the lighter one', () => {
    const v = run([
      { key: '170282', c: box({ type: '20GP', weightT: 20 }) },
      { key: '190282', c: box({ type: '20GP', weightT: 9 }) },
      { key: '180284', c: box({ weightT: 19.5 }) },
    ]);
    expect(v.map((x) => [x.message, x.slotKeys])).toEqual([
      ['Heavy over light at 180284: 19.5 t above 9.0 t', ['180284', '190282']],
    ]);
  });
});

describe('sorting and incremental checks', () => {
  it('sorts errors first, then rule order, then slot', () => {
    const v = run([
      { key: '180282', c: box({ weightT: 5 }) },
      { key: '180284', c: box({ weightT: 25 }) },
      { key: '020182', c: box({ type: 'RF' }) },
      { key: '020282', c: box({ pod: 'LKCMB' }) },
      { key: '020284', c: box({ pod: 'DEHAM' }) },
    ]);
    expect(sortViolations([...v].reverse())).toEqual(v);
    expect(v.map((x) => x.rule)).toEqual(['reefer', 'overstow', 'heavy']);
  });

  it('checks only the given stacks, and keeps the rest of the old list', () => {
    const { ctx, state } = customSetup([
      { key: '020182', c: box({ type: 'RF' }) },
      { key: '060182', c: box({ type: 'RF' }) },
      { key: '220282', c: box({ type: 'RF' }) },
    ]);
    const all = validateAll(state, ctx);
    expect(all).toHaveLength(2);
    expect(validateStacks(state, ctx, ['2-1-D']).map((v) => v.slot)).toEqual(['020182']);
    expect(revalidate(all, state, ctx, ['2-1-D'])).toEqual(all);
    expect(revalidate([], state, ctx, ['2-1-D'])).toHaveLength(1);
  });
});

describe('violation index', () => {
  it('finds the worst violation per slot and counts per bay', () => {
    const v = run([
      { key: '180282', c: box({ weightT: 5 }) },
      { key: '180284', c: box({ weightT: 25 }) },
      { key: '180286', c: box({ pod: 'LKCMB' }) },
      { key: '180288', c: box({ pod: 'DEHAM', weightT: 25 }) },
    ]);
    const idx = indexViolations(v);
    expect(idx.byBay.get(18)).toBe(v.length);
    // 180284 is in a heavy over light warning and in overstow errors: the error wins.
    expect(v.some((x) => x.severity === 'warning' && x.slotKeys.includes('180284'))).toBe(true);
    expect(idx.bySlot.get('180284')?.severity).toBe('error');
    expect(idx.bySlot.get('180286')?.severity).toBe('error');
    expect(idx.bySlot.get('180282')).toBeDefined();
    expect(indexViolations([]).bySlot.size).toBe(0);
  });
});
