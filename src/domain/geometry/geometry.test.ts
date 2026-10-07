import { describe, expect, it } from 'vitest';
import { HALF_OFFSET_X, SAMPLE_GEOMETRY as G, SAMPLE_VESSEL as V } from './geometry';
import { DECK_TIERS, HOLD_TIERS } from './vessel';

describe('sample vessel geometry', () => {
  it('has 22 bays numbered 02 to 86 in steps of 4', () => {
    expect(V.bays).toHaveLength(22);
    expect(V.bays.map((b) => b.bay)).toEqual(Array.from({ length: 22 }, (_, i) => 2 + 4 * i));
    expect(V.bays.map((b) => b.index)).toEqual(Array.from({ length: 22 }, (_, i) => i));
  });

  it('has 4,292 forty-foot slots', () => {
    expect(G.slotCount40()).toBe(4292);
    const all = G.slots40();
    expect(all).toHaveLength(4292);
    expect(new Set(all).size).toBe(4292);
    expect(all.every((k) => G.slotExists(k))).toBe(true);
  });

  it('has 404 plug slots, all of them real slots', () => {
    expect(V.plugs).toHaveLength(404);
    expect(new Set(V.plugs).size).toBe(404);
    expect(V.plugs.every((k) => G.slotExists(k) && G.hasPlug(k))).toBe(true);
    expect(G.slots40().filter((k) => G.hasPlug(k))).toHaveLength(404);
  });

  it('uses deck tiers 82 to 92 and hold tiers 02 to 16', () => {
    expect(DECK_TIERS).toEqual([82, 84, 86, 88, 90, 92]);
    expect(HOLD_TIERS).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(V.bays.every((b) => b.deckTiers.join() === DECK_TIERS.join())).toBe(true);
    expect(V.bays[0]!.holdTiers).toEqual([8, 10, 12, 14, 16]);
    expect(V.bays[21]!.holdTiers).toEqual(HOLD_TIERS);
  });

  it('makes forward bays narrower and shallower', () => {
    const [b02, b06, b10, b14] = V.bays;
    expect([b02, b06, b10].map((b) => b!.deckRows)).toEqual([10, 12, 14]);
    expect([b02, b06, b10].map((b) => b!.holdRows)).toEqual([8, 10, 12]);
    expect(b02!.holdTiers.length).toBeLessThan(b06!.holdTiers.length);
    expect(b06!.holdTiers.length).toBeLessThan(b10!.holdTiers.length);
    expect(b14!.deckRows).toBe(16);
  });

  it('runs x toward the bow, with the deckhouse between bays 54 and 58', () => {
    const xs = V.bays.map((b) => b.x);
    expect(xs.every((x, i) => i === 0 || x < xs[i - 1]!)).toBe(true);
    expect(xs[0]! + xs[21]!).toBeCloseTo(0, 9);
    expect(V.bays[13]!.bay).toBe(54);
    expect(V.deckhouseX).toBeLessThan(V.bays[13]!.x);
    expect(V.deckhouseX).toBeGreaterThan(V.bays[14]!.x);
  });

  it('knows which slots exist', () => {
    expect(G.slotExists('180486')).toBe(true);
    expect(G.slotExists('180488')).toBe(true);
    expect(G.slotExists('021186')).toBe(false); // bay 02 has 10 deck rows
    expect(G.slotExists('020186')).toBe(true);
    expect(G.slotExists('020102')).toBe(false); // bay 02 hold starts at tier 08
    expect(G.slotExists('020108')).toBe(true);
    expect(G.slotExists('180494')).toBe(false); // no tier 94
    expect(G.slotExists('180086')).toBe(false); // no row 00
    expect(G.slotExists('900486')).toBe(false); // no bay 90
  });

  it('gives a 20ft half the same slot and plug as its 40ft slot', () => {
    const k40 = V.plugs[0]!;
    const bay = +k40.slice(0, 2);
    const row = k40.slice(2, 4);
    const tier = k40.slice(4, 6);
    const fore = String(bay - 1).padStart(2, '0') + row + tier;
    const aft = String(bay + 1).padStart(2, '0') + row + tier;
    expect(G.slotExists(fore)).toBe(true);
    expect(G.hasPlug(fore)).toBe(true);
    expect(G.hasPlug(aft)).toBe(true);
    expect(G.slot(fore)).toMatchObject({ half: 'fore', hasPlug: true });
    expect(G.slot(aft)).toMatchObject({ half: 'aft', hasPlug: true });
    expect(G.slot(k40)).toMatchObject({ half: 'both', hasPlug: true });
    expect(G.slot('180488')).toMatchObject({ half: 'both', hasPlug: false });
    expect(G.slot('021186')).toBeUndefined();
  });

  it('places the halves of a 40ft slot 3.05 m fore and aft of its centre', () => {
    const c = G.slotPos('300284');
    const fore = G.slotPos('290284');
    const aft = G.slotPos('310284');
    expect(fore.x - c.x).toBeCloseTo(HALF_OFFSET_X, 9);
    expect(aft.x - c.x).toBeCloseTo(-HALF_OFFSET_X, 9);
    expect(fore.y).toBe(c.y);
    expect(fore.z).toBe(c.z);
    expect(c.bayIndex).toBe(7);
  });

  it('places rows to port (even, +y) and starboard (odd, -y), and tiers by height', () => {
    expect(G.slotPos('180286').y).toBeCloseTo(1.25, 9);
    expect(G.slotPos('180186').y).toBeCloseTo(-1.25, 9);
    expect(G.slotPos('180486').y).toBeCloseTo(3.75, 9);
    expect(G.slotPos('180488').z - G.slotPos('180486').z).toBeCloseTo(2.6, 9);
    expect(G.slotPos('180486').z).toBeGreaterThan(G.slotPos('180416').z);
    expect(() => G.slotPos('900486')).toThrow();
  });
});
