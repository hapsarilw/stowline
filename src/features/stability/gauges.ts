import { gaugeState, type GaugeState, type VesselLimits } from '@/domain';

// The four gauges of the stability strip (FR-50): GM, trim, list, and bending moment with
// shear force. Each has a state, OK, Check or Limit, which is always shown as an icon and text.

export interface StabilityValues {
  gm: number;
  trim: number;
  list: number;
  bmPct: number;
  sfPct: number;
}

export interface GaugeZone {
  left: number;
  width: number;
  tone: 'err' | 'ok' | 'warn';
}

export interface GaugeModel {
  key: 'gm' | 'trim' | 'list' | 'strength';
  label: string;
  value: string;
  unit: string;
  /** Position of the marker along the bar, 0 to 100. */
  mark: number;
  zones: GaugeZone[];
  state: GaugeState;
  stateText: 'OK' | 'Check' | 'Limit';
  /** The preview of a held container, such as "+0.04 m". */
  delta?: string;
}

const STATE_TEXT: Record<GaugeState, GaugeModel['stateText']> = {
  ok: 'OK',
  check: 'Check',
  limit: 'Limit',
};
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const f2 = (n: number) => n.toFixed(2);

/** Gauges for the values to show. state is worked out from stateOf, the values the plan holds. */
export function buildGauges(
  shown: StabilityValues,
  stateOf: StabilityValues,
  limits: VesselLimits,
  deltas: Partial<Record<GaugeModel['key'], string>> = {},
): GaugeModel[] {
  const strength = Math.max(stateOf.bmPct, stateOf.sfPct);
  const make = (g: Omit<GaugeModel, 'state' | 'stateText'>, state: GaugeState): GaugeModel => ({
    ...g,
    state,
    stateText: STATE_TEXT[state],
    ...(deltas[g.key] ? { delta: deltas[g.key] } : {}),
  });
  return [
    make(
      {
        key: 'gm',
        label: 'GM',
        value: f2(shown.gm),
        unit: `m · min ${f2(limits.gmMinM)}`,
        mark: clamp((shown.gm / 3) * 100),
        zones: [{ left: 0, width: 40, tone: 'err' }],
      },
      gaugeState('gm', stateOf.gm, limits),
    ),
    make(
      {
        key: 'trim',
        label: 'Trim',
        value: f2(Math.abs(shown.trim)),
        unit: `m ${shown.trim >= 0 ? 'by stern' : 'by head'}`,
        mark: clamp(((shown.trim + limits.trimLimitM) / (2 * limits.trimLimitM)) * 100),
        zones: [
          { left: 0, width: 0.8, tone: 'err' },
          { left: 99.2, width: 0.8, tone: 'err' },
        ],
      },
      gaugeState('trim', stateOf.trim, limits),
    ),
    make(
      {
        key: 'list',
        label: 'List',
        value: Math.abs(shown.list).toFixed(1),
        unit: `° to ${shown.list >= 0 ? 'port' : 'stbd'}`,
        mark: clamp(50 - (shown.list / limits.listLimitDeg) * 50),
        zones: [{ left: 42.5, width: 15, tone: 'ok' }],
      },
      gaugeState('list', stateOf.list, limits),
    ),
    make(
      {
        key: 'strength',
        label: 'BM / SF',
        value: `${Math.round(shown.bmPct)} / ${Math.round(shown.sfPct)}`,
        unit: '% of limit',
        mark: clamp(shown.bmPct),
        zones: [
          { left: limits.strengthCheckPct, width: 100 - limits.strengthCheckPct, tone: 'warn' },
        ],
      },
      gaugeState('strength', strength, limits),
    ),
  ];
}
