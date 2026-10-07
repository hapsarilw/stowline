import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { diffPlacements, InstanceTable } from './instances';

describe('InstanceTable', () => {
  it('packs instances: removing one moves the last one into its place', () => {
    const t = new InstanceTable();
    expect(['a', 'b', 'c', 'd'].map((k) => t.add(k))).toEqual([0, 1, 2, 3]);
    expect(t.remove('b')).toEqual({ from: 3, to: 1 });
    expect(t.keys).toEqual(['a', 'd', 'c']);
    expect(t.index.get('d')).toBe(1);
    expect(t.remove('c')).toBeNull();
    expect(t.count).toBe(2);
    expect(() => t.add('a')).toThrow();
    expect(() => t.remove('x')).toThrow();
    t.clear();
    expect(t.count).toBe(0);
  });

  it('keeps keys and index in step for any sequence of adds and removes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 0, max: 30 })), { maxLength: 200 }),
        (ops) => {
          const t = new InstanceTable();
          const live = new Set<string>();
          for (const [add, n] of ops) {
            const key = `k${n}`;
            if (add && !live.has(key)) {
              t.add(key);
              live.add(key);
            } else if (!add && live.has(key)) {
              t.remove(key);
              live.delete(key);
            }
          }
          expect(new Set(t.keys)).toEqual(live);
          t.keys.forEach((k, i) => expect(t.index.get(k)).toBe(i));
          expect(t.index.size).toBe(t.count);
        },
      ),
    );
  });
});

describe('diffPlacements', () => {
  it('finds only the placements a command touched', () => {
    const { ctx, state } = sampleSetup();
    expect(diffPlacements(state.placements, state.placements)).toEqual({ removed: [], added: [] });
    const r = applyCommand(state, ctx, { kind: 'swap', a: '100382', b: '100386' });
    if (!r.ok) throw new Error(r.reason);
    const d = diffPlacements(state.placements, r.state.placements);
    expect(d.removed.sort()).toEqual(['100382', '100386']);
    expect(d.added.sort()).toEqual(['100382', '100386']);
    const lock = applyCommand(state, ctx, { kind: 'lock', at: '180486' });
    if (!lock.ok) throw new Error(lock.reason);
    expect(diffPlacements(state.placements, lock.state.placements)).toEqual({
      removed: ['180486'],
      added: ['180486'],
    });
  });
});
