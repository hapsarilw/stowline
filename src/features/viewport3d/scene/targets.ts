import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineDashedMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Object3D,
} from 'three';
import type { SlotKey, StowContext } from '@/domain';
import type { MarkInfo } from '@/state/placement';
import { gapOffset, slotMatrix, type SizeClass } from './mapping';

// While a container is held: the next free slot of each stack in the selected bay as a target
// (FR-32), and a ghost of the container at the target under the pointer, green when valid and
// red when not (FR-38). Fill at 35 % with a dashed outline, as in design/stow3d.js.

export interface TargetColors {
  ok: string;
  warn: string;
  err: string;
}

/** Enough for every stack of the widest bay, deck and hold, fore and aft. */
const CAPACITY = 128;
const tmp = new Matrix4();
const tmpColor = new Color();
/** A little inside the slot, so a target does not fight its neighbours' faces. */
const SHRINK = new Vector3(0.96, 0.96, 0.96);

export class TargetLayer {
  readonly group = new Group();
  private readonly boxes: InstancedMesh;
  private readonly ghost: Mesh;
  private readonly ghostEdges: LineSegments;
  private keys: SlotKey[] = [];
  private cls: SizeClass = '40';
  private ghostKey: SlotKey | null = null;
  private colors: TargetColors = { ok: '#2fd08a', warn: '#ffb020', err: '#ff5d5d' };
  private marks = new Map<SlotKey, MarkInfo>();

  constructor(private readonly ctx: StowContext) {
    const unit = new BoxGeometry(1, 1, 1);
    this.boxes = new InstancedMesh(
      unit,
      new MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }),
      CAPACITY,
    );
    this.boxes.count = 0;
    this.boxes.frustumCulled = false;
    this.boxes.renderOrder = 5;
    this.boxes.name = 'drop-targets';
    this.boxes.setColorAt(0, tmpColor.set('#ffffff'));

    this.ghost = new Mesh(
      unit,
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.ghost.renderOrder = 11;
    this.ghostEdges = new LineSegments(
      new EdgesGeometry(unit),
      // The box is a unit cube scaled to the container, so dashes are in parts of a side.
      new LineDashedMaterial({
        dashSize: 0.06,
        gapSize: 0.04,
        depthTest: false,
        transparent: true,
      }),
    );
    this.ghostEdges.renderOrder = 12;
    this.ghostEdges.computeLineDistances();
    this.ghost.add(this.ghostEdges);
    this.ghost.visible = false;
    this.group.add(this.boxes, this.ghost);
  }

  setColors(colors: TargetColors): void {
    this.colors = colors;
    this.update(this.marks, this.cls, new Map());
  }

  /** The targets to draw, and the size of the held container. */
  update(
    marks: ReadonlyMap<SlotKey, MarkInfo>,
    cls: SizeClass,
    gaps: ReadonlyMap<number, number>,
  ): void {
    this.marks = new Map(marks);
    this.cls = cls;
    this.keys = [...marks.entries()]
      .filter(([, m]) => m.mark !== 'origin')
      .map(([k]) => k)
      .slice(0, CAPACITY);
    this.keys.forEach((key, i) => {
      const m = marks.get(key)!;
      this.boxes.setColorAt(
        i,
        tmpColor.set(
          m.mark === 'valid'
            ? this.colors.ok
            : m.mark === 'warning'
              ? this.colors.warn
              : this.colors.err,
        ),
      );
    });
    this.boxes.count = this.keys.length;
    if (this.boxes.instanceColor) this.boxes.instanceColor.needsUpdate = true;
    this.applyGaps(gaps);
  }

  /** Moves the targets and the ghost with the bay gap. */
  applyGaps(gaps: ReadonlyMap<number, number>): void {
    const g = this.ctx.geometry;
    this.keys.forEach((key, i) => {
      slotMatrix(g, key, this.cls, gapOffset(g.slotPos(key).bayIndex, gaps), tmp);
      tmp.scale(SHRINK);
      this.boxes.setMatrixAt(i, tmp);
    });
    this.boxes.instanceMatrix.needsUpdate = true;
    // Raycasts test the bounding sphere first: it must follow the targets.
    this.boxes.boundingSphere = null;
    this.boxes.boundingBox = null;
    if (this.ghostKey) this.placeGhost(this.ghostKey, gaps);
  }

  setGhost(key: SlotKey | null, valid: boolean, gaps: ReadonlyMap<number, number>): void {
    this.ghostKey = key;
    this.ghost.visible = key !== null;
    if (!key) return;
    const color = valid ? this.colors.ok : this.colors.err;
    (this.ghost.material as MeshBasicMaterial).color.set(color);
    (this.ghostEdges.material as LineDashedMaterial).color.set(color);
    this.placeGhost(key, gaps);
  }

  private placeGhost(key: SlotKey, gaps: ReadonlyMap<number, number>): void {
    const g = this.ctx.geometry;
    slotMatrix(g, key, this.cls, gapOffset(g.slotPos(key).bayIndex, gaps), tmp);
    tmp.decompose(this.ghost.position, this.ghost.quaternion, this.ghost.scale);
    this.ghost.updateMatrix();
  }

  /** Where a target is drawn, in scene units, or null. */
  boxOf(key: SlotKey): { center: Vector3; size: Vector3 } | null {
    const i = this.keys.indexOf(key);
    if (i < 0) return null;
    this.boxes.getMatrixAt(i, tmp);
    const center = new Vector3();
    const size = new Vector3();
    tmp.decompose(center, this.ghost.quaternion.clone(), size);
    return { center, size };
  }

  get mesh(): InstancedMesh {
    return this.boxes;
  }

  /** The target drawn by an instance, for picking. */
  keyAt(object: Object3D, instanceId: number): SlotKey | undefined {
    return object === this.boxes ? this.keys[instanceId] : undefined;
  }

  get visibleCount(): number {
    return this.boxes.count;
  }

  dispose(): void {
    this.boxes.geometry.dispose();
    (this.boxes.material as MeshBasicMaterial).dispose();
    (this.ghost.material as MeshBasicMaterial).dispose();
    this.ghostEdges.geometry.dispose();
    (this.ghostEdges.material as LineDashedMaterial).dispose();
    this.boxes.dispose();
  }
}
