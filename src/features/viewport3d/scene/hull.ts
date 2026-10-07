import type { Vessel } from '@/domain';

// Hull sections from design/stow3d.js, in ship coordinates (metres): x along the ship,
// positive toward the bow; half breadth at the deck; half breadth at the bottom; z of the
// bottom. The deck is at DECK_Z. The keel is at z = -24.

export interface HullSection {
  x: number;
  deck: number;
  bottom: number;
  z: number;
}

const SAMPLE_SECTIONS: readonly (readonly [number, number, number, number])[] = [
  [-162, 17, 8, -12],
  [-152, 20, 14, -21],
  [-132, 21.6, 19, -24],
  [92, 21.6, 19, -24],
  [120, 20.5, 13, -24],
  [140, 18, 8, -23],
  [154, 13.5, 4, -19],
  [166, 5, 1, -12],
  [172, 0.5, 0.5, -8],
];

export const DECK_Z = 1.0;
export const KEEL_Z = -24;

/** Distance from the first to the last bay centre of the sample vessel, in metres. */
const SAMPLE_BAY_SPAN = 13.2 * 21 + 16;
/** Widest row offset of the sample vessel: 16 rows of 2.5 m. */
const SAMPLE_HALF_WIDTH = 8 * 2.5;

/**
 * The hull for a vessel. The sample vessel gets the sections from the design. A vessel of
 * another size (the benchmark vessel) gets them stretched to its length and breadth.
 */
export function hullFor(vessel: Vessel): HullSection[] {
  const bays = vessel.bays;
  const span = bays.length > 1 ? bays[0]!.x - bays[bays.length - 1]!.x : SAMPLE_BAY_SPAN;
  const rows = Math.max(...bays.map((b) => Math.max(b.deckRows, b.holdRows)));
  const sx = span / SAMPLE_BAY_SPAN;
  const sy = ((rows / 2) * 2.5) / SAMPLE_HALF_WIDTH;
  const mid = bays.length > 1 ? (bays[0]!.x + bays[bays.length - 1]!.x) / 2 : 0;
  return SAMPLE_SECTIONS.map(([x, deck, bottom, z]) => ({
    x: mid + x * sx,
    deck: deck * sy,
    bottom: bottom * sy,
    z,
  }));
}

export interface ShipBounds {
  minX: number;
  maxX: number;
  halfBreadth: number;
  minZ: number;
  maxZ: number;
}

/** The box the camera fits to, as in the design: hull length, deck breadth, keel to stack tops. */
export function shipBounds(sections: readonly HullSection[]): ShipBounds {
  return {
    minX: Math.min(...sections.map((s) => s.x)),
    maxX: Math.max(...sections.map((s) => s.x)),
    halfBreadth: Math.max(...sections.map((s) => s.deck)) + 0.4,
    minZ: KEEL_Z,
    maxZ: 20,
  };
}

type P3 = [number, number, number];

/**
 * Triangles of the hull shell (both sides, bottom, transom and stem) and of the deck, in ship
 * coordinates. Each face is wound so that its front faces outward (up for the deck).
 */
export function hullTriangles(sections: readonly HullSection[]): { shell: P3[]; deck: P3[] } {
  const shell: P3[] = [];
  const deck: P3[] = [];
  const quad = (out: P3[], a: P3, b: P3, c: P3, d: P3, outward: P3) => {
    const u: P3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v: P3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: P3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const facing = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2];
    if (facing >= 0) out.push(a, b, c, a, c, d);
    else out.push(a, c, b, a, d, c);
  };
  for (let k = 0; k < sections.length - 1; k++) {
    const s0 = sections[k]!;
    const s1 = sections[k + 1]!;
    for (const side of [1, -1]) {
      quad(
        shell,
        [s0.x, side * s0.bottom, s0.z],
        [s1.x, side * s1.bottom, s1.z],
        [s1.x, side * s1.deck, DECK_Z],
        [s0.x, side * s0.deck, DECK_Z],
        [0, side, 0.3],
      );
    }
    quad(
      shell,
      [s0.x, s0.bottom, s0.z],
      [s1.x, s1.bottom, s1.z],
      [s1.x, -s1.bottom, s1.z],
      [s0.x, -s0.bottom, s0.z],
      [0, 0, -1],
    );
    quad(
      deck,
      [s0.x, s0.deck, DECK_Z],
      [s1.x, s1.deck, DECK_Z],
      [s1.x, -s1.deck, DECK_Z],
      [s0.x, -s0.deck, DECK_Z],
      [0, 0, 1],
    );
  }
  const first = sections[0]!;
  const last = sections[sections.length - 1]!;
  for (const [s, dir] of [
    [first, -1],
    [last, 1],
  ] as const) {
    quad(
      shell,
      [s.x, -s.deck, DECK_Z],
      [s.x, s.deck, DECK_Z],
      [s.x, s.bottom, s.z],
      [s.x, -s.bottom, s.z],
      [dir, 0, 0],
    );
  }
  return { shell, deck };
}

/**
 * The waterline on both sides, as line segments in ship coordinates. The draft runs linearly
 * from the forward draft at the bow end of the cargo to the aft draft at the stern end.
 */
export function waterline(
  sections: readonly HullSection[],
  draftFwd: number,
  draftAft: number,
): P3[] {
  const bow = sections[sections.length - 2]!.x;
  const stern = sections[1]!.x;
  const points: { x: number; y: number; z: number }[] = sections.map((s) => {
    const t = (bow - s.x) / (bow - stern);
    const draft = draftFwd + t * (draftAft - draftFwd);
    const zw = KEEL_Z + draft;
    const f = Math.max(0, Math.min(1, (zw - s.z) / (DECK_Z - s.z)));
    return { x: s.x, y: s.bottom + (s.deck - s.bottom) * f, z: Math.max(s.z, zw) };
  });
  const segments: P3[] = [];
  for (const side of [1, -1]) {
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k]!;
      const b = points[k + 1]!;
      segments.push([a.x, side * a.y, a.z], [b.x, side * b.y, b.z]);
    }
  }
  return segments;
}
