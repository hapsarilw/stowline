import { describe, expect, it } from 'vitest';
import { validateAll } from '../rules/validate';
import { strengthPosition } from '../stability/model';
import { box, customSetup, sampleSetup } from '../testing/fixtures';
import { liftOrder, podCounts, portStops } from './ports';

const { ctx, state } = sampleSetup();
const violations = validateAll(state, ctx);

describe('POD counts', () => {
  it('match the legend of the design: CMB 562, JEA 674, RTM 837, HAM 667', () => {
    expect(podCounts(state, ctx)).toEqual({ LKCMB: 562, AEJEA: 674, NLRTM: 837, DEHAM: 667 });
  });
});

describe('port stops (FR-55)', () => {
  const stops = portStops(state, ctx, violations);

  it('has the departure and one stop per port of discharge, in rotation order', () => {
    expect(stops.map((s) => s.code)).toEqual(['SGSIN', 'LKCMB', 'AEJEA', 'NLRTM', 'DEHAM']);
    expect(stops[0]).toMatchObject({ name: 'Singapore', discharge: 0, restows: 0 });
    expect(stops.map((s) => s.discharge)).toEqual([0, 562, 674, 837, 667]);
  });

  it('AT-07: Colombo needs 2 restows and Jebel Ali 1, from the overstow check', () => {
    expect(stops.map((s) => s.restows)).toEqual([0, 2, 1, 0, 0]);
  });

  it('follows the plan: no overstow, no restows', () => {
    const none = violations.filter((v) => v.rule !== 'overstow');
    expect(portStops(state, ctx, none).every((s) => s.restows === 0)).toBe(true);
  });
});

describe('lift order (FR-56)', () => {
  const order = liftOrder(state, ctx, 'LKCMB');

  it('has every container for the port once', () => {
    expect(order).toHaveLength(562);
    expect(new Set(order).size).toBe(562);
    for (const k of order) {
      const c = ctx.containers.get(state.placements.get(k)!.containerId)!;
      expect(c.pod).toBe('LKCMB');
    }
  });

  it('lifts deck before hold, then from the bow aft, then from the top down', () => {
    const deck = (k: string) => +k.slice(4, 6) >= 82;
    const firstHold = order.findIndex((k) => !deck(k));
    expect(order.slice(firstHold).every((k) => !deck(k))).toBe(true);
    for (const part of [order.slice(0, firstHold), order.slice(firstHold)])
      for (let i = 1; i < part.length; i++) {
        const a = ctx.geometry.slotPos(part[i - 1]!);
        const b = ctx.geometry.slotPos(part[i]!);
        expect(a.x > b.x || (a.x === b.x && a.z >= b.z)).toBe(true);
      }
  });

  it('is empty for a port with nothing on board', () => {
    const { ctx: c2, state: s2 } = customSetup([{ key: '180482', c: box({ pod: 'DEHAM' }) }]);
    expect(liftOrder(s2, c2, 'LKCMB')).toEqual([]);
    expect(liftOrder(s2, c2, 'DEHAM')).toEqual(['180482']);
  });
});

describe('strength axis', () => {
  it('places each bay between the bow (0) and the stern (1), in order', () => {
    const xs = ctx.vessel.bays.map((b) => strengthPosition(ctx, b.bay));
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs.at(-1)).toBeLessThan(1);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]!);
  });
});
