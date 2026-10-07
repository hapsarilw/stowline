import { describe, expect, it } from 'vitest';
import { generateSampleCall } from '@/domain';
import { defaultQuery, queryRows, sortBy, toRows, type ListQuery } from './query';

const call = generateSampleCall();
const slotOf = new Map(
  call.loadList.filter((x) => x.plannedSlotKey).map((x) => [x.container.id, x.plannedSlotKey]),
);
const rows = toRows(
  call.loadList.map((x) => x.container),
  slotOf,
);
const run = (patch: Partial<ListQuery> = {}) => queryRows(rows, { ...defaultQuery(), ...patch });

describe('load list query', () => {
  it('starts with unplanned rows, heaviest first', () => {
    const r = run();
    expect(r).toHaveLength(928);
    expect(r.every((x) => x.slot === '')).toBe(true);
    const w = r.map((x) => x.container.weightT);
    expect(w).toEqual([...w].sort((a, b) => b - a));
  });

  it('shows planned rows with their slot when "unplanned only" is off', () => {
    const r = run({ unplannedOnly: false });
    expect(r).toHaveLength(1240);
    expect(r.filter((x) => x.slot !== '')).toHaveLength(312);
  });

  it('filters by POD, type, reefer and dangerous goods', () => {
    expect(run({ pod: 'NLRTM' }).every((x) => x.container.pod === 'NLRTM')).toBe(true);
    expect(run({ type: 'TK' }).every((x) => x.container.type === 'TK')).toBe(true);
    expect(run({ reefer: true }).every((x) => x.container.type === 'RF')).toBe(true);
    expect(run({ dg: true }).every((x) => x.container.imdgClass !== undefined)).toBe(true);
    const both = run({ pod: 'AEJEA', type: '40HC' });
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((x) => x.container.pod === 'AEJEA' && x.container.type === '40HC')).toBe(
      true,
    );
    expect(run({ pod: 'AEJEA' }).length).toBeLessThan(928);
  });

  it('searches ID, POD code and name, type and slot', () => {
    expect(run({ q: 'NSPU 551208' }).map((x) => x.container.id)).toEqual(['NSPU 551208 4']);
    expect(run({ q: 'rotterdam' }).every((x) => x.container.pod === 'NLRTM')).toBe(true);
    expect(run({ q: 'nlrtm' }).length).toBe(run({ q: 'rotterdam' }).length);
    expect(run({ q: '  tk ', type: null }).every((x) => x.container.type === 'TK')).toBe(true);
    const planned = rows.find((x) => x.slot)!;
    expect(run({ q: planned.slot, unplannedOnly: false }).map((x) => x.container.id)).toContain(
      planned.container.id,
    );
    expect(run({ q: 'no such container' })).toEqual([]);
  });

  it('sorts by any column, including Flags (FR-13)', () => {
    const asc = run({ sortKey: 'id', sortDir: 1 }).map((x) => x.container.id);
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    const type = run({ sortKey: 'type', sortDir: 1 }).map((x) => x.container.type);
    expect(type).toEqual([...type].sort((a, b) => a.localeCompare(b)));
    const pods = run({ sortKey: 'pod', sortDir: 1 }).map((x) => x.container.pod);
    expect(pods[0]).toBe('LKCMB');
    expect(pods[pods.length - 1]).toBe('DEHAM');
    const flags = run({ sortKey: 'flags', sortDir: -1 }).map((x) => x.container);
    expect(flags[0]!.type === 'RF' && flags[0]!.imdgClass !== undefined).toBe(true);
    const rank = (c: (typeof flags)[number]) => (c.type === 'RF' ? 2 : 0) + (c.imdgClass ? 1 : 0);
    expect(flags.map(rank)).toEqual([...flags.map(rank)].sort((a, b) => b - a));
  });

  it('keeps list order for equal rows', () => {
    const r = run({ sortKey: 'type', sortDir: 1, type: 'OT' }).map((x) => x.container.id);
    const order = rows
      .filter((x) => x.container.type === 'OT' && !x.slot)
      .map((x) => x.container.id);
    expect(r).toEqual(order);
  });

  it('flips the direction on a second click and starts each column the usual way', () => {
    const q = defaultQuery();
    expect(sortBy(q, 'weight')).toEqual({ sortKey: 'weight', sortDir: 1 });
    expect(sortBy(q, 'id')).toEqual({ sortKey: 'id', sortDir: 1 });
    expect(sortBy({ ...q, sortKey: 'id', sortDir: 1 }, 'id')).toEqual({
      sortKey: 'id',
      sortDir: -1,
    });
    expect(sortBy(q, 'flags')).toEqual({ sortKey: 'flags', sortDir: -1 });
  });
});
