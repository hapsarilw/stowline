import { Color, Matrix4, Vector3 } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, indexViolations, validateAll } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { containerColor, dimmedColor, type Palette } from '../colors';
import { ContainerLayer, type ColorInput } from './ContainerLayer';
import { GAP_M } from './mapping';

// The layer is plain three.js, so it runs in Node without WebGL.

const palette: Palette = {
  pods: { LKCMB: '#e69f00', AEJEA: '#56b4e9', NLRTM: '#009e73', DEHAM: '#cc79a7' },
  err: '#ff5d5d',
  warn: '#ffb020',
  neutral: '#43506a',
  dim: '#2a3650',
  bg: '#0b1220',
};
const { ctx, state } = sampleSetup();
const violations = indexViolations(validateAll(state, ctx));
const input = (patch: Partial<ColorInput> = {}): ColorInput => ({
  mode: 'pod',
  palette,
  onlyPod: null,
  highlight: null,
  violations,
  ...patch,
});

const colorOf = (layer: ContainerLayer, key: string) => {
  for (const mesh of layer.meshes) {
    for (let i = 0; i < mesh.count; i++) {
      if (layer.keyAt(mesh, i) === key) return `#${mesh.getColorAt(i, new Color()).getHexString()}`;
    }
  }
  return null;
};

let layer: ContainerLayer;
beforeEach(() => {
  layer = new ContainerLayer(ctx);
  layer.recolor(input());
  layer.sync(state);
});

describe('ContainerLayer (FR-18)', () => {
  it('draws every container once, in one InstancedMesh per size', () => {
    expect(layer.count).toBe(2740);
    expect(layer.meshes).toHaveLength(4);
    const drawn = new Set<string>();
    for (const m of layer.meshes) for (let i = 0; i < m.count; i++) drawn.add(layer.keyAt(m, i)!);
    expect(drawn).toEqual(new Set(state.placements.keys()));
    expect(layer.keyAt(new Matrix4() as never, 0)).toBeUndefined();
  });

  it('writes only the instances a command changed', () => {
    const r = applyCommand(state, ctx, { kind: 'swap', a: '100382', b: '100386' });
    if (!r.ok) throw new Error(r.reason);
    expect(layer.sync(r.state)).toBe(4); // two removed, two added
    expect(layer.count).toBe(2740);
    expect(layer.sync(r.state)).toBe(0);
  });

  it('puts each instance on its slot', () => {
    const box = layer.boxOf('180486')!;
    const pos = ctx.geometry.slotPos('180486');
    const gap = 0;
    // Instance matrices are 32-bit floats.
    expect(box.center.x).toBeCloseTo(pos.x + gap, 4);
    expect(box.size.toArray()).toEqual([12.1, 2.66, 2.4]);
    expect(layer.boxOf('nope')).toBeNull();
    expect(layer.bayOf('290284')).toBe(30);
  });

  it('colors each mode, dims outside the focus set and the POD filter', () => {
    expect(colorOf(layer, '180486')).toBe(
      new Color(containerColor('pod', { pod: 'NLRTM', type: '40HC', weightT: 28.4 }, null, palette))
        .getHexString()
        .replace(/^/, '#'),
    );
    layer.recolor(input({ mode: 'viol' }));
    expect(colorOf(layer, '220610')).toBe('#ff5d5d');
    expect(colorOf(layer, '460612')).toBe('#ffb020');
    layer.recolor(input({ highlight: new Set(['180488']) }));
    expect(colorOf(layer, '180486')).toBe(dimmedColor(palette));
    expect(colorOf(layer, '180488')).toBe('#e69f00');
    layer.recolor(input({ onlyPod: 'LKCMB' }));
    expect(colorOf(layer, '180486')).toBe(dimmedColor(palette));
    layer.recolor(input({ mode: 'weight' }), ['180486']);
    expect(colorOf(layer, '180486')).toBe('#f2d35b');
  });

  it('opens the bay gap by moving x only', () => {
    const before = layer.boxOf('180486')!.center.clone();
    const b18 = ctx.geometry.bayByNum(18)!;
    layer.gaps = new Map([[b18.index - 1, 1]]);
    layer.applyGaps();
    const after = layer.boxOf('180486')!.center;
    expect(after.x - before.x).toBeCloseTo(-GAP_M, 4);
    expect(after.y).toBe(before.y);
  });

  it('places the hover, selection and focus outlines on their containers', () => {
    layer.setSelected('180486');
    expect(layer.selectOutline.visible).toBe(true);
    expect(layer.selectOutline.position.distanceTo(layer.boxOf('180486')!.center)).toBeLessThan(
      1e-4,
    );
    layer.setHover('nope');
    expect(layer.hoverOutline.visible).toBe(false);
    layer.setFocus(['180486', '180488']);
    const focus = layer.group.children.filter(
      (o) => o.visible && o !== layer.selectOutline && o.type !== 'Mesh',
    );
    expect(focus.length).toBeGreaterThanOrEqual(2);
    layer.setOutlineColors({ text: '#ffffff', accent: '#0000ff', err: '#ff0000', warn: '#ffff00' });
    layer.setFocus(null);
    layer.setEdge('rgba(8, 13, 24, 0.6)');
    layer.dispose();
    void new Vector3();
  });
});
