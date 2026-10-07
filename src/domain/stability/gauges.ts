import type { VesselLimits } from '../types';

export type GaugeState = 'ok' | 'check' | 'limit';
export type GaugeKind = 'gm' | 'trim' | 'list' | 'strength';

/** BR-12 limits and BR-13 cautions. Trim and list count in either direction. */
export function gaugeState(kind: GaugeKind, value: number, L: VesselLimits): GaugeState {
  switch (kind) {
    case 'gm':
      return value < L.gmMinM ? 'limit' : value < L.gmCheckM ? 'check' : 'ok';
    case 'trim': {
      const t = Math.abs(value);
      return t > L.trimLimitM ? 'limit' : t > L.trimCheckM ? 'check' : 'ok';
    }
    case 'list': {
      const l = Math.abs(value);
      return l >= L.listLimitDeg ? 'limit' : l > L.listCheckDeg ? 'check' : 'ok';
    }
    case 'strength':
      return value > L.strengthLimitPct ? 'limit' : value > L.strengthCheckPct ? 'check' : 'ok';
  }
}
