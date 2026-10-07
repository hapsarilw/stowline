import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Container, Geometry, SlotKey } from '@/domain';
import type { CameraPreset } from '../camera';
import type { ShipBounds } from './hull';

// Ship coordinates are x toward the bow, y to port, z up (SRS "Data model").
// three.js has y up. A point (x, y, z) on the ship is (x, z, -y) in the scene.

export const toScene = (x: number, y: number, z: number, out = new Vector3()): Vector3 =>
  out.set(x, z, -y);

// Box sizes from design/stow3d.js (it stores half sizes): 20ft 5.9 m, 40ft 12.1 m long,
// 2.4 m wide, 2.4 m high or 2.66 m for high cube and reefer.

export type SizeClass = '20' | '20hc' | '40' | '40hc';

export const SIZE_CLASSES: readonly SizeClass[] = ['20', '40', '40hc', '20hc'];

const TALL = new Set(['40HC', 'RF']);

export function sizeClassOf(c: Pick<Container, 'type' | 'lengthFt'>): SizeClass {
  const tall = TALL.has(c.type);
  return c.lengthFt === 20 ? (tall ? '20hc' : '20') : tall ? '40hc' : '40';
}

/** Scene size of a box: [length along x, height along y, width along z]. */
export function boxSize(cls: SizeClass): [number, number, number] {
  const length = cls.startsWith('20') ? 5.9 : 12.1;
  const height = cls.endsWith('hc') ? 2.66 : 2.4;
  return [length, height, 2.4];
}

const IDENTITY = new Quaternion();
const tmpPos = new Vector3();
const tmpScale = new Vector3();

/** The instance matrix of a container in a slot: its centre and its size. */
export function slotMatrix(
  geometry: Geometry,
  key: SlotKey,
  cls: SizeClass,
  gapX = 0,
  out = new Matrix4(),
): Matrix4 {
  const p = geometry.slotPos(key);
  toScene(p.x + gapX, p.y, p.z, tmpPos);
  const [l, h, w] = boxSize(cls);
  return out.compose(tmpPos, IDENTITY, tmpScale.set(l, h, w));
}

// Bay gap (FR-23): the bays forward of the selected bay move 3.2 m toward the bow and the
// bays aft of it 3.2 m toward the stern. `gaps` maps a bay index to how far its gap is open,
// 0 to 1, so an old gap can close while a new one opens.

export const GAP_M = 3.2;

export function gapOffset(bayIndex: number, gaps: ReadonlyMap<number, number>): number {
  let d = 0;
  for (const [g, amount] of gaps) {
    if (bayIndex < g) d += GAP_M * amount;
    else if (bayIndex > g) d -= GAP_M * amount;
  }
  return d;
}

// Camera presets from design/stow3d.js. yaw and pitch in degrees, zoom relative to a fit of the
// whole ship, and a target point in ship coordinates.

export interface CameraView {
  yaw: number;
  pitch: number;
  zoom: number;
  tx: number;
  ty: number;
  tz: number;
}

export const PRESETS: Readonly<Record<CameraPreset, CameraView>> = {
  iso: { yaw: 204, pitch: 27, zoom: 1, tx: 0, ty: 0, tz: -4 },
  port: { yaw: 180, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 },
  stbd: { yaw: 0, pitch: 6, zoom: 1, tx: 0, ty: 0, tz: -4 },
  top: { yaw: 180, pitch: 89, zoom: 1, tx: 0, ty: 0, tz: -4 },
  bow: { yaw: 270, pitch: 16, zoom: 1, tx: 0, ty: 0, tz: -4 },
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The direction from the target toward the camera, in ship coordinates. */
export function viewDirection(yaw: number, pitch: number): [number, number, number] {
  const ya = rad(yaw);
  const pa = rad(pitch);
  return [-Math.sin(ya) * Math.cos(pa), -Math.cos(ya) * Math.cos(pa), Math.sin(pa)];
}

/**
 * Pixels per metre that fit the whole ship in the view, as the design does: 90% of the width,
 * 80% of the height.
 */
export function fitZoom(
  yaw: number,
  pitch: number,
  width: number,
  height: number,
  b: ShipBounds,
): number {
  const ya = rad(yaw);
  const pa = rad(pitch);
  const cy = Math.cos(ya);
  const sy = Math.sin(ya);
  const cp = Math.cos(pa);
  const sp = Math.sin(pa);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const x of [b.minX, b.maxX]) {
    for (const y of [-b.halfBreadth, b.halfBreadth]) {
      for (const z of [b.minZ, b.maxZ]) {
        const sx = x * cy - y * sy;
        const syy = z * cp + (x * sy + y * cy) * sp;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, syy);
        maxY = Math.max(maxY, syy);
      }
    }
  }
  return Math.min((width * 0.9) / (maxX - minX), (height * 0.8) / (maxY - minY));
}

export interface CameraPose {
  position: Vector3;
  target: Vector3;
  /** Orthographic zoom: pixels per metre. */
  zoom: number;
}

/** Distance of the orthographic camera from its target. It does not change the picture. */
export const CAMERA_DISTANCE = 800;

export function cameraPose(
  view: CameraView,
  width: number,
  height: number,
  b: ShipBounds,
): CameraPose {
  const [dx, dy, dz] = viewDirection(view.yaw, view.pitch);
  const target = toScene(view.tx, view.ty, view.tz);
  const position = toScene(
    view.tx + dx * CAMERA_DISTANCE,
    view.ty + dy * CAMERA_DISTANCE,
    view.tz + dz * CAMERA_DISTANCE,
  );
  return { position, target, zoom: fitZoom(view.yaw, view.pitch, width, height, b) * view.zoom };
}

/** The view a camera has now, so a move to a preset can start from it. */
export function viewOf(
  position: Vector3,
  target: Vector3,
  zoom: number,
  width: number,
  height: number,
  b: ShipBounds,
): CameraView {
  const o = position.clone().sub(target).normalize();
  // Scene (x, y, z) is ship (x, -z, y).
  const vx = o.x;
  const vy = -o.z;
  const vz = o.y;
  const pitch = deg(Math.asin(Math.max(-1, Math.min(1, vz))));
  const yaw = (deg(Math.atan2(-vx, -vy)) + 360) % 360;
  const fit = fitZoom(yaw, pitch, width, height, b);
  return { yaw, pitch, zoom: zoom / fit, tx: target.x, ty: -target.z, tz: target.y };
}

export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** A view between two views. Yaw takes the short way round. */
export function mixViews(a: CameraView, b: CameraView, t: number): CameraView {
  let dy = b.yaw - a.yaw;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    yaw: (a.yaw + dy * t + 360) % 360,
    pitch: m(a.pitch, b.pitch),
    zoom: m(a.zoom, b.zoom),
    tx: m(a.tx, b.tx),
    ty: m(a.ty, b.ty),
    tz: m(a.tz, b.tz),
  };
}
