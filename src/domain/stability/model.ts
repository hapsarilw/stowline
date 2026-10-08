import { KEEL_OFFSET_Z } from '../geometry';
import type { StowContext } from '../plan/context';
import type { StowState } from '../plan/state';
import type { StabilityResult } from '../types';

// Simplified stability estimate, SRS "Stability model". Not a loading computer.
// Recalculated from the whole plan, so undo and redo can never drift.

/** The seeded plan's readings. The base values are solved so that plan reads exactly these. */
export const REFERENCE = { gm: 1.84, trim: 0.62, list: 0.4, bmPct: 78, sfPct: 64 } as const;

export const STATIONS = 61;

/** Half the length of a 40ft bay along the ship, in metres. */
const HALF_BAY = 6.6;

export interface StabilityBase {
  /** Displacement, KG, trim and heeling moment of the ship without containers. */
  displacement0: number;
  kg0: number;
  trim0: number;
  heelMoment0: number;
  /** Container weight per bay (by bay index) in the seeded plan. */
  seedBayWeights: number[];
}

export interface StabilityReading extends StabilityResult {
  displacementT: number;
  deadweightT: number;
  kg: number;
  draftMean: number;
}

interface Sums {
  w: number;
  wz: number;
  /** Σ w (LCF − x) */
  wTrim: number;
  wy: number;
  bayWeights: number[];
}

function sums(s: StowState, ctx: StowContext): Sums {
  const lcf = ctx.vessel.hydrostatics.lcf;
  const out: Sums = { w: 0, wz: 0, wTrim: 0, wy: 0, bayWeights: ctx.vessel.bays.map(() => 0) };
  // Summed in slot order, so the same plan gives the same numbers to the last bit,
  // whatever order the commands came in.
  const keys = [...s.placements.keys()].sort();
  for (const key of keys) {
    const p = s.placements.get(key)!;
    const c = ctx.containers.get(p.containerId);
    if (!c) continue;
    const pos = ctx.geometry.slotPos(p.slotKey);
    const w = c.weightT;
    out.w += w;
    out.wz += w * (pos.z + KEEL_OFFSET_Z);
    out.wTrim += w * (lcf - pos.x);
    out.wy += w * pos.y;
    out.bayWeights[pos.bayIndex] = (out.bayWeights[pos.bayIndex] ?? 0) + w;
  }
  return out;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Solves the four base values once from the seeded plan. */
export function calibrateStability(seed: StowState, ctx: StowContext): StabilityBase {
  const h = ctx.vessel.hydrostatics;
  const t = sums(seed, ctx);
  const displacement0 = h.referenceDisplacementT - t.w;
  const kg0 = (h.referenceDisplacementT * h.referenceKg - t.wz) / displacement0;
  const trim0 = REFERENCE.trim - t.wTrim / (100 * h.mtc);
  const gm = h.km - h.referenceKg;
  const heelMoment0 = Math.tan(rad(REFERENCE.list)) * h.referenceDisplacementT * gm - t.wy;
  return { displacement0, kg0, trim0, heelMoment0, seedBayWeights: t.bayWeights };
}

/** The reference strength curves: 61 stations from bow to stern, peaks 78% and 64%. */
export function referenceCurves(): { bm: number[]; sf: number[] } {
  const n = STATIONS - 1;
  const bm: number[] = [];
  const sf: number[] = [];
  for (let k = 0; k <= n; k++) {
    const x = k / n;
    bm.push(Math.pow(Math.sin(Math.PI * x), 1.4) * (1 + 0.12 * Math.sin(Math.PI * x * 2.2)));
    sf.push(Math.sin(2 * Math.PI * x) * (1 - 0.18 * x) + 0.08 * Math.sin(6 * Math.PI * x));
  }
  const mb = Math.max(...bm);
  const ms = Math.max(...sf.map(Math.abs));
  return {
    bm: bm.map((v) => (v / mb) * REFERENCE.bmPct),
    sf: sf.map((v) => (v / ms) * REFERENCE.sfPct),
  };
}

const REFERENCE_CURVES = referenceCurves();

/**
 * Change in shear force (t) and bending moment (t m) at each station, from the change in
 * weight per bay (FR-54, SRS "Strength curves"). The 61 stations run from the bow to the stern
 * and bound 60 cells.
 * 1. The change in weight of each bay is spread over the bay's length, into the cells.
 * 2. It is balanced by a buoyancy change that is uniform plus linear along the ship, so the net
 *    force and the net moment are zero (sinkage and trim).
 * 3. Summed once from the bow for shear force and twice for bending moment. Both are zero at
 *    the bow and at the stern. Negative bending moment is sagging.
 */
export function strengthChange(
  ctx: StowContext,
  bayDelta: readonly number[],
): { sf: number[]; bm: number[] } {
  const bays = ctx.vessel.bays;
  const bow = bays[0]!.x + HALF_BAY;
  const stern = bays[bays.length - 1]!.x - HALF_BAY;
  const cells = STATIONS - 1;
  const dx = (bow - stern) / cells;
  const xs = Array.from({ length: STATIONS }, (_, k) => bow - k * dx);
  const mids = Array.from({ length: cells }, (_, i) => bow - (i + 0.5) * dx);

  // 1. Load per cell: each bay's change spread evenly over its length.
  const load = mids.map(() => 0);
  bays.forEach((b, i) => {
    const dw = bayDelta[i] ?? 0;
    if (dw === 0) return;
    const perMetre = dw / (2 * HALF_BAY);
    mids.forEach((x, k) => {
      const lo = Math.max(x - dx / 2, b.x - HALF_BAY);
      const hi = Math.min(x + dx / 2, b.x + HALF_BAY);
      if (hi > lo) load[k] = load[k]! + perMetre * (hi - lo);
    });
  });

  // 2. Buoyancy per cell: a + c (x − xc), with the same total force and moment as the load.
  const xc = mids.reduce((a, x) => a + x, 0) / cells;
  const total = load.reduce((a, q) => a + q, 0);
  const moment = load.reduce((a, q, k) => a + q * (mids[k]! - xc), 0);
  const spread = mids.reduce((a, x) => a + (x - xc) ** 2, 0);
  const a = total / cells;
  const c = moment / spread;
  const net = load.map((q, k) => q - (a + c * (mids[k]! - xc)));

  // 3. Shear force and bending moment at each station, from the forces forward of it.
  const sf: number[] = [];
  const bm: number[] = [];
  for (let k = 0; k < STATIONS; k++) {
    let shear = 0;
    let m = 0;
    for (let j = 0; j < k; j++) {
      shear += net[j]!;
      m += net[j]! * (mids[j]! - xs[k]!);
    }
    sf.push(shear);
    bm.push(m);
  }
  return { sf, bm };
}

/**
 * Where a bay's centre falls on the strength axis: 0 at the bow station, 1 at the stern, as the
 * 61 stations run. For the band of the selected bay in the drawer chart.
 */
export function strengthPosition(ctx: StowContext, bay: number): number {
  const bays = ctx.vessel.bays;
  const bow = bays[0]!.x + HALF_BAY;
  const stern = bays[bays.length - 1]!.x - HALF_BAY;
  const b = ctx.geometry.bayByNum(bay);
  return b ? (bow - b.x) / (bow - stern) : 0;
}

/** One pure function of plan and vessel. The drag preview uses the same function. */
export function computeStability(
  s: StowState,
  ctx: StowContext,
  base: StabilityBase,
): StabilityReading {
  const h = ctx.vessel.hydrostatics;
  const L = ctx.vessel.limits;
  const t = sums(s, ctx);

  const displacementT = base.displacement0 + t.w;
  const kg = (base.displacement0 * base.kg0 + t.wz) / displacementT;
  const gm = h.km - kg;
  const trim = base.trim0 + t.wTrim / (100 * h.mtc);
  const list = deg(Math.atan((base.heelMoment0 + t.wy) / (displacementT * gm)));
  const draftMean =
    h.referenceMeanDraftM + (displacementT - h.referenceDisplacementT) / (100 * h.tpc);

  const delta = t.bayWeights.map((w, i) => w - (base.seedBayWeights[i] ?? 0));
  const change = strengthChange(ctx, delta);
  const bmCurve = REFERENCE_CURVES.bm.map((v, k) => v + (change.bm[k]! / L.bendingLimitTm) * 100);
  const sfCurve = REFERENCE_CURVES.sf.map((v, k) => v + (change.sf[k]! / L.shearLimitT) * 100);

  return {
    gm,
    trim,
    list,
    draftFwd: draftMean - trim / 2,
    draftAft: draftMean + trim / 2,
    draftMean,
    bmPct: Math.max(...bmCurve.map(Math.abs)),
    sfPct: Math.max(...sfCurve.map(Math.abs)),
    bmCurve,
    sfCurve,
    displacementT,
    deadweightT: h.referenceDeadweightT + (displacementT - h.referenceDisplacementT),
    kg,
  };
}
