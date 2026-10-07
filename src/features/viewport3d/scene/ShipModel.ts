import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import {
  createBoxMaterial,
  parseCssColor,
  shadedBoxGeometry,
  type BoxMaterial,
} from './boxMaterial';
import { hullTriangles, waterline, type HullSection } from './hull';
import { toScene } from './mapping';
import type { SceneTheme } from './theme';

// Hull, deck, deckhouse and waterline (FR-18). Built once from the section table; the theme,
// the hull transparency and the drafts are applied to the existing objects.

function geometryOf(points: [number, number, number][]): BufferGeometry {
  const arr = new Float32Array(points.length * 3);
  points.forEach(([x, y, z], i) => {
    const v = toScene(x, y, z);
    arr[i * 3] = v.x;
    arr[i * 3 + 1] = v.y;
    arr[i * 3 + 2] = v.z;
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(arr, 3));
  return g;
}

export class ShipModel {
  readonly group = new Group();
  private readonly inside = new MeshBasicMaterial({ side: BackSide });
  private readonly outside = new MeshBasicMaterial({
    side: FrontSide,
    transparent: true,
    depthWrite: false,
  });
  private readonly deckMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  private readonly lineMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.9 });
  private readonly waterMaterial = new LineDashedMaterial({
    dashSize: 1.6,
    gapSize: 1.2,
    transparent: true,
  });
  private readonly houseMaterial: BoxMaterial = createBoxMaterial();
  private readonly water: LineSegments;
  private transparentHull = true;

  constructor(
    private readonly sections: readonly HullSection[],
    deckhouseX: number,
  ) {
    const { shell, deck } = hullTriangles(sections);
    const hull = geometryOf(shell);
    this.group.add(new Mesh(hull, this.inside));
    const outer = new Mesh(hull, this.outside);
    outer.renderOrder = 2;
    this.group.add(outer);
    const edges = new LineSegments(new EdgesGeometry(hull, 1), this.lineMaterial);
    edges.renderOrder = 3;
    this.group.add(edges);
    const deckMesh = new Mesh(geometryOf(deck), this.deckMaterial);
    deckMesh.renderOrder = 1;
    this.group.add(deckMesh);

    // Deckhouse and bridge wings, from design/stow3d.js, widened with the hull.
    const widen = Math.max(...sections.map((s) => s.deck)) / 21.6;
    const box = shadedBoxGeometry();
    for (const [z, hx, hy, hz] of [
      [17.5, 5.6, 17, 16.5],
      [35, 6.2, 21.4, 1.1],
    ] as const) {
      const m = new Mesh(box, this.houseMaterial);
      m.position.copy(toScene(deckhouseX, 0, z));
      m.scale.set(hx * 2, hz * 2, hy * 2 * widen);
      this.group.add(m);
    }

    this.water = new LineSegments(new BufferGeometry(), this.waterMaterial);
    this.water.renderOrder = 4;
    this.group.add(this.water);
  }

  setTheme(t: SceneTheme): void {
    this.inside.color.set(t.hullIn);
    this.outside.color.set(t.hull);
    this.deckMaterial.color.set(t.deck);
    this.lineMaterial.color.set(t.hullLine);
    this.houseMaterial.color.set(t.house);
    const edge = parseCssColor(t.edge);
    this.houseMaterial.setEdge(edge.rgb, edge.alpha);
    const water = parseCssColor(t.water);
    this.waterMaterial.color.setRGB(water.rgb[0], water.rgb[1], water.rgb[2], 'srgb');
    this.waterMaterial.opacity = water.alpha;
    this.setTransparent(this.transparentHull);
  }

  /** Hull at 20% (the default) or solid at 97%, the deck at 45% or solid (FR-21). */
  setTransparent(on: boolean): void {
    this.transparentHull = on;
    this.outside.opacity = on ? 0.2 : 0.97;
    this.deckMaterial.opacity = on ? 0.45 : 1;
    this.deckMaterial.depthWrite = !on;
  }

  /** The waterline for the drafts forward and aft. */
  setDrafts(fwd: number, aft: number): void {
    const g = geometryOf(waterline(this.sections, fwd, aft));
    this.water.geometry.dispose();
    this.water.geometry = g;
    this.water.computeLineDistances();
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh || o instanceof LineSegments) (o.geometry as BufferGeometry).dispose();
    });
    for (const m of [
      this.inside,
      this.outside,
      this.deckMaterial,
      this.lineMaterial,
      this.waterMaterial,
      this.houseMaterial,
    ]) {
      m.dispose();
    }
  }
}
