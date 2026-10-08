import {
  gaugeState,
  pad,
  strengthPosition,
  type GaugeState,
  type Hydrostatics,
  type StowContext,
  type VesselLimits,
} from '@/domain';

// The stability drawer (FR-53, design 05): the strength chart, the draft diagram, the GM and
// list dials, the trim bar and the hydrostatic values. Pure drawing maths on the numbers the
// domain model gives; the model itself is computeStability.

/** The chart's coordinates: 600 wide, 220 high, 0% at y 110 and 1% per unit, as the design. */
const CHART_W = 600;
const ZERO_Y = 110;

export interface DrawerValues {
  gm: number;
  trim: number;
  list: number;
  draftFwd: number;
  draftAft: number;
  draftMean: number;
  displacementT: number;
  deadweightT: number;
  kg: number;
}

export interface Peak {
  text: string;
  /** Percent across and down the chart. */
  left: number;
  top: number;
  tone: 'accent' | 'text';
}

export interface StrengthChart {
  bmPath: string;
  sfPath: string;
  /** x of the selected bay's band, 24 wide. */
  bandX: number;
  peaks: Peak[];
  bays: { label: string; left: number }[];
  label: string;
}

const y = (v: number) => Math.max(0, Math.min(220, ZERO_Y - v));
const f1 = (n: number) => n.toFixed(1);

/** An SVG path through the stations, from the bow (left) to the stern. */
export function curvePath(values: readonly number[]): string {
  const n = values.length - 1;
  return values.map((v, i) => `${i ? 'L' : 'M'}${f1((i / n) * CHART_W)},${f1(y(v))}`).join(' ');
}

export function strengthChart(
  bm: readonly number[],
  sf: readonly number[],
  ctx: StowContext,
  bay: number,
): StrengthChart {
  const n = bm.length - 1;
  const at = (i: number) => (i / n) * 100;
  const top = (v: number) => y(v) / 2.2;
  const ib = bm.indexOf(Math.max(...bm));
  const sMax = sf.indexOf(Math.max(...sf));
  const sMin = sf.indexOf(Math.min(...sf));
  const bmPeak = Math.round(bm[ib] ?? 0);
  const sfPeak = Math.round(Math.max(...sf.map(Math.abs)));
  return {
    bmPath: curvePath(bm),
    sfPath: curvePath(sf),
    bandX: strengthPosition(ctx, bay) * CHART_W - 12,
    peaks: [
      { text: `BM ${bmPeak}%`, left: at(ib), top: top(bm[ib]!), tone: 'accent' },
      { text: `SF +${Math.round(sf[sMax]!)}%`, left: at(sMax), top: top(sf[sMax]!), tone: 'text' },
      {
        text: `SF −${Math.round(-sf[sMin]!)}%`,
        left: at(sMin),
        top: top(sf[sMin]!) + 8,
        tone: 'text',
      },
    ],
    bays: ctx.vessel.bays
      .filter((_, i) => i % 3 === 0)
      .map((b) => ({ label: pad(b.bay), left: strengthPosition(ctx, b.bay) * 100 })),
    label: `Bending moment peaks at ${bmPeak} percent, shear force at ${sfPeak} percent of limit`,
  };
}

/** The draft diagram: 340 by 170, 3.92 units per metre, trim drawn 8 times larger. */
export function draftDiagram(v: Pick<DrawerValues, 'trim' | 'draftMean'>, summer: number) {
  const px = 3.92;
  const ex = 8;
  const yM = 140 - v.draftMean * px;
  const yF = yM + ((v.trim * ex) / 2) * px;
  const yA = yM - ((v.trim * ex) / 2) * px;
  return {
    y1: f1(yF),
    y2: f1(yA),
    poly: `0,${f1(yF)} 340,${f1(yA)} 340,170 0,170`,
    summerY: f1(140 - summer * px),
  };
}

const arc = (a0: number, a1: number, r = 76, cx = 100, cy = 96): string => {
  const p = (a: number) => `${f1(cx + r * Math.cos(a))},${f1(cy - r * Math.sin(a))}`;
  return `M${p(a0)} A${r},${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${p(a1)}`;
};
const point = (a: number, r: number) => ({
  x: f1(100 + r * Math.cos(a)),
  y: f1(96 - r * Math.sin(a)),
});

/** GM dial: 0 to 3 m over a half circle, red under the minimum (design 05). */
export function gmDial(gm: number, L: VesselLimits) {
  const a = (v: number) => Math.PI - (Math.min(3, Math.max(0, v)) / 3) * Math.PI;
  return {
    red: arc(Math.PI, a(L.gmMinM)),
    ok: arc(a(L.gmMinM), 0),
    needle: point(a(gm), 66),
    tick: { a: point(a(L.gmMinM), 86), b: point(a(L.gmMinM), 66) },
  };
}

/** List dial: 5° to port on the left, 5° to starboard on the right. */
export function listDial(list: number, L: VesselLimits) {
  const a = (v: number) => Math.PI / 2 + (Math.max(-5, Math.min(5, v)) / 5) * (Math.PI / 2);
  return {
    warnL: arc(Math.PI, a(L.listCheckDeg)),
    ok: arc(a(L.listCheckDeg), a(-L.listCheckDeg)),
    warnR: arc(a(-L.listCheckDeg), 0),
    errL: arc(Math.PI, a(L.listLimitDeg)),
    errR: arc(a(-L.listLimitDeg), 0),
    needle: point(a(list), 66),
  };
}

const STATE_TEXT: Record<GaugeState, 'OK' | 'Check' | 'Limit'> = {
  ok: 'OK',
  check: 'Check',
  limit: 'Limit',
};

export interface DrawerStatus {
  state: GaugeState;
  text: string;
}

/** The state lines under the dials and the trim bar, from the values the plan holds. */
export function drawerStatus(v: Pick<DrawerValues, 'gm' | 'trim' | 'list'>, L: VesselLimits) {
  const line = (s: GaugeState, rest: string): DrawerStatus => ({
    state: s,
    text: `${STATE_TEXT[s]} · ${rest}`,
  });
  return {
    gm: line(gaugeState('gm', v.gm, L), `min ${L.gmMinM.toFixed(2)} m`),
    list: line(gaugeState('list', v.list, L), `crane limit ${L.listCheckDeg}°`),
    trim: line(gaugeState('trim', v.trim, L), `limit ±${L.trimLimitM.toFixed(2)} m`),
  };
}

/** The trim bar: the marker and the OK band, in percent, over ±limit. */
export function trimBar(trim: number, L: VesselLimits) {
  const span = 2 * L.trimLimitM;
  const pos = (t: number) => Math.max(0, Math.min(100, ((t + L.trimLimitM) / span) * 100));
  return { mark: pos(trim), okLeft: pos(-L.trimCheckM), okRight: 100 - pos(L.trimCheckM) };
}

export const trimText = (trim: number) =>
  `${Math.abs(trim).toFixed(2)} m by ${trim >= 0 ? 'stern' : 'head'}`;

/** The hydrostatic values, as the design lists them. Displacement, deadweight, KG and GM follow the plan. */
export function hydrostatics(v: DrawerValues, h: Hydrostatics): { label: string; value: string }[] {
  const t = (n: number) => `${Math.round(n).toLocaleString('en-US')} t`;
  return [
    { label: 'Displacement', value: t(v.displacementT) },
    { label: 'Deadweight', value: t(v.deadweightT) },
    { label: 'KM', value: `${h.km.toFixed(2)} m` },
    { label: 'KG (fluid)', value: `${v.kg.toFixed(2)} m` },
    { label: 'GM', value: `${v.gm.toFixed(2)} m` },
    { label: 'Summer draft', value: `${h.summerDraftM.toFixed(2)} m` },
  ];
}
