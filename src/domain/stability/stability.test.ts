import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands/commands';
import { halfOfKey, parseKey } from '../geometry';
import { createStowState } from '../plan/state';
import { nextFreeSlots } from '../rules/placement';
import { sampleSetup } from '../testing/fixtures';
import { gaugeState } from './gauges';
import { calibrateStability, computeStability, referenceCurves } from './model';

const { ctx, state, call } = sampleSetup();
const base = calibrateStability(state, ctx);
const seeded = computeStability(state, ctx, base);
const L = ctx.vessel.limits;

/** The first empty 40ft slot that matches. The model does not need the slot to be supported. */
const empty = (match: (p: { bay: number; row: number; tier: number }) => boolean) => {
  const key = ctx.geometry.slots40().find((k) => !state.placements.has(k) && match(parseKey(k)));
  if (!key) throw new Error('No empty slot');
  return key;
};

/** Stability with one more container in the given slot. */
const place = (id: string, to: string) => {
  const extra = {
    containerId: id,
    slotKey: to,
    half: halfOfKey(to),
    locked: false,
    origin: 'thisCall' as const,
  };
  return computeStability(createStowState([...state.placements.values(), extra]), ctx, base);
};

describe('seeded plan (SRS "Stability model")', () => {
  it('reads GM 1.84, trim 0.62 by the stern, list 0.4 to port, drafts 12.10 and 12.72', () => {
    expect(seeded.gm).toBeCloseTo(1.84, 9);
    expect(seeded.trim).toBeCloseTo(0.62, 9);
    expect(seeded.list).toBeCloseTo(0.4, 9);
    expect(seeded.draftFwd).toBeCloseTo(12.1, 9);
    expect(seeded.draftAft).toBeCloseTo(12.72, 9);
    expect(seeded.draftMean).toBeCloseTo(12.41, 9);
    expect(seeded.displacementT).toBeCloseTo(98420, 6);
    expect(seeded.deadweightT).toBeCloseTo(71260, 6);
    expect(seeded.kg).toBeCloseTo(15.62, 9);
  });

  it('reads bending moment 78% and shear force 64%', () => {
    expect(seeded.bmPct).toBeCloseTo(78, 9);
    expect(seeded.sfPct).toBeCloseTo(64, 9);
    expect(seeded.bmCurve).toHaveLength(61);
    expect(seeded.sfCurve).toHaveLength(61);
    expect(seeded.bmCurve).toEqual(referenceCurves().bm);
  });

  it('shows the states from the design: GM, trim, BM/SF OK and list Check', () => {
    expect(gaugeState('gm', seeded.gm, L)).toBe('ok');
    expect(gaugeState('trim', seeded.trim, L)).toBe('ok');
    expect(gaugeState('list', seeded.list, L)).toBe('check');
    expect(gaugeState('strength', seeded.bmPct, L)).toBe('ok');
  });
});

describe('response to the plan', () => {
  const light = call.loadList.find((x) => x.plannedSlotKey === '' && x.container.lengthFt === 40)!
    .container.id;

  it('adds displacement and sinkage for added weight', () => {
    const w = ctx.containers.get(light)!.weightT;
    const s = place(
      light,
      empty(() => true),
    );
    expect(s.displacementT - seeded.displacementT).toBeCloseTo(w, 9);
    expect(s.draftMean - seeded.draftMean).toBeCloseTo(w / (100 * 125), 9);
  });

  it('lowers GM for weight high up, trims by the head for weight forward, lists to the loaded side', () => {
    const high = place(
      light,
      empty((p) => p.tier === 92),
    );
    expect(high.gm).toBeLessThan(seeded.gm);
    const fwd = place(
      light,
      empty((p) => p.bay <= 10),
    ); // at the bow
    expect(fwd.trim).toBeLessThan(seeded.trim);
    const port = place(
      light,
      empty((p) => p.row === 16),
    ); // far to port
    const stbd = place(
      light,
      empty((p) => p.row === 15),
    ); // far to starboard
    expect(port.list).toBeGreaterThan(seeded.list);
    expect(stbd.list).toBeLessThan(seeded.list);
  });

  it('changes the strength curves with the weight per bay (FR-54)', () => {
    const mid = place(
      light,
      empty((p) => p.bay === 42 || p.bay === 46),
    ); // amidships: less hogging
    expect(mid.bmCurve).not.toEqual(seeded.bmCurve);
    expect(mid.bmPct).toBeLessThan(seeded.bmPct);
    const n = mid.bmCurve.length - 1;
    // The change in shear force and bending moment is zero at both ends of the ship.
    expect(mid.sfCurve[0]! - seeded.sfCurve[0]!).toBeCloseTo(0, 9);
    expect(mid.bmCurve[0]! - seeded.bmCurve[0]!).toBeCloseTo(0, 9);
    expect(mid.sfCurve[n]! - seeded.sfCurve[n]!).toBeCloseTo(0, 9);
    expect(mid.bmCurve[n]! - seeded.bmCurve[n]!).toBeCloseTo(0, 9);
  });

  it('is a pure function: a command and its inverse give the same numbers, with no drift', () => {
    const r = nextFreeSlots(state, ctx, 40, { bays: [18] })
      .map((to) => applyCommand(state, ctx, { kind: 'move', from: '180488', to }))
      .find((x) => x.ok);
    if (!r?.ok) throw new Error('No valid move');
    const back = applyCommand(r.state, ctx, r.inverse, { check: false });
    if (!back.ok) throw new Error(back.reason);
    expect(computeStability(back.state, ctx, base)).toEqual(seeded);
    expect(computeStability(state, ctx, base)).toEqual(seeded);
  });
});

describe('gauge states (BR-12, BR-13, SRS boundary values)', () => {
  it('GM: exactly 1.20 m is not at Limit; under 1.40 m is Check', () => {
    expect(gaugeState('gm', 1.2, L)).toBe('check');
    expect(gaugeState('gm', 1.19, L)).toBe('limit');
    expect(gaugeState('gm', 1.39, L)).toBe('check');
    expect(gaugeState('gm', 1.4, L)).toBe('ok');
  });

  it('list: exactly 2.0 degrees is at Limit; over 0.3 is Check, either side', () => {
    expect(gaugeState('list', 2.0, L)).toBe('limit');
    expect(gaugeState('list', -2.0, L)).toBe('limit');
    expect(gaugeState('list', 1.99, L)).toBe('check');
    expect(gaugeState('list', 0.3, L)).toBe('ok');
    expect(gaugeState('list', -0.31, L)).toBe('check');
  });

  it('trim: over 1.50 m is Limit, over 1.00 m is Check, either direction', () => {
    expect(gaugeState('trim', 1.5, L)).toBe('check');
    expect(gaugeState('trim', -1.51, L)).toBe('limit');
    expect(gaugeState('trim', 1.0, L)).toBe('ok');
    expect(gaugeState('trim', 1.01, L)).toBe('check');
  });

  it('bending moment and shear force: over 100% is Limit, over 85% is Check', () => {
    expect(gaugeState('strength', 85, L)).toBe('ok');
    expect(gaugeState('strength', 85.1, L)).toBe('check');
    expect(gaugeState('strength', 100, L)).toBe('check');
    expect(gaugeState('strength', 100.1, L)).toBe('limit');
  });
});
