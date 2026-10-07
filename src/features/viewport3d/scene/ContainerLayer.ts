import { Color, Group, InstancedMesh, Matrix4, Vector3, type Object3D } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  bay40Of,
  parseKey,
  type SlotKey,
  type StowContext,
  type StowState,
  type ViolationIndex,
} from '@/domain';
import { containerColor, dimmedColor, type ColorMode, type Palette } from '../colors';
import {
  createBoxMaterial,
  parseCssColor,
  shadedBoxGeometry,
  type BoxMaterial,
} from './boxMaterial';
import { diffPlacements, InstanceTable } from './instances';
import {
  boxSize,
  gapOffset,
  SIZE_CLASSES,
  sizeClassOf,
  slotMatrix,
  type SizeClass,
} from './mapping';

// All containers of the plan as one InstancedMesh per size. The layer is plain three.js: the
// React side calls sync() with each new plan state and recolor() with each new view setting,
// and nothing here causes a React render.

export interface ColorInput {
  mode: ColorMode;
  palette: Palette;
  onlyPod: string | null;
  /** When set, containers outside it are dimmed. */
  highlight: ReadonlySet<SlotKey> | null;
  violations: ViolationIndex;
}

interface ClassData {
  mesh: InstancedMesh;
  table: InstanceTable;
  /** Ship x of each instance without the gap, and its bay index, for the gap animation. */
  baseX: Float32Array;
  bayIndex: Int16Array;
}

const UNIT_EDGES = (() => {
  const c = [-0.5, 0.5];
  const p: number[] = [];
  const corner = (x: number, y: number, z: number) => [c[x]!, c[y]!, c[z]!];
  for (const [a, b] of [
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
    ],
    [
      [0, 0, 1],
      [1, 0, 1],
    ],
    [
      [0, 1, 1],
      [1, 1, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
    ],
    [
      [1, 0, 1],
      [1, 1, 1],
    ],
    [
      [0, 0, 0],
      [0, 0, 1],
    ],
    [
      [1, 0, 0],
      [1, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [1, 1, 0],
      [1, 1, 1],
    ],
  ] as [number[], number[]][]) {
    p.push(...corner(a[0]!, a[1]!, a[2]!), ...corner(b[0]!, b[1]!, b[2]!));
  }
  return p;
})();

/** A box outline with a width in pixels, moved to whichever container it marks. */
export function createOutline(color: string, widthPx: number): LineSegments2 {
  const geometry = new LineSegmentsGeometry().setPositions(UNIT_EDGES);
  const material = new LineMaterial({
    color,
    linewidth: widthPx,
    worldUnits: false,
    depthTest: false,
    transparent: true,
  });
  const line = new LineSegments2(geometry, material);
  line.visible = false;
  line.renderOrder = 10;
  return line;
}

const tmpMatrix = new Matrix4();
const tmpColor = new Color();

export class ContainerLayer {
  readonly group = new Group();
  readonly material: BoxMaterial = createBoxMaterial();
  private readonly classes = new Map<SizeClass, ClassData>();
  private readonly classOf = new Map<SlotKey, SizeClass>();
  private placements: StowState['placements'] = new Map();
  private colors: ColorInput | null = null;
  private readonly colorCache = new Map<string, Color>();
  /** Bay index to how far its gap is open, 0 to 1. */
  gaps = new Map<number, number>();
  readonly hoverOutline = createOutline('#e6edf7', 1.5);
  readonly selectOutline = createOutline('#3b9eff', 2);
  private readonly focusOutlines: LineSegments2[] = [];
  private hoverKey: SlotKey | null = null;
  private selectKey: SlotKey | null = null;
  private focusKeys: SlotKey[] = [];
  private focusColors = { err: '#ff5d5d', warn: '#ffb020' };

  constructor(private readonly ctx: StowContext) {
    const slots40 = ctx.geometry.slotCount40();
    const geometry = shadedBoxGeometry();
    for (const cls of SIZE_CLASSES) {
      const capacity = cls.startsWith('20') ? slots40 * 2 : slots40;
      const mesh = new InstancedMesh(geometry, this.material, capacity);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.name = `containers-${cls}`;
      mesh.setColorAt(0, tmpColor.set('#ffffff'));
      this.classes.set(cls, {
        mesh,
        table: new InstanceTable(),
        baseX: new Float32Array(capacity),
        bayIndex: new Int16Array(capacity),
      });
      this.group.add(mesh);
    }
    this.group.add(this.hoverOutline, this.selectOutline);
  }

  get meshes(): InstancedMesh[] {
    return [...this.classes.values()].map((c) => c.mesh);
  }

  get count(): number {
    return [...this.classes.values()].reduce((n, c) => n + c.table.count, 0);
  }

  /** The slot drawn by an instance, for picking. */
  keyAt(object: Object3D, instanceId: number): SlotKey | undefined {
    for (const c of this.classes.values()) if (c.mesh === object) return c.table.keys[instanceId];
    return undefined;
  }

  private color(css: string): Color {
    let c = this.colorCache.get(css);
    if (!c) {
      c = new Color(css);
      this.colorCache.set(css, c);
    }
    return c;
  }

  private colorFor(key: SlotKey): Color {
    const input = this.colors;
    const p = this.placements.get(key);
    const c = p ? this.ctx.containers.get(p.containerId) : undefined;
    if (!input || !c) return this.color('#888888');
    const dim =
      (input.highlight !== null && !input.highlight.has(key)) ||
      (input.onlyPod !== null && c.pod !== input.onlyPod);
    if (dim) return this.color(dimmedColor(input.palette));
    const severity = input.violations.bySlot.get(key)?.severity ?? null;
    return this.color(containerColor(input.mode, c, severity, input.palette));
  }

  /**
   * Brings the meshes up to a new plan state. Only the placements that changed get a new matrix
   * and color. Returns the number of instances written.
   */
  sync(state: StowState): number {
    const { removed, added } = diffPlacements(this.placements, state.placements);
    this.placements = state.placements;
    const touched = new Set<SizeClass>();

    for (const key of removed) {
      const cls = this.classOf.get(key);
      if (!cls) continue;
      const d = this.classes.get(cls)!;
      const move = d.table.remove(key);
      this.classOf.delete(key);
      if (move) {
        d.mesh.getMatrixAt(move.from, tmpMatrix);
        d.mesh.setMatrixAt(move.to, tmpMatrix);
        d.mesh.getColorAt(move.from, tmpColor);
        d.mesh.setColorAt(move.to, tmpColor);
        d.baseX[move.to] = d.baseX[move.from]!;
        d.bayIndex[move.to] = d.bayIndex[move.from]!;
        this.markInstance(d, move.to);
      }
      touched.add(cls);
    }

    for (const key of added) {
      const p = state.placements.get(key)!;
      const c = this.ctx.containers.get(p.containerId);
      if (!c) continue;
      const cls = sizeClassOf(c);
      const d = this.classes.get(cls)!;
      const i = d.table.add(key);
      this.classOf.set(key, cls);
      const pos = this.ctx.geometry.slotPos(key);
      d.baseX[i] = pos.x;
      d.bayIndex[i] = pos.bayIndex;
      d.mesh.setMatrixAt(
        i,
        slotMatrix(this.ctx.geometry, key, cls, gapOffset(pos.bayIndex, this.gaps), tmpMatrix),
      );
      d.mesh.setColorAt(i, this.colorFor(key));
      this.markInstance(d, i);
      touched.add(cls);
    }

    for (const cls of touched) {
      const d = this.classes.get(cls)!;
      d.mesh.count = d.table.count;
      d.mesh.boundingSphere = null;
      d.mesh.boundingBox = null;
    }
    return removed.length + added.length;
  }

  private markInstance(d: ClassData, i: number): void {
    d.mesh.instanceMatrix.addUpdateRange(i * 16, 16);
    d.mesh.instanceMatrix.needsUpdate = true;
    if (d.mesh.instanceColor) {
      d.mesh.instanceColor.addUpdateRange(i * 3, 3);
      d.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Recolors every instance, or only the given slots. */
  recolor(input: ColorInput, only?: Iterable<SlotKey>): void {
    this.colors = input;
    if (only) {
      for (const key of only) {
        const cls = this.classOf.get(key);
        if (!cls) continue;
        const d = this.classes.get(cls)!;
        const i = d.table.index.get(key)!;
        d.mesh.setColorAt(i, this.colorFor(key));
        d.mesh.instanceColor!.addUpdateRange(i * 3, 3);
        d.mesh.instanceColor!.needsUpdate = true;
      }
      return;
    }
    for (const d of this.classes.values()) {
      d.table.keys.forEach((key, i) => d.mesh.setColorAt(i, this.colorFor(key)));
      if (d.mesh.instanceColor) {
        d.mesh.instanceColor.clearUpdateRanges();
        d.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** Moves every instance along x for the current gaps. Only the x of each matrix changes. */
  applyGaps(): void {
    const offsets = this.ctx.vessel.bays.map((b) => gapOffset(b.index, this.gaps));
    for (const d of this.classes.values()) {
      const m = d.mesh.instanceMatrix.array as Float32Array;
      for (let i = 0; i < d.table.count; i++)
        m[i * 16 + 12] = d.baseX[i]! + offsets[d.bayIndex[i]!]!;
      d.mesh.instanceMatrix.clearUpdateRanges();
      d.mesh.instanceMatrix.needsUpdate = true;
      d.mesh.boundingSphere = null;
      d.mesh.boundingBox = null;
    }
  }

  /** The centre and size of the box drawn for a slot, in scene units, or null. */
  boxOf(
    key: SlotKey,
    out = new Vector3(),
    size = new Vector3(),
  ): { center: Vector3; size: Vector3 } | null {
    const cls = this.classOf.get(key);
    if (!cls) return null;
    const d = this.classes.get(cls)!;
    const i = d.table.index.get(key)!;
    d.mesh.getMatrixAt(i, tmpMatrix);
    out.setFromMatrixPosition(tmpMatrix);
    const [l, h, w] = boxSize(cls);
    size.set(l, h, w);
    return { center: out, size };
  }

  /** The 40ft bay number of a slot drawn here. */
  bayOf(key: SlotKey): number {
    return bay40Of(parseKey(key).bay);
  }

  setHover(key: SlotKey | null): void {
    this.hoverKey = key;
    this.placeOutline(this.hoverOutline, key);
  }

  setSelected(key: SlotKey | null): void {
    this.selectKey = key;
    this.placeOutline(this.selectOutline, key);
  }

  /** Outlines the containers of a focus set, red for errors and amber for warnings (FR-43). */
  setFocus(keys: readonly SlotKey[] | null): void {
    this.focusKeys = keys ? [...keys] : [];
    while (this.focusOutlines.length < this.focusKeys.length) {
      const o = createOutline(this.focusColors.err, 1.5);
      this.focusOutlines.push(o);
      this.group.add(o);
    }
    this.updateOutlines();
  }

  setOutlineColors(c: { text: string; accent: string; err: string; warn: string }): void {
    this.hoverOutline.material.color.set(c.text);
    this.selectOutline.material.color.set(c.accent);
    this.focusColors = { err: c.err, warn: c.warn };
    this.updateOutlines();
  }

  /** Puts every outline on its container again, after a plan change or a gap move. */
  updateOutlines(): void {
    this.placeOutline(this.hoverOutline, this.hoverKey);
    this.placeOutline(this.selectOutline, this.selectKey);
    this.focusOutlines.forEach((o, i) => {
      const key = this.focusKeys[i] ?? null;
      const severity = key ? this.colors?.violations.bySlot.get(key)?.severity : undefined;
      o.material.color.set(severity === 'warning' ? this.focusColors.warn : this.focusColors.err);
      this.placeOutline(o, key);
    });
  }

  private placeOutline(o: LineSegments2, key: SlotKey | null): void {
    const box = key ? this.boxOf(key, o.position, o.scale) : null;
    if (box) o.scale.multiplyScalar(1.04);
    o.visible = box !== null;
    o.updateMatrix();
  }

  setEdge(css: string): void {
    const e = parseCssColor(css);
    this.material.setEdge(e.rgb, e.alpha);
  }

  dispose(): void {
    for (const o of [this.hoverOutline, this.selectOutline, ...this.focusOutlines]) {
      o.geometry.dispose();
      o.material.dispose();
    }
    for (const d of this.classes.values()) d.mesh.dispose();
    this.material.dispose();
  }
}
