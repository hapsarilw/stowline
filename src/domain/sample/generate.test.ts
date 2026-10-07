import { describe, expect, it } from 'vitest';
import { toTenths } from '../constants';
import { SAMPLE_GEOMETRY as G, slot40Key } from '../geometry';
import type { Container } from '../types';
import { generateSampleCall, LOAD_LIST_TOTAL, PLANNED_TOTAL } from './generate';
import { uniqueId } from './ids';
import { createRng } from './rng';

const call = generateSampleCall();
const byId = new Map(call.containers.map((c) => [c.id, c]));

// 32-bit FNV-1a, to fingerprint a list of rows.
function fingerprint(rows: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of rows.join('\n')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('counts', () => {
  it('has 2,740 containers on board', () => {
    expect(call.containers).toHaveLength(2740);
    expect(call.plan.placements).toHaveLength(2740);
    expect(byId.size).toBe(2740);
  });

  it('has 1,240 load list rows and 312 of them planned', () => {
    expect(call.loadList).toHaveLength(LOAD_LIST_TOTAL);
    expect(LOAD_LIST_TOTAL).toBe(1240);
    const planned = call.loadList.filter((x) => x.plannedSlotKey !== '');
    expect(planned).toHaveLength(PLANNED_TOTAL);
    expect(PLANNED_TOTAL).toBe(312);
    expect(call.loadList.length - planned.length).toBe(928);
  });

  it('marks 312 placements as loaded at this call, and the rest as on board', () => {
    const thisCall = call.plan.placements.filter((p) => p.origin === 'thisCall');
    expect(thisCall).toHaveLength(312);
    expect(call.plan.placements.filter((p) => p.origin === 'onboard')).toHaveLength(2428);
    for (const p of call.plan.placements) {
      const c = byId.get(p.containerId)!;
      expect(p.origin === 'thisCall').toBe(c.pol === 'SGSIN');
    }
  });

  it('links every planned row to its placement', () => {
    const placed = new Map(call.plan.placements.map((p) => [p.slotKey, p]));
    for (const x of call.loadList.filter((r) => r.plannedSlotKey !== '')) {
      const p = placed.get(x.plannedSlotKey)!;
      expect(p.containerId).toBe(x.container.id);
      expect(p.origin).toBe('thisCall');
    }
  });

  it('describes the plan', () => {
    expect(call.plan).toMatchObject({
      id: '042W-SGSIN',
      voyage: '042W',
      port: 'SGSIN',
      status: 'draft',
      shiftCount: 0,
    });
    expect(call.vessel.name).toBe('MV Nusantara Pioneer');
    expect(call.vessel.teu).toBe(8500);
  });
});

describe('determinism', () => {
  it('gives the same data on every call', () => {
    expect(generateSampleCall()).toEqual(call);
  });

  it('draws the same sequence from the same seed', () => {
    const a = createRng(8500);
    const b = createRng(8500);
    const c = createRng(8501);
    const seq = (r: () => number) => Array.from({ length: 5 }, r);
    expect(seq(a)).toEqual(seq(b));
    expect(seq(createRng(8500))).not.toEqual(seq(c));
    expect(seq(createRng(1)).every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('the prototype containers are untouched', () => {
  // Fingerprints taken from the prototype's own createPlan and createLoadList in
  // design/stowline-data.js: slot, weight in tenths, POD, type, DG class and lock.
  // The port of loading and the owner prefix are left out, they are meant to change.
  it('puts the same containers in the same slots', () => {
    const rows = call.plan.placements.map((p) => {
      const c = byId.get(p.containerId)!;
      return `${p.slotKey}|${toTenths(c.weightT)}|${c.pod}|${c.type}|${c.imdgClass ?? ''}|${p.locked}`;
    });
    expect(fingerprint(rows.sort())).toBe('ec27aad4');
  });

  it('keeps the first 60 load list rows', () => {
    const rows = call.loadList
      .slice(0, 60)
      .map(
        ({ container: c }) =>
          `${c.type}|${toTenths(c.weightT)}|${c.pod}|${c.imdgClass ?? ''}|${c.id.slice(5)}`,
      );
    expect(fingerprint(rows)).toBe('cf457ba3');
  });

  it('keeps the scripted stacks and named containers', () => {
    const at = (key: string) => {
      const p = call.plan.placements.find((x) => x.slotKey === key)!;
      return byId.get(p.containerId)!;
    };
    expect(at('180486')).toMatchObject({ id: 'NSPU 482913 5', weightT: 28.4, pod: 'NLRTM' });
    expect(at('180488')).toMatchObject({ id: 'NSPU 771032 1', weightT: 17.1, pod: 'LKCMB' });
    expect(at('220610')).toMatchObject({ id: 'NSPU 220417 3', type: 'RF', weightT: 27.2 });
    expect(at('460612')).toMatchObject({ id: 'NSPU 813350 9', weightT: 30.2 });
    expect(at('460610')).toMatchObject({ id: 'NSPU 640033 2', weightT: 8.4 });
    expect(at('140284')).toMatchObject({ imdgClass: '3' });
    expect(at('140484')).toMatchObject({ imdgClass: '5.1' });
    expect(
      call.plan.placements
        .filter((p) => p.locked)
        .map((p) => p.slotKey)
        .sort(),
    ).toEqual(['180102', '180202', '180204']);
  });

  it('puts the 20ft container in the fore half, at slot 290284', () => {
    const p = call.plan.placements.find((x) => x.containerId === 'NSPU 318204 6')!;
    expect(p).toMatchObject({ slotKey: '290284', half: 'fore', origin: 'thisCall' });
    expect(byId.get(p.containerId)).toMatchObject({ lengthFt: 20, type: '20GP', weightT: 12.6 });
    expect(call.plan.placements.filter((x) => x.half !== 'both')).toHaveLength(1);
  });

  it('lists the named load list containers first', () => {
    expect(call.loadList.slice(0, 3).map((x) => x.container.id)).toEqual([
      'NSPU 551208 4',
      'NSPU 337061 2',
      'NSPU 908442 7',
    ]);
    expect(call.loadList[0]!.container).toMatchObject({
      type: '40HC',
      weightT: 24.1,
      pod: 'AEJEA',
    });
    expect(call.loadList[1]!.container.reeferSetPointC).toBe(-25);
  });
});

describe('container data', () => {
  const all: Container[] = [...call.containers, ...call.loadList.map((x) => x.container)];

  it('uses the NSPU prefix only, in the format 4 letters, 6 digits, 1 digit', () => {
    for (const c of all) expect(c.id).toMatch(/^NSPU \d{6} \d$/);
  });

  it('has unique IDs on board and in the unplanned load list', () => {
    const ids = [
      ...call.containers.map((c) => c.id),
      ...call.loadList.filter((x) => x.plannedSlotKey === '').map((x) => x.container.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is consistent: type, length, ISO code, one-decimal weight, reefer set point', () => {
    for (const c of all) {
      expect(c.lengthFt).toBe(c.type === '20GP' || c.type === 'TK' ? 20 : 40);
      expect(c.isoCode).toMatch(/^\d{2}[A-Z]\d$/);
      expect(toTenths(c.weightT) / 10).toBe(c.weightT);
      expect(c.weightT).toBeGreaterThan(0);
      expect(c.reeferSetPointC !== undefined).toBe(c.type === 'RF');
      expect(['LKCMB', 'AEJEA', 'NLRTM', 'DEHAM']).toContain(c.pod);
    }
  });
});

describe('placements', () => {
  it('are all in slots that exist, each slot used once', () => {
    const keys = call.plan.placements.map((p) => p.slotKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => G.slotExists(k))).toBe(true);
  });

  it('make stacks with no gaps, starting at the lowest tier', () => {
    const stacks = new Map<string, number[]>();
    for (const p of call.plan.placements) {
      const k40 = slot40Key(p.slotKey);
      const bay = +k40.slice(0, 2);
      const row = +k40.slice(2, 4);
      const tier = +k40.slice(4, 6);
      const id = `${bay}-${row}-${tier >= 82 ? 'D' : 'H'}`;
      (stacks.get(id) ?? stacks.set(id, []).get(id)!).push(tier);
    }
    for (const [id, tiers] of stacks) {
      const bay = G.bayByNum(+id.split('-')[0]!)!;
      const list = id.endsWith('D') ? bay.deckTiers : bay.holdTiers;
      expect(
        tiers.sort((a, b) => a - b),
        id,
      ).toEqual(list.slice(0, tiers.length));
    }
  });

  it('keep reefers in plug slots except the golden violation', () => {
    const bad = call.plan.placements.filter((p) => {
      const c = byId.get(p.containerId)!;
      return c.type === 'RF' && !G.hasPlug(p.slotKey);
    });
    expect(bad.map((p) => p.slotKey)).toEqual(['220610']);
  });

  it('only extra containers marked as loaded at SGSIN changed their port of loading', () => {
    // Weight, POD, type and slot are covered by the fingerprint above.
    // The prototype had 253 loaded at SGSIN, 59 more make 312.
    const sgsin = call.containers.filter((c) => c.pol === 'SGSIN');
    expect(sgsin).toHaveLength(312);
    expect(call.containers.filter((c) => c.pol === 'IDJKT')).toHaveLength(2428);
  });
});

describe('unique ids', () => {
  it('moves a repeated id to the next free serial number', () => {
    const used = new Set(['NSPU 100000 4', 'NSPU 100001 4']);
    expect(uniqueId('NSPU 100005 4', used)).toBe('NSPU 100005 4');
    expect(uniqueId('NSPU 100000 4', used)).toBe('NSPU 100002 4');
    expect(uniqueId('NSPU 999999 1', new Set(['NSPU 999999 1']))).toBe('NSPU 100000 1');
  });
});
