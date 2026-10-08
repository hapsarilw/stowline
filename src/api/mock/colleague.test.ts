import { describe, expect, it } from 'vitest';
import { applyCommand, slotsOf, type Command } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { colleagueChanges, COLLEAGUE_LOCK } from './colleague';

// The colleague's save behind the forced 409 (decision 6): commands that are valid on the
// seeded plan, as the mock's version 15. The design's examples (a move into 180284, a lock of
// 180204) do not fit the seeded plan; these are made from it.

describe('colleagueChanges', () => {
  const { ctx, state, call } = sampleSetup();
  const loadList = call.loadList.map((x) => x.container);

  it('places, moves and locks, each valid with the rule check, in order', () => {
    const cmds = colleagueChanges(state, ctx, loadList);
    expect(cmds.map((c) => c.kind)).toEqual(['place', 'move', 'lock']);
    let s = state;
    for (const c of cmds) {
      const r = applyCommand(s, ctx, c);
      expect(r.ok, JSON.stringify(c)).toBe(true);
      if (r.ok) s = r.state;
    }
  });

  it('keeps clear of bay 18, where AT-13 moves NSPU 771032 1 to 180688', () => {
    const slots = colleagueChanges(state, ctx, loadList).flatMap((c: Command) => slotsOf(c));
    expect(
      slots.filter((k) => k.startsWith('17') || k.startsWith('18') || k.startsWith('19')),
    ).toEqual([]);
  });

  it('is the same every time, and locks the slot AT-14 uses', () => {
    const a = colleagueChanges(state, ctx, loadList);
    expect(colleagueChanges(state, ctx, loadList)).toEqual(a);
    expect(a[2]).toEqual({ kind: 'lock', at: COLLEAGUE_LOCK });
    // The locked container is on top of its stack, so a planner could move it on version 14.
    const top = applyCommand(
      state,
      ctx,
      { kind: 'unplace', from: COLLEAGUE_LOCK },
      { check: false },
    );
    expect(top.ok).toBe(true);
  });
});
