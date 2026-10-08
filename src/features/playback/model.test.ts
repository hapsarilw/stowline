import { describe, expect, it } from 'vitest';
import { portStops, validateAll } from '@/domain';
import { sampleSetup } from '@/domain/testing/fixtures';
import { buildTimeline, liftDuration, liftProgress } from './model';

const { ctx, state } = sampleSetup();
const stops = portStops(state, ctx, validateAll(state, ctx));

describe('port timeline (FR-55)', () => {
  it('has the five stops of design 06, with counts and restows (AT-07)', () => {
    const t = buildTimeline(stops, 2);
    expect(t.stops.map((s) => [s.code, s.name, s.discharge, s.restows])).toEqual([
      ['SGSIN', 'Singapore', '', ''],
      ['LKCMB', 'Colombo', '−562', '2 restows'],
      ['AEJEA', 'Jebel Ali', '−674', '1 restow'],
      ['NLRTM', 'Rotterdam', '−837', ''],
      ['DEHAM', 'Hamburg', '−667', ''],
    ]);
    expect(t.stops.map((s) => s.left)).toEqual([0, 25, 50, 75, 100]);
    expect(t.stops.map((s) => s.state)).toEqual(['past', 'past', 'current', 'next', 'next']);
    expect(t.progress).toBe(50);
    expect(t.now).toBe('Jebel Ali · discharging 674 boxes · 1 restow move');
    expect(buildTimeline(stops, 4).now).toBe('Hamburg · discharging 667 boxes · no restows');
    expect(buildTimeline(stops, 1).stops[1]!.label).toBe(
      'Colombo, 562 containers discharged, 2 restows',
    );
  });
});

describe('lift timing (FR-56)', () => {
  it('lifts 20 ms apart for 500 ms each, and not at all with reduced motion', () => {
    expect(liftDuration(562, false)).toBe(561 * 20 + 500);
    expect(liftDuration(562, true)).toBe(0);
    expect(liftDuration(0, false)).toBe(0);
    expect(liftProgress(0, 0)).toBe(0);
    expect(liftProgress(0, 250)).toBe(0.5);
    expect(liftProgress(3, 60)).toBe(0);
    expect(liftProgress(3, 310)).toBe(0.5);
    expect(liftProgress(3, 9999)).toBe(1);
  });
});
