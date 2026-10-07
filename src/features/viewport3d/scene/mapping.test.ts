import { Quaternion, Vector3, type Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { SAMPLE_GEOMETRY as G, SAMPLE_VESSEL } from '@/domain';
import { hullFor, shipBounds } from './hull';
import {
  boxSize,
  cameraPose,
  easeInOut,
  fitZoom,
  gapOffset,
  GAP_M,
  mixViews,
  PRESETS,
  sizeClassOf,
  slotMatrix,
  toScene,
  viewDirection,
  viewOf,
} from './mapping';

const decompose = (m: Matrix4) => {
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  m.decompose(p, q, s);
  return { p, s };
};

describe('ship to scene', () => {
  it('turns x toward the bow, y to port, z up into three.js y-up coordinates', () => {
    expect(toScene(10, 2, 3).toArray()).toEqual([10, 3, -2]);
  });
});

describe('slot to matrix', () => {
  it('puts a 40ft container at the centre of its slot with its size', () => {
    const { p, s } = decompose(slotMatrix(G, '180486', '40hc'));
    const pos = G.slotPos('180486');
    expect(p.x).toBeCloseTo(pos.x, 6);
    expect(p.y).toBeCloseTo(pos.z, 6);
    expect(p.z).toBeCloseTo(-pos.y, 6);
    expect(s.toArray().map((v) => +v.toFixed(2))).toEqual([12.1, 2.66, 2.4]);
  });

  it('puts the fore and aft 20ft halves 3.05 m either side of the 40ft centre', () => {
    const c = decompose(slotMatrix(G, '300284', '40')).p;
    const fore = decompose(slotMatrix(G, '290284', '20')).p;
    const aft = decompose(slotMatrix(G, '310284', '20')).p;
    expect(fore.x - c.x).toBeCloseTo(3.05, 6);
    expect(aft.x - c.x).toBeCloseTo(-3.05, 6);
    expect(decompose(slotMatrix(G, '290284', '20')).s.x).toBeCloseTo(5.9, 6);
  });

  it('puts port rows on the -z side of the scene and higher tiers higher', () => {
    const port = decompose(slotMatrix(G, '181686', '40')).p;
    const stbd = decompose(slotMatrix(G, '181586', '40')).p;
    expect(port.z).toBeLessThan(0);
    expect(stbd.z).toBeGreaterThan(0);
    expect(decompose(slotMatrix(G, '180488', '40')).p.y).toBeGreaterThan(
      decompose(slotMatrix(G, '180486', '40')).p.y,
    );
  });

  it('adds the bay gap along x', () => {
    const a = decompose(slotMatrix(G, '180486', '40')).p;
    const b = decompose(slotMatrix(G, '180486', '40', GAP_M)).p;
    expect(b.x - a.x).toBeCloseTo(GAP_M, 6);
  });
});

describe('size classes', () => {
  it('sorts containers into four instanced meshes by length and height', () => {
    expect(sizeClassOf({ type: '40HC', lengthFt: 40 })).toBe('40hc');
    expect(sizeClassOf({ type: 'RF', lengthFt: 40 })).toBe('40hc');
    expect(sizeClassOf({ type: '40GP', lengthFt: 40 })).toBe('40');
    expect(sizeClassOf({ type: 'OT', lengthFt: 40 })).toBe('40');
    expect(sizeClassOf({ type: '20GP', lengthFt: 20 })).toBe('20');
    expect(sizeClassOf({ type: 'RF', lengthFt: 20 })).toBe('20hc');
    expect(boxSize('20hc')).toEqual([5.9, 2.66, 2.4]);
  });
});

describe('bay gap (FR-23)', () => {
  it('moves the bays forward of the gap toward the bow and the bays aft of it toward the stern', () => {
    const gaps = new Map([[4, 1]]);
    expect(gapOffset(2, gaps)).toBe(GAP_M);
    expect(gapOffset(4, gaps)).toBe(0);
    expect(gapOffset(9, gaps)).toBe(-GAP_M);
    expect(
      gapOffset(
        9,
        new Map([
          [4, 0.5],
          [10, 0.5],
        ]),
      ),
    ).toBeCloseTo(0, 9);
    expect(gapOffset(3, new Map())).toBe(0);
  });
});

describe('camera presets (FR-19)', () => {
  const bounds = shipBounds(hullFor(SAMPLE_VESSEL));
  const side = (preset: keyof typeof PRESETS) => {
    const [x, y, z] = viewDirection(PRESETS[preset].yaw, PRESETS[preset].pitch);
    return { x, y, z };
  };

  it('looks from the side each preset names', () => {
    expect(side('port').y).toBeGreaterThan(0.9);
    expect(side('stbd').y).toBeLessThan(-0.9);
    expect(side('bow').x).toBeGreaterThan(0.9);
    expect(side('top').z).toBeGreaterThan(0.99);
    const iso = side('iso');
    expect(iso.x > 0 && iso.y > 0 && iso.z > 0).toBe(true);
  });

  it('fits the whole ship, like the design: 90% of the width or 80% of the height', () => {
    const z = fitZoom(204, 27, 1120, 480, bounds);
    expect(z).toBeGreaterThan(1);
    expect(fitZoom(204, 27, 2240, 960, bounds)).toBeCloseTo(z * 2, 6);
    expect(cameraPose({ ...PRESETS.iso, zoom: 2 }, 1120, 480, bounds).zoom).toBeCloseTo(z * 2, 6);
  });

  it('reads the view back from a camera pose', () => {
    const view = { yaw: 214, pitch: 30, zoom: 2.7, tx: 50, ty: 1, tz: 4 };
    const pose = cameraPose(view, 1000, 500, bounds);
    const back = viewOf(pose.position, pose.target, pose.zoom, 1000, 500, bounds);
    for (const k of ['yaw', 'pitch', 'zoom', 'tx', 'ty', 'tz'] as const)
      expect(back[k]).toBeCloseTo(view[k], 6);
  });

  it('moves between views the short way round, easing in and out', () => {
    expect(
      mixViews({ ...PRESETS.stbd, yaw: 350 }, { ...PRESETS.stbd, yaw: 10 }, 0.5).yaw,
    ).toBeCloseTo(0, 9);
    expect(mixViews(PRESETS.port, PRESETS.top, 0.5).pitch).toBeCloseTo(47.5, 9);
    expect(
      mixViews({ ...PRESETS.iso, yaw: 10 }, { ...PRESETS.iso, yaw: 350 }, 0.25).yaw,
    ).toBeCloseTo(5, 9);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });
});
