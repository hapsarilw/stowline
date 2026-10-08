import { plural, type PortStop } from '@/domain';

// The port timeline (FR-55, FR-56, design 06). Stop 0 is the departure; stops 1 to 4 are the
// ports of discharge. Pure, so the stops and the timing can be tested without a browser.

/** Containers lift one after another, 20 ms apart, 500 ms each (design 06 "Motion"). */
export const STAGGER_MS = 20;
export const LIFT_MS = 500;
/** How high a container rises before it is gone, in metres (design/stow3d.js). */
export const LIFT_M = 30;
/** The pause after the last container of a port, before Play moves on (stow3d.js cycle). */
export const REST_MS = 1700;

/** How long the lift of `n` containers takes. Nothing moves with reduced motion. */
export const liftDuration = (n: number, reduced: boolean): number =>
  reduced || n === 0 ? 0 : (n - 1) * STAGGER_MS + LIFT_MS;

/** How far container `k` of the lift order has risen, 0 to 1, `elapsed` ms after the start. */
export const liftProgress = (k: number, elapsed: number): number =>
  Math.max(0, Math.min(1, (elapsed - k * STAGGER_MS) / LIFT_MS));

export interface TimelineStop {
  code: string;
  name: string;
  /** "−562", or empty for the departure. */
  discharge: string;
  /** "2 restows", or empty. */
  restows: string;
  /** Position along the track, in percent. */
  left: number;
  state: 'past' | 'current' | 'next';
  /** For the stop's button. */
  label: string;
}

export interface Timeline {
  stops: TimelineStop[];
  /** Filled part of the track, in percent. */
  progress: number;
  /** "Jebel Ali · discharging 674 boxes · 1 restow move" */
  now: string;
}

export function buildTimeline(stops: readonly PortStop[], port: number): Timeline {
  const last = stops.length - 1;
  const cur = stops[port];
  const restowText = (n: number) => (n ? plural(n, 'restow') : '');
  return {
    stops: stops.map((s, i) => ({
      code: s.code,
      name: s.name,
      discharge: i === 0 ? '' : `−${s.discharge.toLocaleString('en-US')}`,
      restows: restowText(s.restows),
      left: (i / last) * 100,
      state: i < port ? 'past' : i === port ? 'current' : 'next',
      label:
        i === 0
          ? `${s.name}, departure`
          : `${s.name}, ${plural(s.discharge, 'container')} discharged${s.restows ? `, ${plural(s.restows, 'restow')}` : ''}`,
    })),
    progress: (port / last) * 100,
    now: cur
      ? port === 0
        ? `${cur.name} · departure`
        : `${cur.name} · discharging ${cur.discharge.toLocaleString('en-US')} boxes · ${cur.restows ? plural(cur.restows, 'restow move') : 'no restows'}`
      : '',
  };
}
